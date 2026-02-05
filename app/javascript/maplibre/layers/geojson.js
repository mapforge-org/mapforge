import { map, redrawGeojson } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles'
import * as functions from 'helpers/functions'
import { layers } from 'maplibre/layers/layers'

export function initializeGeoJSONLayers(id = null) {
  console.log('Initializing geojson layers')

  let initLayers = layers.filter(l => l.type === 'geojson')
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  initLayers.forEach((layer) => {
    initializeViewStyles('geojson-source-' + layer.id, !!layer.cluster)
  })

  
  redrawGeojson()
  functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })
  map.fire('geojson.load', { detail: { message: 'geojson source loaded' } })
}