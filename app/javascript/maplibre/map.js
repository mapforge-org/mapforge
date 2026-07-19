import { centroid } from "@turf/centroid";
import { sendMessage } from 'channels/map_channel';
import equal from 'fast-deep-equal'; // https://github.com/epoberezkin/fast-deep-equal
import * as dom from 'helpers/dom';
import * as functions from 'helpers/functions';
import { status } from 'helpers/status';
import maplibregl from 'maplibre-gl';
import { AnimateLineAnimation, AnimatePointAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations';
import { hideContextMenu, initContextMenu } from 'maplibre/controls/context_menu';
import { isGeolocateFollowModeActive } from 'maplibre/controls/geolocate';
import { initLevelFromURL } from 'maplibre/controls/levels';
import { hideModals, initCtrlTooltips, initializeDefaultControls, initSettingsModal, resetControls } from 'maplibre/controls/shared';
import { initializeViewControls } from 'maplibre/controls/view';
import { resetEditMode } from 'maplibre/edit';
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature';
import { applyFeatureUpdate, getFeature, getLayer, initializeLayers, initializeLayerSources, initializeLayerStyles, layers } from 'maplibre/layers/layers';
import { basemaps, defaultFont, demSource, elevationSource } from 'maplibre/styles/basemaps';
import { clearImageState, loadImage, setStyleDefaultFont } from 'maplibre/styles/styles';

export let map
export let mapProperties
export let lastMousePosition
export let backgroundMapLayer

// Server `updated_at` of the map data currently held in memory. Compared on socket
// reconnect (against the freshly fetched value) to decide whether a full, main-thread
// -blocking reload is actually needed. Set on every full (re)load of the map data.
export let loadedMapUpdatedAt = null
export function setLoadedMapUpdatedAt (value) { loadedMapUpdatedAt = value }

let mapInteracted
let backgroundTerrain
let backgroundHillshade
let backgroundGlobe
let backgroundContours

// Workflow of map loading:
//
// initializeMap()
//   └─> setBackgroundMapLayer()
//       └─> 'style.load' event
//           ├─> initializeDefaultControls() (once)
//           └─> initializeStyles()
//               ├─> First load: await initializeLayers() (idempotent, returns cached promise if called again)
//               │   └─> loadLayerDefinitions() → initializeLayerSources() → await initializeLayerStyles() → sets data-geojson-loaded
//               └─> Basemap change: initializeLayerSources() + await initializeLayerStyles()
//
// map 'load' event
//   └─> await initializeLayers() (if needed for URL feature - returns cached promise if already loaded)
//       └─> Handle URL feature selection (highlight/animate/center)

export function initializeMaplibreProperties () {
  const lastProperties = JSON.parse(JSON.stringify(mapProperties || {}))
  mapProperties = window.gon.map_properties
  if (mapProperties && !equal(lastProperties, mapProperties)) {
    console.log('Update map properties:', mapProperties)
    updateMapName(mapProperties.name)
    initSettingsModal()
    status('Map properties updated')
    // initial load
    if (Object.keys(lastProperties).length === 0 || !mapProperties) { return }
    // animate to new view if map had no interaction yet and not in geolocate follow mode
    if (!mapInteracted && !isGeolocateFollowModeActive()) { animateViewFromProperties() }
    return true
  }
  return false
}

export async function initializeMap (divId = 'maplibre-map') {
  backgroundMapLayer = null

  // Initialize level from URL FIRST, before any layer initialization
  // This ensures the level is set before style.load triggers initializeLayers
  initLevelFromURL()

  initializeMaplibreProperties()
  resetEditMode()
  // TODO: This will only work with maplibre 5.25 (https://github.com/maplibre/maplibre-gl-js/pull/7735)
  // document.fonts.load("24px 'SUSE'")
  map = new maplibregl.Map({
    container: divId,
    center: (mapProperties.center || mapProperties.default_center),
    zoom: (mapProperties.zoom || mapProperties.default_zoom), // will zoom in on map:load
    pitch: mapProperties.pitch,
    bearing: mapProperties.bearing || 0,
    maxPitch: 72,
    maxZoom: 24, // hard limit of maplibre
    maplibreLogo: true,
    hash: true, // enable hash in URL for map center/zoom
    fadeDuration: 200, // shorter fade
    interactive: (window.gon.map_mode !== 'static') // can move/zoom map
    // style: {} // style/map is getting loaded by 'setBackgroundMapLayer'
  })

  if (!functions.isTestEnvironment()) { map.setZoom(map.getZoom() - 1) } // will zoom in on map:load

  // for console debugging
  window.map = map
  window.maplibregl = maplibregl

  if (!!mapProperties.description?.trim()) { dom.showElements('#description-modal') }

  map.on('styleimagemissing', loadImage)

  // TODO: remove once https://github.com/maplibre/maplibre-gl-js/issues/7752 is fixed (5.25)
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('Out of bounds') &&
        event.error?.stack?.includes('loadMatchingFeature')) {
      console.warn('Swallowed MapLibre #7752 queryRenderedFeatures race')
      event.preventDefault()
    }
  })

  // NOTE: map 'load' can happen before layers are loaded when loading features is slow
  map.once('load', async function (_e) {
    // trigger map fade-in
    dom.animateElement('.map', 'fade-in', 250)
    initCtrlTooltips()
    functions.e('.maplibregl-ctrl button', e => {
      e.setAttribute('data-toggle', 'tooltip')
      e.setAttribute('data-bs-trigger', 'hover')
    })
    dom.initTooltips()
    functions.e('#preloader', e => { e.classList.add('hidden') })
    functions.e('.map', e => { e.setAttribute('data-map-loaded', true) })

    // Wait for layers to be loaded before accessing features
    // Safe to call even if already triggered by style.load — returns the cached promise, no double loading
    await initializeLayers()

    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    let feature
    if (urlFeatureId && (feature = getFeature(urlFeatureId))) {
      resetControls()
      highlightFeature(feature, true)
      const center = centroid(feature)
      map.setCenter(center.geometry.coordinates) // set center before zooming in animation
    }

    if (!functions.isTestEnvironment()) { map.easeTo({ zoom: map.getZoom() + 1, duration: 1000 })} // zoom in to configured zoom level
    console.log("Map loaded ('load')")

    // Set idle marker for screenshot task — fires after all animations complete and tiles load
    map.once('idle', () => {
      functions.e('.map', e => { e.setAttribute('data-map-idle', true) })
    })

    const urlFeatureAnimateId = new URLSearchParams(window.location.search).get('a')
    if (urlFeatureAnimateId && (feature = getFeature(urlFeatureAnimateId))) {
      console.log('Animating ' + feature.id)
      resetControls()
      if (feature.geometry.type === 'LineString') {
        new AnimateLineAnimation().run(feature)
      } else if (feature?.geometry?.type === 'Polygon') {
        new AnimatePolygonAnimation().run(feature)
      } else {
        console.error('Feature to animate ' + animateFeatureId + ' not found!')
      }
      animateViewFromProperties()
    }
  })

  map.on('mousemove', (e) => { updateCursorPosition(e) })
  map.on('touchend', (e) => { updateCursorPosition(e) })
  map.on('drag', () => {
    mapInteracted = true
    hideModals()
    if (layers && layers.filter(l => l.reloadAfterMapMove() === 'ondemand' && l.show !== false).length) {
      dom.animateElement('#layer-reload', 'fade-in')
    }
  })
  map.on('zoom', (e) => {
    limitZoom()
    if (e.originalEvent) { hideModals() } // ignore programmatic zoom (e.g. initial zoom-in effect)
  })
  map.on('online', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', true) }) })
  map.on('offline', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', false) }) })

  map.on('contextmenu', (e) => {
    e.preventDefault()
    // menu gets unhidden only when there are buttons
    initContextMenu(e)
    map.once('zoom', (_e) => { hideContextMenu() })
    map.once('rotate', (_e) => { hideContextMenu() })
    map.once('drag', (_e) => { hideContextMenu() })
  })

  // Long-press support for touch devices
  if (functions.isTouchDevice()) {
    let longPressTimer = null
    let longPressStartPoint = null
    const cancelLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer)
      longPressTimer = null
      longPressStartPoint = null
    }

    map.on('touchstart', (e) => {
      if (e.originalEvent.touches.length > 1) return cancelLongPress() // Cancel on multi-touch
      longPressStartPoint = e.point
      longPressTimer = setTimeout(() => {
        map.fire('contextmenu', {
          point: longPressStartPoint,
          lngLat: map.unproject(longPressStartPoint),
          preventDefault: () => {}
        })
        map.longPressTriggered = true
        cancelLongPress()
      }, 500)
    })

    map.on('touchmove', (e) => {
      if (!longPressTimer) return
      const dx = Math.abs(e.point.x - longPressStartPoint.x)
      const dy = Math.abs(e.point.y - longPressStartPoint.y)
      if (dx > 10 || dy > 10) cancelLongPress()
    })

    map.on('touchend', () => {
      cancelLongPress()
      setTimeout(() => { map.longPressTriggered = false }, 0)
    })
  }

  // map.on('error', (err) => {
  //   console.log('map error >>> ', err)
  // })
}

function limitZoom() {
  if (!layers) { return }

  const style = map.getStyle()
  const rasterSource = Object.entries(style.sources)
    .find(([name, _source]) => (name === 'raster-tiles' || name === 'satellite'))
  const maxZoom = rasterSource ? rasterSource[1].maxzoom : null
  const minZoom = rasterSource ? rasterSource[1].minzoom : null

  // block zooming in closer than defined max zoom level
  if (maxZoom && (map.getZoom() > maxZoom - 0.2)) {
    map.setZoom(maxZoom - 0.2)
    status('Maximum zoom level ' + maxZoom + ' reached', 'info', 'medium', 1000)
  }
  if (minZoom && (map.getZoom() < minZoom + 0.2)) {
    map.setZoom(minZoom + 0.2)
    status('Minimum zoom level ' + minZoom + ' reached', 'info', 'medium', 1000)
  }
}

function updateCursorPosition(e) {
  lastMousePosition = e.lngLat
  if (window.gon.map_mode === 'rw' && window.gon.map_properties.share_cursor) {
    const coords = e.lngLat
    functions.throttle(() => {
      sendMessage('mouse', { lng: coords.lng, lat: coords.lat })
    }, 'mouse', 100)
  }
}

// Each map layer has its own source, so different style layers can be applied
// sourceName convention: layer.type + '-source-' + layer.id
export function addGeoJSONSource(sourceName, cluster=false) {
  // https://maplibre.org/maplibre-style-spec/sources/#geojson
  // console.log("Adding source: " + sourceName)
  if (map.getSource(sourceName)) {
    console.log('Source ' + sourceName + ' already exists, re-using it')
    return
  }
  map.addSource(sourceName, {
    type: 'geojson',
    promoteId: 'id',
    data: { type: 'FeatureCollection', features: [] },
    cluster: cluster,
    clusterMaxZoom: 14,
    clusterRadius: 50
  })
}

export function removeStyleLayers(sourceName) {
  const style = map.getStyle()
  if (style?.layers) {
    // Remove all layers that use this source
    style.layers
      .filter(l => l.source === sourceName)
      .forEach(l => {
        if (map.getLayer(l.id)) map.removeLayer(l.id)
      })
  }
}

export function setLayerVisibility(sourceName, visible) {
  const style = map.getStyle()
  if (style?.layers) {
    const sources = [sourceName]
    // geojson layers have companion sources for km-markers and route extras
    if (sourceName.startsWith('geojson-source-')) {
      sources.push(sourceName.replace('geojson-source-', 'km-marker-source-'))
      sources.push(sourceName.replace('geojson-source-', 'route-extras-source-'))
      sources.push(sourceName.replace('geojson-source-', 'extrusion-source-'))
    }
    // raster layers with waymarkedtrails have companion sources for clicked routes
    if (sourceName.startsWith('raster-source-')) {
      sources.push(sourceName + '-features')
    }
    style.layers
      .filter(l => sources.includes(l.source))
      .forEach(l => {
        if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', visible ? 'visible' : 'none')
      })
  }
}

export function removeGeoJSONSource(sourceName) {
  removeStyleLayers(sourceName)
  if (map.getSource(sourceName)) {
    map.removeSource(sourceName)
  }
}

export function reloadMapProperties () {
  const host = new URL(window.location.href).origin
  const url = host + '/m/' + window.gon.map_id + '/properties'
  return fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was not ok') }
      return response.json()
    })
    .then(data => {
      // console.log('reloaded map properties', data)
      window.gon.map_properties = data.properties
      window.gon.map_updated_at = data.updated_at
    })
    .catch(error => { console.error('Failed to fetch map properties', error) })
}

function addTerrain () {
  if (backgroundMapLayer === 'test') { return }
  map.addSource('map-terrain', elevationSource)
  map.setTerrain({
    source: 'map-terrain',
    exaggeration: 0.05
  })
  status('Terrain added to map')
}

function addHillshade () {
  if (backgroundMapLayer === 'test') { return }
  map.addSource('map-hillshade', elevationSource)
  map.addLayer({
    id: 'hills',
    type: 'hillshade',
    source: 'map-hillshade',
    layout: { visibility: 'visible' },
    paint: {
      "hillshade-method": "standard",
      'hillshade-shadow-color': '#473B24',
      "hillshade-exaggeration": 0.2
    }
  })
  status('Hillshade added to map')
}

function addContours () {
  if (backgroundMapLayer === 'test') { return }
  map.addSource('map-contours', {
    type: "vector",
    tiles: [
      demSource.contourProtocolUrl({
        thresholds: {
          // zoom: [minor, major]
          10: [200, 400],
          11: [200, 400],
          12: [100, 200],
          13: [100, 200],
          14: [50, 100],
          15: [20, 100],
        },
        elevationKey: "ele",
        levelKey: "level",
        contourLayer: "contours",
        buffer: 1,
        overzoom: 2
      }),
    ],
    maxzoom: 16,
  })
  map.addLayer({
    id: "contours",
    type: "line",
    source: "map-contours",
    "source-layer": "contours",
    paint: {
      "line-color": "rgba(0,0,0, 50%)",
      "line-width": ["match", ["get", "level"], 1, 1, 0.5],
    },
    layout: {
      "line-join": "round",
    },
  })
  map.addLayer({
    id: "contour-text",
    type: "symbol",
    source: "map-contours",
    "source-layer": "contours",
    filter: [">", ["get", "level"], 0],
    paint: {
      "text-halo-color": "white",
      "text-halo-width": 1,
    },
    layout: {
      "symbol-placement": "line",
      "text-anchor": "center",
      "text-size": 11,
      "text-field": [
        "concat",
        ["number-format", ["get", "ele"], {}],
        "m",
      ],
      "text-font": [basemaps()[mapProperties.base_map].font || defaultFont]
    }
  })
  status('Contour lines added to map')
}

function addGlobe () {
  // https://maplibre.org/maplibre-style-spec/projection/
  map.setProjection({ type: 'globe' })
  // see https://maplibre.org/maplibre-gl-js/docs/examples/sky-with-fog-and-terrain/
  map.setSky({
    'atmosphere-blend': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 1,
      5, 1,
      7, 0
    ]
  })
}

export function initializeStaticMode () {
  functions.e('.maplibregl-ctrl-attrib, #map-head', e => { e.classList.add('hidden') })
}

export function initializeViewMode () {
  map.once('style.load', () => {
    initializeViewControls()
    initializeDefaultControls()
  })
  onMapClickAfterLayers(() => { resetControls() })
}

// Registers a click handler that runs AFTER all synchronous layer-specific
// click handlers, even ones registered later (including dynamically). Skips
// the callback if any handler called e.preventDefault().
export function onMapClickAfterLayers(callback) {
  map.on('click', (e) => {
    // queueMicrotask executes after the current task, after
    // every sync click handler (layer-specific or not)
    queueMicrotask(() => {
      if (e.defaultPrevented) return
      callback(e)
    })
  })
}

export function upsert (updatedFeature) {
  const feature = getFeature(updatedFeature.id)
  if (!feature) { addFeature(updatedFeature); return }

  // only update feature if it was changed, disregarding properties.id on both sides
  // (the server now includes it for MapLibre's promoteId, so it isn't a meaningful diff)
  const existingFeature = JSON.parse(JSON.stringify(feature))
  const incomingFeature = JSON.parse(JSON.stringify(updatedFeature))
  delete existingFeature.properties.id
  delete incomingFeature.properties.id
  if (!equal(existingFeature, incomingFeature)) {
    updateFeature(feature, updatedFeature)
  }
}

export function addFeature (feature) {
  feature.properties.id = feature.id
  // Adding new features to the first geojson layer
  const layer = layers.find(l => l.type === 'geojson')
  layer.geojson.features.push(feature)
  // Surgical single-feature add instead of a full re-render of every geojson layer.
  layer.applyFeatureAdd(feature)
  status('Added feature')
}

function updateFeature (feature, updatedFeature) {
  if (feature.geometry.type === 'Point') {
    const newCoords = updatedFeature.geometry.coordinates
    if (!equal(feature.geometry.coordinates, newCoords)) {
      const animation = new AnimatePointAnimation()

      // Wait for data-geojson-loaded='true' before starting animation
      const checkReady = () => {
        if (map.getContainer().getAttribute('data-geojson-loaded') === 'true') {
          animation.animatePoint(feature, newCoords)
        } else {
          // Check again on next frame
          requestAnimationFrame(checkReady)
        }
      }
      requestAnimationFrame(checkReady)
    }
  }

  feature.geometry = updatedFeature.geometry
  feature.properties = updatedFeature.properties
  status('Updated feature \'' + feature.properties.title || feature.id + '\'')
  // Surgical single-feature update instead of a full re-render of every geojson layer.
  // A remote update may have changed geometry or toggled companions, so refresh them.
  // (A remote change to a feature's level won't re-filter here — that needs a full render.)
  applyFeatureUpdate(feature, { refreshRouteExtras: true, refreshKmMarkers: true })
}

export function destroyFeature (featureId) {
  const feature = getFeature(featureId)
  if (feature) {
    status('Deleting feature ' + featureId)
    const layer = getLayer(featureId)
    layer.geojson.features = layer.geojson.features.filter(f => f.id !== featureId)
    // Surgical single-feature remove instead of a full re-render of every geojson layer.
    layer.applyFeatureRemove(feature)
    resetHighlightedFeature()
  }
}

// after basemap style is ready/changed, init layers + load their data if needed
async function initializeStyles() {
  console.log('Initializing sources and layer styles after basemap load/change')

  // Add terrain/hillshade/contours FIRST so they're in the base layer group
  // when sortLayers() runs, keeping them below user GeoJSON features
  demSource.setupMaplibre(maplibregl)
  if (mapProperties.terrain) { addTerrain() }
  if (mapProperties.hillshade) { addHillshade() }
  if (mapProperties.globe) { addGlobe() }
  if (mapProperties.contours) { addContours() }

  // First load: initialize layers (loads definitions, creates sources, loads styles/data)
  // Subsequent calls: re-initialize sources and styles (basemap change removes all sources/layers)
  if (!layers) {
    await initializeLayers()
  } else {
    initializeLayerSources()
    await initializeLayerStyles()
  }
}

// Returns true if a basemap reload was triggered (caller can rely on the
// style.load handler to re-initialize layer sources/styles), false otherwise.
export function setBackgroundMapLayer (mapName = mapProperties.base_map, force = false) {
  if (backgroundMapLayer === mapName &&
      backgroundTerrain === mapProperties.terrain &&
      backgroundHillshade === mapProperties.hillshade &&
      backgroundContours === mapProperties.contours &&
      backgroundGlobe === mapProperties.globe && !force) { return false }
  let basemap = basemaps()[mapName]
  if (!basemap) {
    console.error('Base map ' + mapName + ' not available!')
    basemap = basemaps()['osmRasterTiles']
  }
  if (basemap) {
    map.once('style.load', async () => {
      status('Loaded base map ' + mapName)
      // on map style change, all sources and layers are removed, so we need to re-initialize them
      await initializeStyles()
      limitZoom()
    })
    backgroundMapLayer = mapName
    backgroundTerrain = mapProperties.terrain
    backgroundHillshade = mapProperties.hillshade
    backgroundContours = mapProperties.contours
    backgroundGlobe = mapProperties.globe
    setStyleDefaultFont(basemap.font || defaultFont)
    // Clear image cache so icons can be re-loaded after basemap change
    clearImageState()
    map.setStyle(basemap.style, { diff: true, strictMode: true })
    return true
  }
  return false
}

export function updateBuildingOpacity () {
  if (!map || !map.isStyleLoaded()) return

  const opacity = layers?.some(l => l.type === 'indoor' && l.levelControl) ? 0.4 : 0.6
  if (map.getLayer('building-3d')) {
    map.setPaintProperty('building-3d', 'fill-extrusion-opacity', opacity)
  } else if (map.getLayer('Building 3D')) {
    map.setPaintProperty('Building 3D', 'fill-extrusion-opacity', opacity)
  }
}

// re-sort layers to overlay geojson layers with labels & extrusion objects
// workflows to consider: first map load, basemap update, socket reconnect
// sorting (bottom to top):
// - raster overlays
// - polygons, lines etc.
// - map labels
// - extrusions
// - points
// - text/symbol
//
// Uses map.moveLayer() instead of map.setStyle() to avoid map freeze: a setStyle
// here on top of the basemap setStyle in setBackgroundMapLayer left interaction
// handlers attached to a stale canvas after a reconnect/background restore.
export function sortLayers () {
  const styleLayers = map.getStyle().layers

  updateBuildingOpacity()

  // Each entry is a layer group; groups are listed bottom-to-top. mapSymbols
  // excludes user symbol/label layers since the original mutating logic pulled
  // those out before computing mapSymbols.
  const groups = [
    styleLayers.filter(e => e.id.startsWith('raster-layer_')), // raster overlays below all geojson layers
    styleLayers.filter(e => e.id.startsWith('polygon-layer_geojson-source') && !e.id.includes('extrusion') && !e.id.includes('shadow')),
    styleLayers.filter(e => e.id.startsWith('polygon-layer-outline_geojson-source')),
    styleLayers.filter(e => e.id.includes('-flat')), // keep flat layers behind houses
    styleLayers.filter(e => e.id.startsWith('line-layer-outline_geojson-source')),
    styleLayers.filter(e => e.id.startsWith('line-layer_geojson-source') && !e.id.includes('outline')),
    styleLayers.filter(e => e.id.includes('route-extras-source') && !e.id.startsWith('route-extras-labels')),
    styleLayers.filter(e => e.paint && e.paint['fill-extrusion-height'] && e.id.startsWith('polygon-layer-extrusion')),
    // styleLayers.filter(e => e.id.startsWith('indoor-area-extrusion_')),
    styleLayers.filter(e => e.paint && e.paint['fill-extrusion-height'] && !e.id.startsWith('polygon-layer-extrusion') && !e.id.startsWith('indoor-area-extrusion_')),
    styleLayers.filter(e => e.id.startsWith('maplibre-gl-directions')),
    styleLayers.filter(e => e.type === 'symbol' &&
      !e.id.startsWith('symbols-layer') && !e.id.startsWith('symbols-border-layer') &&
      !e.id.startsWith('text-layer') && !e.id.startsWith('cluster_labels')),
    styleLayers.filter(e => e.id.startsWith('points-layer') || e.id.startsWith('cluster_points')),
    styleLayers.filter(e => e.id.startsWith('heatmap-layer')),
    styleLayers.filter(e => e.id.startsWith('gl-draw-')),
    styleLayers.filter(e => e.id.startsWith('km-marker') && !e.id.startsWith('km-marker-end')),
    styleLayers.filter(e => e.id.startsWith('route-extras-labels')),
    styleLayers.filter(e => e.id.startsWith('km-marker-end')),
    styleLayers.filter(e => e.id.startsWith('symbols-layer') || e.id.startsWith('symbols-border-layer')),
    styleLayers.filter(e => e.id.startsWith('text-layer') || e.id.startsWith('cluster_labels')),
    styleLayers.filter(e => e.id.startsWith('line-layer-hit_geojson-source')),
    styleLayers.filter(e => e.id.startsWith('points-hit-layer_geojson-source'))
  ]

  // moveLayer(id) with no second arg moves the layer to the top. Iterating
  // bottom-to-top builds up the desired stack order.
  groups.forEach(group => {
    group.forEach(layer => { if (map.getLayer(layer.id)) map.moveLayer(layer.id) })
  })
  // console.log('Sorted layers: ', map.getStyle().layers)
}

export function updateMapName (name) {
  if (mapProperties.name === name) return
  mapProperties.name = name
  if (mapProperties.name) {
    document.title = 'Mapforge map: ' + mapProperties.name
  }
  functions.e('#map-title', e => { e.textContent = mapProperties.name })
}

export function frontFeature(frontFeature) {
  // move feature to end of its layer's features array
  for (const layer of layers) {
    if (!layer?.geojson?.features) { continue }
    const features = layer.geojson.features
    const idx = features.findIndex(f => f.id === frontFeature.id)
    if (idx !== -1) {
      if (idx === features.length - 1) { break } // already in front, nothing to do
      const [feature] = features.splice(idx, 1) // Remove it
      features.push(feature) // Add to end
      layer.bringToFront(feature)

      break // done, exit loop
    }
  }
}

export function viewUnchanged() {
  const tolerance = 0.01
  const mapInitCenter= (mapProperties.center || mapProperties.default_center)
  const lngMatch = Math.abs(map.getCenter().lng - mapInitCenter[0]) < tolerance
  const latMatch = Math.abs(map.getCenter().lat - mapInitCenter[1]) < tolerance
  // console.log(lngMatch && latMatch)
  return lngMatch && latMatch
}
