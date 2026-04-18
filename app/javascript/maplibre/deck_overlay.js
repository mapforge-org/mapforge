import { buffer } from "@turf/buffer"
import { map, mapProperties } from 'maplibre/map'
import { defaultLineWidth } from 'maplibre/styles/styles'
import { hexToRgb } from 'helpers/functions'

let overlay = null
let deck = null

// Collected features from all sources
const sourceFeatures = new Map()  // sourceId -> features[]

export async function updateDeckExtrusionLines(sourceId, features) {
  // Skip if terrain mode is active
  if (mapProperties.terrain) {
    sourceFeatures.delete(sourceId)
    if (sourceFeatures.size === 0 && overlay) {
      overlay.setProps({ layers: [] })
    }
    return
  }

  // Filter to LineStrings with fill-extrusion-height
  const extrusionLines = features.filter(f =>
    f.geometry.type === 'LineString' &&
    f.properties['fill-extrusion-height'] &&
    f.geometry.coordinates.length !== 1
  )

  if (extrusionLines.length === 0) {
    sourceFeatures.delete(sourceId)
    if (sourceFeatures.size === 0 && overlay) {
      // No extrusion lines anywhere, clear the layer
      overlay.setProps({ layers: [] })
      return
    }
  } else {
    sourceFeatures.set(sourceId, extrusionLines)
  }

  // Lazy load deck.gl
  if (!deck) {
    const deckModule = await import('deck.gl')
    deck = await deckModule.default
  }

  // Create overlay once
  if (!overlay) {
    overlay = new deck.MapboxOverlay({ interleaved: true, layers: [] })
    map.addControl(overlay)
  }

  // Buffer all collected lines into polygons
  const allLines = Array.from(sourceFeatures.values()).flat()
  const bufferedPolygons = allLines.map(feature => {
    const width = feature.properties['fill-extrusion-width'] ||
                  feature.properties['stroke-width'] || defaultLineWidth
    const poly = buffer(feature, width, { units: 'meters' })
    poly.properties = { ...feature.properties }
    if (!poly.properties['fill-extrusion-color'] && feature.properties.stroke) {
      poly.properties['fill-extrusion-color'] = feature.properties.stroke
    }
    return poly
  })

  const geojson = { type: 'FeatureCollection', features: bufferedPolygons }

  const layer = new deck.GeoJsonLayer({
    id: 'deck-line-extrusion',
    data: geojson,
    extruded: true,
    filled: true,
    getElevation: f => f.properties['fill-extrusion-height'] || 0,
    getFillColor: f => {
      const color = f.properties['fill-extrusion-color'] || f.properties.fill || '#0A870A'
      const opacity = f.properties['fill-extrusion-opacity'] ?? 0.9
      return [...hexToRgb(color), Math.round(opacity * 255)]
    },
    wireframe: false,
    opacity: 1,
    pickable: false
  })

  overlay.setProps({ layers: [layer] })
}

export function clearDeckExtrusionLines() {
  sourceFeatures.clear()
  if (overlay) {
    overlay.setProps({ layers: [] })
  }
}

export function removeDeckOverlay() {
  if (overlay) {
    map.removeControl(overlay)
    overlay = null
  }
  sourceFeatures.clear()
}
