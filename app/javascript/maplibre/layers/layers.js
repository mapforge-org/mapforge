import { initializeWikipediaLayers, loadWikipediaLayer } from 'maplibre/layers/wikipedia'
import { initializeOverpassLayers, loadOverpassLayer } from 'maplibre/overpass/overpass'
import { initializeViewStyles } from 'maplibre/styles'
import { map, addGeoJSONSource, redrawGeojson } from 'maplibre/map'
import * as functions from 'helpers/functions'

export let layers // [{ id:, type: "overpass"||"geojson", name:, query:, geojson: { type: 'FeatureCollection', features: [] } }]
window._layers = layers

// Loads initial layer definitions from server
export function loadLayerDefinitions() {
  const host = new URL(window.location.href).origin
  const url = host + '/m/' + window.gon.map_id + '.json'
  layers = fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was: ', response) }
      return response.json()
    })
    .then(data => {
      console.log('Loaded map layers from server: ', data.layers)
      // make sure we're still showing the map the request came from
      if (window.gon.map_properties.public_id !== data.properties.public_id) { return }
      layers = data.layers
    })
    .catch(error => {
      console.error('Failed to fetch map layers:', error)
    })
  return layers
}

// initialize layers: create source, apply styles and load data
export function initializeLayers(id = null) {
  let initLayers = layers
  if (id) { initLayers = initLayers.filter(l => l.id === id) }
  initLayers.forEach((layer) => {
    console.log('Adding source for layer', layer.type, layer.id, layer.cluster)
    addGeoJSONSource(layer.type + '-source-' + layer.id, layer.cluster)
  })

  // geojson, TODO: factor out
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