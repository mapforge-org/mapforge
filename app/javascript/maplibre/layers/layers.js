import * as functions from 'helpers/functions'
import { initializeGeoJSONLayers } from 'maplibre/layers/geojson'
import { initializeOverpassLayers, loadOverpassLayer } from 'maplibre/layers/overpass'
import { initializeWikipediaLayers, loadWikipediaLayer } from 'maplibre/layers/wikipedia'
import { addGeoJSONSource, map, sortLayers } from 'maplibre/map'

export let layers // [{ id:, type: "overpass"||"geojson", name:, query:, geojson: { type: 'FeatureCollection', features: [] } }]
window._layers = layers

// Loads initial layer definitions from server
export function loadLayerDefinitions() {
  layers = null
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
      map.fire('layers.load', { detail: { message: 'Map layer data loaded from server' } })
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
    // drop cluster when heatmap is set
    const cluster = !!layer.cluster && !layer.heatmap
    console.log('Adding source for layer', layer.type, layer.id, cluster)
    addGeoJSONSource(layer.type + '-source-' + layer.id, cluster)
    // add one source for km markers per geojson layer
    if (layer.type === 'geojson') {
      addGeoJSONSource('km-marker-source-' + layer.id, false)
    }
  })
}

// initialize layers: apply styles and load data
export async function initializeLayerStyles(id = null) {
  functions.e('#layer-reload', e => { e.classList.add('hidden') })
  functions.e('#layer-loading', e => { e.classList.remove('hidden') })
  initializeGeoJSONLayers(id)
  let overpassPromises = initializeOverpassLayers(id)
  let wikipediaPromises = initializeWikipediaLayers(id)

  await Promise.all(overpassPromises.concat(wikipediaPromises)).then(_results => {
    // re-sort layers after style changes
    sortLayers()
    functions.e('#layer-loading', e => { e.classList.add('hidden') })
  })
}

// triggered by layer reload in the layers modal
export function loadLayerData(id) {
  let layer = layers.find(l => l.id === id)
  // geojson layers are loaded in loadLayerDefinitions
  if (layer.type === 'wikipedia') {
    return loadWikipediaLayer(layer.id)
  } else if (layer.type === 'overpass') {
    return loadOverpassLayer(layer.id)
  }
}

// triggered by layer reload in the UI
export async function loadAllLayerData() {
  await Promise.all(layers.map((layer) => { return loadLayerData(layer.id) }))
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