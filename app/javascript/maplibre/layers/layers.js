import { initializeWikipediaLayers, loadWikipediaLayer } from 'maplibre/layers/wikipedia'
import { initializeOverpassLayers, loadOverpassLayer } from 'maplibre/overpass/overpass'
import { layers } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles'
import { map, addGeoJSONSource, redrawGeojson } from 'maplibre/map'
import * as functions from 'helpers/functions'


// initialize layers: create source, apply styles and load data
export function initializeLayers(id = null) {
  let initLayers = layers
  if (id) { initLayers = initLayers.filter(l => l.id === id) }
  initLayers.forEach((layer) => {
    console.log('Adding source for layer', layer.type, layer.id, layer.cluster)
    addGeoJSONSource(layer.type + '-source-' + layer.id, layer.cluster)
  })

  // draw geojson layer before loading overpass layers
  console.log('Initializing geojson layers')
  initLayers.filter(l => l.type === 'geojson').forEach((layer) => {
    initializeViewStyles('geojson-source-' + layer.id, !!layer.cluster)
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

export function getFeature(id, type = null) {
  const searchLayers = type ? layers.filter(l => l.type === type) : layers
  for (const layer of searchLayers) {
    if (layer.geojson) {
      let feature = layer.geojson.features.find(f => f.id === id)
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

export function getFeatureSource(featureId) {
  for (const layer of layers) {
    if (layer.geojson) {
      let feature = layer.geojson.features.find(f => f.id === featureId)
      if (feature) { return layer.type + '-source-' + layer.id }
    }
  }
  return null
}