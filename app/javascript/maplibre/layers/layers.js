import * as functions from 'helpers/functions'
import { resetLevels } from 'maplibre/controls/levels'
import { createLayerInstance } from 'maplibre/layers/factory'
import { map, setLoadedMapUpdatedAt, sortLayers } from 'maplibre/map'

export let layers // Layer instances: GeoJSONLayer, OverpassLayer, WikipediaLayer, BasemapLayer

// Cached promise to ensure initializeLayers only runs once
let initializePromise = null

// Layer setup workflow (three steps; initializeLayers() runs all three and is memoized):
//
// initializeLayers()  <- use this for normal setup
//   ├─> loadLayerDefinitions()   build Layer instances from summaries (from gon on initial
//   │                            load, or refetched from /m/:id.json). No sources/features yet.
//   ├─> initializeLayerSources() create the MapLibre source for every layer
//   └─> initializeLayerStyles()  for visible layers: apply styles + layer.initialize()
//                                └─> loadData() per layer type: GeoJSON streams its features
//                                    from the layer URL (MapLibre setData, read back via
//                                    getData); Overpass/Wikipedia query their APIs; Raster tiles
//
// Reconnect (map_channel.js) assembles these steps directly instead of calling
// initializeLayers(), to bypass memoization and force a refetch:
// loadLayerDefinitions({ refetch: true }) -> initializeLayerSources() -> initializeLayerStyles().

/**
 * Resets the initialization state when navigating to a new map.
 * This allows layers to be re-initialized from scratch.
 */
export function resetInitializationState() {
  if (layers) {
    layers.forEach(layer => layer.cleanup())
  }
  resetLevels()
  initializePromise = null
  layers = null
  setLoadedMapUpdatedAt(null)
}

// Clear the initializeLayers() memoization without tearing down existing layers, so a later
// initializeLayers() re-runs from scratch. Used on reconnect, which rebuilds layers directly.
export function resetLayerInitialization() {
  initializePromise = null
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
 * Loads layer definitions (summaries only; feature geometry loads per-layer from the
 * layer URL via GeoJSONLayer.loadData). On initial load these are embedded in gon, so no
 * request is needed. On reconnect, pass { refetch: true } to pull fresh state from the server.
 */
export function loadLayerDefinitions({ refetch = false } = {}) {
  layers = null

  const createLayers = (data) => {
    console.log('Loaded map layer definitions: ', data.layers)
    // make sure we're still showing the map the definitions came from
    if (window.gon.map_properties.public_id !== data.properties.public_id) { return }
    layers = data.layers.map(l => createLayerInstance(l))
    // Track the loaded map version so the channel reconnect handler can skip the heavy
    // reload when nothing changed while we were disconnected (see map_channel.js).
    setLoadedMapUpdatedAt(data.updated_at)
    window._layers = layers
    // console.log(`Map layers (${layers.length}) instantiated`)
  }

  if (!refetch && window.gon.map_layers) {
    createLayers({
      properties: window.gon.map_properties,
      updated_at: window.gon.map_updated_at,
      layers: window.gon.map_layers
    })
    return Promise.resolve()
  }

  const url = '/m/' + window.gon.map_id + '.json'
  return fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was: ' + response.status) }
      return response.json()
    })
    .then(data => {
      createLayers(data)
      // createLayers bails (leaving layers null) if we've since navigated to another map;
      // only announce the load when it actually happened.
      if (layers) {
        map.fire('layers.load', { detail: { message: `Map data (${layers.length} layers) loaded from server` } })
      }
    })
    .catch(error => {
      console.error('Failed to fetch map layers:', error)
      throw error
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
  if (!layers) {
    console.warn('initializeLayerSources called but layers not loaded yet')
    return
  }
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
  if (!layers) { console.warn('initializeLayerStyles called but layers not loaded yet'); return }

  let initLayers = layers.filter(l => l.show !== false)
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  // "Loading live layer" only applies to layers that refetch from an external API
  // (overpass/wikipedia); plain geojson layers shouldn't flash this banner.
  const hasLiveLayers = initLayers.some(l => l.reloadAfterMapMove() === 'ondemand')
  if (hasLiveLayers) {
    functions.e('#layer-reload', e => { e.classList.add('hidden') })
    functions.e('#layer-loading', e => { e.classList.remove('hidden') })
  }

  const promises = initLayers.map(layer => layer.initialize())

  // Hidden geojson layers aren't styled, but their feature data is still loaded so feature
  // lookups (deep links, onclick targets, undo) and layer feature counts work, matching the
  // pre-streaming behaviour when features were embedded in the map JSON. Overpass/Wikipedia
  // stay lazy because their loadData() hits external APIs.
  let dataOnlyLayers = layers.filter(l => l.show === false && l.type === 'geojson')
  if (id) { dataOnlyLayers = dataOnlyLayers.filter(l => l.id === id) }
  promises.push(...dataOnlyLayers.map(layer => layer.loadData()))

  await Promise.all(promises).then(results => {
    console.log('geojson source + styles loaded')
    // re-sort layers after style changes
    sortLayers()
    if (hasLiveLayers) {
      functions.e('#layer-loading', e => { e.classList.add('hidden') })
      // keep the reload frame open on failure so the user can retry
      if (results.some(result => result === false)) {
        functions.e('#layer-reload', e => { e.classList.remove('hidden') })
      }
    }
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
  const results = await Promise.all(layers.map((layer) => { return loadLayerData(layer.id) }))
  return results.some(result => result === false)
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

export function updateAnimatedFeature(feature, frameCount) {
  const layer = getLayer(feature.id)
  if (layer?.updateAnimatedFeature) {
    layer.updateAnimatedFeature(feature, frameCount)
  }
}

// Surgically update a single changed feature (and its companion geometry) on its layer,
// avoiding the full render()/setData path. See GeoJSONLayer.applyFeatureUpdate.
export function applyFeatureUpdate(feature, options) {
  const layer = getLayer(feature.id)
  if (layer?.applyFeatureUpdate) {
    layer.applyFeatureUpdate(feature, options)
  }
}

