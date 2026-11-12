import equal from 'fast-deep-equal'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { AnimatePointAnimation } from 'maplibre/animations'
import { resetLevels } from 'maplibre/controls/levels'
import { featureLabel, resetHighlightedFeature } from 'maplibre/feature'
import { BasemapLayer } from 'maplibre/layers/basemap'
import { GeoJSONLayer } from 'maplibre/layers/geojson'
import { hasKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { hasRouteExtras } from 'maplibre/layers/geojson/route_extras'
import { IndoorLayer } from 'maplibre/layers/indoor/indoor'
import { Layer } from 'maplibre/layers/layer'
import { OsmLayer } from 'maplibre/layers/osm'
import { OverpassLayer } from 'maplibre/layers/overpass/overpass'
import { RasterLayer } from 'maplibre/layers/raster/raster'
import { WikipediaLayer } from 'maplibre/layers/wikipedia'
import { map, removeGeoJSONSource, removeStyleLayers, setLayerVisibility, setLoadedMapUpdatedAt, sortLayers } from 'maplibre/map'

export let layers // Layer instances, one class per type in layerTypes
let activeLayerId = null // geojson layer that receives new features, per browser session

// Cached promise to ensure initializeLayers only runs once
let initializePromise = null

const layerTypes = {
  geojson: GeoJSONLayer,
  overpass: OverpassLayer,
  wikipedia: WikipediaLayer,
  basemap: BasemapLayer,
  osm: OsmLayer,
  raster: RasterLayer,
  indoor: IndoorLayer
}

export function createLayerInstance(data) {
  const LayerClass = layerTypes[data.type] || Layer
  return new LayerClass(data)
}

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
  activeLayerId = null
  initializePromise = null
  layers = null
  setLoadedMapUpdatedAt(null)
}

/**
 * Loads layer definitions from server and initializes them.
 * Combines loadLayerDefinitions(), initializeLayerSources(), and initializeLayerStyles()
 * into a single async operation. Returns Promise that resolves when all visible layers are ready.
 * Idempotent - safe to call multiple times, will only load once.
 */
export function initializeLayers() {
  return (initializePromise ||= (async () => {
    await loadLayerDefinitions()
    initializeLayerSources()
    await initializeLayerStyles()

    // Set test helper attribute for backward compatibility
    functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })

    return layers
  })())
}

/**
 * Loads layer definitions (summaries only; feature geometry loads per-layer from the
 * layer URL via GeoJSONLayer.loadData). On initial load these are embedded in gon, so no
 * request is needed. On reconnect, pass { refetch: true } to pull fresh state from the server.
 */
export function loadLayerDefinitions({ refetch = false } = {}) {
  // The old sources keep drawing their features, so the new instances inherit them.
  // Otherwise a failed reload leaves the list at 0 while the map still shows them.
  const previousGeojson = new Map((layers || []).map(l => [l.id, l.layer.geojson]))
  layers = null

  const createLayers = (data) => {
    console.log('Loaded map layer definitions: ', data.layers)
    // make sure we're still showing the map the definitions came from
    if (window.gon.map_properties.public_id !== data.properties.public_id) { return }
    layers = data.layers.map(l => createLayerInstance(l))
    layers.forEach(l => {
      const previous = previousGeojson.get(l.id)
      if (previous && !l.layer.geojson) { l.geojson = previous }
    })
    // Track the loaded map version so the channel reconnect handler can skip the heavy
    // reload when nothing changed while we were disconnected (see map_channel.js).
    setLoadedMapUpdatedAt(data.updated_at)
    window._layers = layers
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

  initLayers.forEach(layer => layer.createSource())
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
  // (overpass/wikipedia); plain geojson layers shouldn't flash this banner. Checked by type
  // rather than reloadAfterMapMove(), which is false for overpass layers with a hardcoded
  // bbox even though they still fetch live data on initial load.
  const hasLiveLayers = initLayers.some(l => l.type === 'overpass' || l.type === 'wikipedia')
  // On the initial load the preloader covers the map, so the badge would only flicker there.
  const mapLoaded = document.querySelector('.map')?.getAttribute('data-map-loaded') === 'true'
  if (hasLiveLayers && mapLoaded) { setLayerLoading(true) }

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
    if (hasLiveLayers) { setLayerLoading(false, results.some(result => result === false)) }
  })
}

// Takes a layer off the map and out of the list: on delete, on its undo or redo, and on a remote delete
export function removeLayer(layer) {
  layer.cleanup()
  layers.splice(layers.indexOf(layer), 1)
  removeGeoJSONSource(layer.sourceId)
}

// Puts the show setting of a layer on the map, with rebuild after a change of its settings.
// initialize() re-adds the style layers as visible, so a hidden layer is never initialized, and
// overpass and wikipedia would fetch their data for nothing. A hidden layer drops its outdated
// style layers instead, and its next show rebuilds them (see toggleLayerVisibility).
export async function applyLayerVisibility(layer, rebuild = true) {
  if (layer.show === false) {
    if (rebuild) { removeStyleLayers(layer.sourceId) }
    setLayerVisibility(layer.sourceId, false)
    return
  }
  if (rebuild) { await initializeLayerStyles(layer.id) }
  // some layer types add style layers only when their data loads, and a hide can come meanwhile
  setLayerVisibility(layer.sourceId, layer.show !== false)
}

// keeps the reload frame open on failure so the user can retry. Success leaves it alone,
// because a drag during the request reopens it for the new viewport.
export function setLayerLoading (busy, failed = false) {
  functions.e('#layer-loading', e => { e.classList.toggle('hidden', !busy) })
  if (busy || failed) { functions.e('#layer-reload', e => { e.classList.toggle('hidden', busy) }) }
}

// triggered by layer reload in the layers modal
export function loadLayerData(id) {
  const layer = layers.find(l => l.id === id)
  if (!layer) { return Promise.resolve() }
  if (layer.show === false) {
    console.log("Skipped loading data for not shown layer", layer)
    return Promise.resolve()
  }

  functions.e(`#layer-list-${id} .reload-icon`, e => { e.classList.add('layer-refresh-animate') })

  return layer.loadData().then((result) => {
    functions.e(`#layer-list-${id} .reload-icon`, e => { e.classList.remove('layer-refresh-animate') })
    return result
  })
}

// triggered by "Load for this area", so only layers whose data depends on the viewport
export async function loadAllLayerData() {
  const viewportLayers = layers.filter(l => l.reloadAfterMapMove() === 'ondemand')
  const results = await Promise.all(viewportLayers.map(layer => loadLayerData(layer.id)))
  return results.some(result => result === false)
}

export function getFeature(id, type = null) {
  const layer = getLayer(id, type)
  return layer ? layer.geojson.features.find(f => f.id === id) : null
}

export function hasFeatures(type = 'geojson') {
  return layers.some(l => l.type === type && l.geojson?.features?.length > 0)
}

export function getFeatureSource(featureId) {
  return getLayer(featureId)?.sourceId || null
}

// ponytail: linear scan over every feature, an id -> layer Map if animations or big maps show it
export function getLayer(featureId, type = null) {
  return layers.find(l => (!type || l.type === type) && l.layer.geojson?.features?.some(f => f.id === featureId)) || null
}

// Convenience functions for consumers

export function renderLayer(id, ...args) {
  const layer = layers.find(l => l.id === id)
  if (layer) { layer.render(...args) }
}

export function renderLayers(type, ...args) {
  layers.filter(l => l.type === type).forEach(l => l.render(...args))
}

export function updateAnimatedFeature(feature) {
  const layer = getLayer(feature.id)
  if (layer?.updateAnimatedFeature) {
    layer.updateAnimatedFeature(feature)
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

export function upsert (updatedFeature, layerId) {
  const feature = getFeature(updatedFeature.id)
  if (!feature) { addFeature(updatedFeature, layerId); return }
  if (layerId) { moveFeature(feature, layerId) }

  // only update feature if it was changed, disregarding properties.id on both sides
  // (the server now includes it for MapLibre's promoteId, so it isn't a meaningful diff)
  const { id: _existingId, ...existingProperties } = feature.properties
  const { id: _incomingId, ...incomingProperties } = updatedFeature.properties
  if (!equal(feature.geometry, updatedFeature.geometry) || !equal(existingProperties, incomingProperties)) {
    updateFeature(feature, updatedFeature)
  }
}

// A feature on a hidden layer looks lost, so a hidden layer is only the last resort. The fallback
// also applies when none was picked or the picked one got deleted.
export function activeLayer () {
  const geojsonLayers = layers?.filter(l => l.type === 'geojson') || []
  const visible = geojsonLayers.filter(l => l.show !== false)
  return visible.find(l => l.id === activeLayerId) || visible[0] || geojsonLayers[0]
}

export function setActiveLayer (id) {
  activeLayerId = id
  const name = activeLayer()?.name || window.__('Layer elements')
  status(window.__('New features go to layer %{name}').replace('%{name}', functions.escapeHtml(name)))
}

export function addFeature (feature, layerId) {
  feature.properties.id = feature.id
  // A remote feature carries its layer id; local edits have none and go to the active layer
  const layer = layers?.find(l => l.type === 'geojson' && l.id === layerId) || activeLayer()
  if (!layer) {
    console.error('No geojson layer to add feature ' + feature.id + ' to')
    return
  }
  layer.geojson.features.push(feature)
  // Surgical single-feature add instead of a full re-render of every geojson layer.
  layer.applyFeatureAdd(feature)
  if (!layerId && layer.show === false) {
    status(window.__('Layer %{name} is hidden, so the new element is not visible')
      .replace('%{name}', functions.escapeHtml(layer.name)), 'warning')
    return
  }
  status(window.__('%{type} added').replace('%{type}', featureLabel(feature)))
}

// feature id -> AnimatePointAnimation, so each marker keeps its own timing and a new
// position cancels only that marker's in-flight animation
const pointAnimations = new Map()

function updateFeature (feature, updatedFeature) {
  const newCoords = updatedFeature.geometry.coordinates
  const animateFrom = feature.geometry.type === 'Point' && !equal(feature.geometry.coordinates, newCoords)
    ? feature.geometry.coordinates
    : null
  const hadRouteExtras = hasRouteExtras(feature)
  const hadKmMarkers = hasKmMarkers(feature)

  feature.geometry = updatedFeature.geometry
  feature.properties = updatedFeature.properties

  if (animateFrom) {
    // Hold the marker where it currently is and let the animation walk it to newCoords. Without
    // this the render below slams it onto the target and the first animation frame pulls it back.
    feature.geometry.coordinates = animateFrom
    let animation = pointAnimations.get(feature.id)
    if (!animation) {
      animation = new AnimatePointAnimation()
      pointAnimations.set(feature.id, animation)
    }
    animation.animateTo(feature, newCoords)
  }

  status(window.__('%{type} updated').replace('%{type}', featureLabel(feature)))
  // Surgical single-feature update instead of a full re-render of every geojson layer.
  // A remote update may have changed geometry or toggled companions, so refresh them when the
  // feature had or has them. A GPS tracker point has none, and a rebuild walks every route.
  // (A remote change to a feature's level won't re-filter here — that needs a full render.)
  applyFeatureUpdate(feature, {
    refreshRouteExtras: hadRouteExtras || hasRouteExtras(feature),
    refreshKmMarkers: hadKmMarkers || hasKmMarkers(feature)
  })
}

export function moveFeature (feature, layerId) {
  const from = getLayer(feature.id)
  const to = layers.find(l => l.type === 'geojson' && l.id === layerId)
  if (!from || !to || from === to) { return }
  from.geojson.features = from.geojson.features.filter(f => f.id !== feature.id)
  from.applyFeatureRemove(feature)
  to.geojson.features.push(feature)
  to.applyFeatureAdd(feature)
}

export function destroyFeature (featureId) {
  const layer = getLayer(featureId)
  const feature = layer?.geojson.features.find(f => f.id === featureId)
  if (feature) {
    status(window.__('Deleting %{type}').replace('%{type}', featureLabel(feature)))
    layer.geojson.features = layer.geojson.features.filter(f => f.id !== featureId)
    // Surgical single-feature remove instead of a full re-render of every geojson layer.
    layer.applyFeatureRemove(feature)
    resetHighlightedFeature()
  }
}

// moves the feature to the end of the features of its layer
export function frontFeature(frontFeature) {
  const layer = getLayer(frontFeature.id)
  if (!layer) { return }
  const features = layer.geojson.features
  const idx = features.findIndex(f => f.id === frontFeature.id)
  if (idx === features.length - 1) { return }
  const [feature] = features.splice(idx, 1)
  features.push(feature)
  layer.bringToFront(feature)
}

