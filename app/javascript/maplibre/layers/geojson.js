import { map } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles'
import { layers } from 'maplibre/layers/layers'
import { draw, select } from 'maplibre/edit'
import { getFeature } from 'maplibre/layers/layers'
import { renderKmMarkers, renderExtrusionLines } from 'maplibre/feature'

export function initializeGeoJSONLayers(id = null) {
  console.log('Initializing geojson layers')

  let initLayers = layers.filter(l => l.type === 'geojson')
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  initLayers.forEach((layer) => {
    initializeViewStyles('geojson-source-' + layer.id, !!layer.cluster)
    renderGeoJSONLayer(layer.id)
  })

  map.fire('geojson.load', { detail: { message: 'geojson source loaded' } })
}

export function renderGeoJSONLayers(resetDraw = true) {
  layers.filter(l => l.type === 'geojson').forEach((layer) => {
    renderGeoJSONLayer(layer.id, resetDraw)
  })
}

export function renderGeoJSONLayer(id, resetDraw = true) {
  let layer = layers.find(l => l.id === id)
  console.log("Redraw: Setting source data for layer", layer.type, layer.id, layer.geojson)

  // TODO: only needed once, not each render
  layer.geojson.features.forEach((feature) => { feature.properties.id = feature.id })
  renderKmMarkers()
  // - For LineStrings with a 'fill-extrusion-height', add a polygon to render extrusion
  let extrusionLines = renderExtrusionLines()
  let geojson = { type: 'FeatureCollection', features: layer.geojson.features.concat(extrusionLines) }

  map.getSource(layer.type + '-source-' + layer.id).setData(geojson, false)

  // draw has its own style layers based on editStyles
  if (draw) {
    if (resetDraw) {
      // This has a performance drawback over draw.set(), but some feature
      // properties don't get updated otherwise
      // API: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md  
      const drawFeatureIds = draw.getAll().features.map(feature => feature.id)
      draw.deleteAll()

      drawFeatureIds.forEach((featureId) => {
        let feature = getFeature(featureId, "geojson")
        if (feature) {
          draw.add(feature)
          // if we're in edit mode, re-select feature
          select(feature)
        }
      })
    }
  }
}