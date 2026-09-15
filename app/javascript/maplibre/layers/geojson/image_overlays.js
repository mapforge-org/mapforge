import { featureOnLevel } from 'maplibre/controls/levels'
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'

// A polygon with 'fill-image-url' is drawn as a MapLibre image source: its corners are pinned
// to the ground, unlike a scaled 'flat' symbol, whose size is evaluated at the anchor only and
// so drifts with pitch and fractional zoom. One image source holds one image, so every such
// feature gets its own companion source, keyed by the geojson layer id.
const sourcePrefix = layerId => `image-overlay-source-${layerId}-`
const layerIdOf = sourceId => `image-overlay-layer_${sourceId}`

// An image source takes four corners, no more and no less, so only a quadrangle can carry one.
// The ring repeats its first point, so four corners are five coordinates.
export const canPinImage = feature => feature.geometry?.type === 'Polygon' &&
  feature.geometry.coordinates[0]?.length === 5

export function hasImageOverlay (feature) {
  return canPinImage(feature) && !!feature.properties?.['fill-image-url']
}

// The four vertices of the outer ring, without its repeated last point, in the order MapLibre
// expects: top left, top right, bottom right, bottom left.
const corners = feature => feature.geometry.coordinates[0].slice(0, 4)

export function renderImageOverlays (features, layerId, visible = true) {
  const prefix = sourcePrefix(layerId)
  const wanted = new Set()
  features.filter(hasImageOverlay).forEach(feature => {
    wanted.add(prefix + feature.id)
    upsertImageOverlay(feature, layerId, visible)
  })
  Object.keys(map.getStyle().sources)
    .filter(id => id.startsWith(prefix) && !wanted.has(id))
    .forEach(removeImageOverlay)
}

export function syncImageOverlay (feature, layerId, visible = true) {
  if (hasImageOverlay(feature)) {
    upsertImageOverlay(feature, layerId, visible)
  } else {
    removeImageOverlay(sourcePrefix(layerId) + feature.id)
  }
}

export function removeFeatureImageOverlay (feature, layerId) {
  removeImageOverlay(sourcePrefix(layerId) + feature.id)
}

function upsertImageOverlay (feature, layerId, visible) {
  const sourceId = sourcePrefix(layerId) + feature.id
  const url = feature.properties['fill-image-url']
  const coordinates = corners(feature)
  const source = map.getSource(sourceId)
  if (!source) {
    map.addSource(sourceId, { type: 'image', url, coordinates })
    // below the polygon outline of its own layer, sortLayers() keeps it there on a re-sort
    const outlineId = `polygon-layer-outline_geojson-source-${layerId}`
    map.addLayer({ id: layerIdOf(sourceId), type: 'raster', source: sourceId, paint: { 'raster-fade-duration': 0 } },
      map.getLayer(outlineId) ? outlineId : undefined)
  } else if (source.options.url !== url) {
    source.updateImage({ url, coordinates })
  } else {
    source.setCoordinates(coordinates)
  }
  // The image covers the fill of its polygon (see the beforeId of addLayer above), so the
  // opacity slider, which writes 'fill-opacity', reads as the opacity of the image.
  map.setPaintProperty(layerIdOf(sourceId), 'raster-opacity',
    Number(feature.properties['fill-opacity'] ?? defaults.extrusionOpacity))
  const shown = visible && featureOnLevel(feature)
  map.setLayoutProperty(layerIdOf(sourceId), 'visibility', shown ? 'visible' : 'none')
}

function removeImageOverlay (sourceId) {
  if (map.getLayer(layerIdOf(sourceId))) { map.removeLayer(layerIdOf(sourceId)) }
  if (map.getSource(sourceId)) { map.removeSource(sourceId) }
}
