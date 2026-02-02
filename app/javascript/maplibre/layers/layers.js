import { initializeWikipediaLayers, loadWikipediaLayer } from 'maplibre/layers/wikipedia'
import { initializeOverpassLayers, loadOverpassLayer } from 'maplibre/overpass/overpass'
import { layers } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles'
import { map, addGeoJSONSource, redrawGeojson } from 'maplibre/map'
import * as functions from 'helpers/functions'


// initialize layers: create source, apply styles and load data
export function initializeLayers(id = null) {

  // draw geojson layer before loading overpass layers
  //geojsonData = mergedGeoJSONLayers()
  
  let initLayers = layers.filter(l => l.type === 'geojson')
  if (id) { initLayers = initLayers.filter(l => l.id === id) }
  console.log('Initializing geojson layers: ', initLayers)
  initLayers.forEach((layer) => {
    addGeoJSONSource('geojson-source-' + layer.id, false)
    initializeViewStyles('geojson-source-' + layer.id)
  })
  redrawGeojson()
  functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })
  map.fire('geojson.load', { detail: { message: 'geojson source loaded' } })

  //initializeGeoJSONLayers(id) 
  initializeOverpassLayers(id) 
  initializeWikipediaLayers(id)
}

export function loadLayer(id) {
  const layer = layers.find(f => f.id === id)
  //if (layer.type === 'geojson') {
  //  return loadGeoJSONLayer(id)
  //} else if (layer.type === 'wikipedia') {
  if (layer.type === 'wikipedia') {
    return loadWikipediaLayer(id)
  } else if (layer.type === 'overpass') {
    return loadOverpassLayer(id)
  }
}

export function getFeature(id) {
  for (const layer of layers) {
    if (layer.geojson) {
      const feature = layer.geojson.features.find(f => f.id === id)
      if (feature) { return feature }
    }
  }
  return null
}

export function getFeatures(type = 'geojson') {
  return layers.filter(l => l.type === type).flatMap(l => l.geojson?.features || [])
}

export function hasFeatures(type = 'geojson') {
  return layers.some(l => l.type === type && l.geojson?.features?.length > 0)
}