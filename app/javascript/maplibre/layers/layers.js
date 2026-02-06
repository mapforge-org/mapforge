import { initializeWikipediaLayers, loadWikipediaLayer } from 'maplibre/layers/wikipedia'
import { initializeOverpassLayers, loadOverpassLayer } from 'maplibre/overpass/overpass'
import { addGeoJSONSource } from 'maplibre/map'
import { initializeGeoJSONLayers } from 'maplibre/layers/geojson'
import { initializeKmMarkerStyles } from 'maplibre/feature'

export let layers // [{ id:, type: "overpass"||"geojson", name:, query:, geojson: { type: 'FeatureCollection', features: [] } }]
window._layers = layers

// Loads initial layer definitions from server
export function loadLayerDefinitions() {
  const host = new URL(window.location.href).origin
  const url = host + '/m/' + window.gon.map_id + '.json'
  return fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was: ', response) }
      return response.json()
    })
    .then(data => {
      console.log('Loaded map layer definitions from server: ', data.layers)
      // make sure we're still showing the map the request came from
      if (window.gon.map_properties.public_id !== data.properties.public_id) { return }
      layers = data.layers
    })
    .catch(error => {
      console.error('Failed to fetch map layers:', error)
    })
}

// initialize layers: create source
export function initializeLayerSources(id = null) {
  let initLayers = layers
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  initLayers.forEach((layer) => {
    console.log('Adding source for layer', layer.type, layer.id, layer.cluster)
    addGeoJSONSource(layer.type + '-source-' + layer.id, layer.cluster)
  })
  addGeoJSONSource('km-marker-source', false)
}

// initialize layers: apply styles and load data
export function initializeLayerStyles() {
  // let initLayers = layers
  // if (id) { initLayers = initLayers.filter(l => l.id === id) }

  // TODO: per layer
  initializeGeoJSONLayers()
  initializeKmMarkerStyles()
  initializeOverpassLayers() 
  initializeWikipediaLayers()
}

// triggered by layer reload in the UI
export function loadLayerData(id) {
  const layer = layers.find(f => f.id === id)
  // geojson layers are loaded in loadLayerDefinitions
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
  const layer = getLayer(featureId)
  if (layer) {
    return layer.type + '-source-' + layer.id
  }
  return null
}

export function getLayer(featureId) {
  for (const layer of layers) {
    if (layer.geojson) {
      let feature = layer.geojson.features.find(f => f.id === featureId)
      if (feature) { return layer }
    }
  }
  return null
}