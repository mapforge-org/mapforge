import { featureOnLevel } from 'maplibre/controls/levels'
import { map } from 'maplibre/map'

// A polygon with 'fill-image-url' is drawn as a MapLibre image source: its corners are pinned
// to the ground, unlike a scaled 'flat' symbol, whose size is evaluated at the anchor only and
// so drifts with pitch and fractional zoom. One image source holds one image, so every such
// feature gets its own companion source, keyed by the geojson layer id.
const sourcePrefix = layerId => `image-overlay-source-${layerId}-`
const layerIdOf = sourceId => `image-overlay-layer_${sourceId}`

export function hasImageOverlay (feature) {
  return feature.geometry?.type === 'Polygon' &&
    !!feature.properties?.['fill-image-url'] &&
    feature.geometry.coordinates[0]?.length >= 5
}

// The first four vertices of the outer ring, in the order MapLibre expects: top left, top right,
// bottom right, bottom left. Extra vertices are ignored.
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
  const shown = visible && featureOnLevel(feature)
  map.setLayoutProperty(layerIdOf(sourceId), 'visibility', shown ? 'visible' : 'none')
}

function removeImageOverlay (sourceId) {
  if (map.getLayer(layerIdOf(sourceId))) { map.removeLayer(layerIdOf(sourceId)) }
  if (map.getSource(sourceId)) { map.removeSource(sourceId) }
}
