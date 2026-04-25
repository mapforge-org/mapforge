import * as functions from 'helpers/functions'
import { createLayerInstance } from 'maplibre/layers/factory'
import { map, sortLayers } from 'maplibre/map'

export let layers // Layer instances: GeoJSONLayer, OverpassLayer, WikipediaLayer, BasemapLayer

// Cached promise to ensure initializeLayers only runs once
let initializePromise = null

/**
 * Resets the initialization state when navigating to a new map.
 * This allows layers to be re-initialized from scratch.
 */
export function resetInitializationState() {
  initializePromise = null
  layers = null
}

/**
 * Loads layer definitions from server and initializes them.
 * Combines loadLayerDefinitions(), initializeLayerSources(), and initializeLayerStyles()
 * into a single async operation. Returns Promise that resolves when all visible layers are ready.
 * Idempotent - safe to call multiple times, will only load once.
 */
export async function initializeLayers() {
  // Return cached promise if already initializing/initialized
  if (initializePromise) {
    return initializePromise
  }

  // Cache the promise so multiple calls don't re-initialize
  initializePromise = (async () => {
    await loadLayerDefinitions()
    initializeLayerSources()
    await initializeLayerStyles()

    // Set test helper attribute for backward compatibility
    functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })

    return layers
  })()

  return initializePromise
}

/**
 * Loads layer definitions from server.
 * Prefer using initializeLayers() for full initialization.
 */
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
      layers = data.layers.map(l => createLayerInstance(l))
      window._layers = layers
      map.fire('layers.load', { detail: { message: `Map data (${layers.length} layers) loaded from server` } })
    })
    .catch(error => {
      console.error('Failed to fetch map layers:', error)
    })
}

/**
 * Creates MapLibre sources for layers.
 * Sources are created for ALL layers (including hidden ones) because:
 * 1. Source creation is cheap (synchronous, no data loading)
 * 2. Enables efficient layer visibility toggling (reuse existing sources)
 * 3. Avoids recreating sources when showing/hiding layers
 *
 * @param {string|null} id - Optional layer ID to initialize only that layer's source
 */
export function initializeLayerSources(id = null) {
  let initLayers = layers
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  initLayers.forEach((layer) => {
    // console.log(`Adding source for ${layer.type} layer`, layer)
    layer.createSource()
  })
}

/**
 * Applies styles and loads data for visible layers only.
 * This is expensive (async API calls for Overpass/Wikipedia) so hidden layers are skipped.
 * When toggling visibility, this is called without initializeLayerSources() to reuse sources.
 *
 * @param {string|null} id - Optional layer ID to initialize only that layer's styles
 * @returns {Promise<void>} Promise that resolves when all layer styles are loaded
 */
export async function initializeLayerStyles(id = null) {
  functions.e('#layer-reload', e => { e.classList.add('hidden') })
  functions.e('#layer-loading', e => { e.classList.remove('hidden') })

  let initLayers = layers.filter(l => l.show !== false)
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  const promises = initLayers.map(layer => layer.initialize())

  await Promise.all(promises).then(_results => {
    map.fire('geojson.load', { detail: { message: 'geojson source + styles loaded' } })
    // re-sort layers after style changes
    sortLayers()
    functions.e('#layer-loading', e => { e.classList.add('hidden') })
  })
}

// triggered by layer reload in the layers modal
export function loadLayerData(id) {
  let layer = layers.find(l => l.id === id)
  if (layer.show === false) {
    console.log("Skipped loading data for not shown layer", layer)
    return Promise.resolve()
  }

  functions.e(`#layer-list-${id} .reload-icon`, e => { e.classList.add('layer-refresh-animate') })
  functions.e('#layer-loading', e => { e.classList.remove('hidden') })

  return layer.loadData().then((result) => {
    functions.e(`#layer-list-${id} .reload-icon`, e => { e.classList.remove('layer-refresh-animate') })
    return result
  })
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
    return layer.sourceId
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

// Convenience functions for consumers

export function renderLayer(id, ...args) {
  const layer = layers.find(l => l.id === id)
  if (layer) { layer.render(...args) }
}

export function renderLayers(type, ...args) {
  layers.filter(l => l.type === type).forEach(l => l.render(...args))
}

export function renderAnimationFrame(feature, frameCount) {
  const layer = getLayer(feature.id)
  if (layer?.renderAnimationFrame) {
    layer.renderAnimationFrame(feature, frameCount)
  }
}
