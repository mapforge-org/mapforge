import { centroid } from "@turf/centroid";
import { mapChannel } from 'channels/map_channel';
import equal from 'fast-deep-equal'; // https://github.com/epoberezkin/fast-deep-equal
import * as dom from 'helpers/dom';
import * as functions from 'helpers/functions';
import { status } from 'helpers/status';
import { AnimateLineAnimation, AnimatePointAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations';
import { hideContextMenu, initContextMenu } from 'maplibre/controls/context_menu';
import { isGeolocateFollowModeActive } from 'maplibre/controls/geolocate';
import { initCtrlTooltips, initializeDefaultControls, initSettingsModal, resetControls } from 'maplibre/controls/shared';
import { initializeViewControls } from 'maplibre/controls/view';
import { resetEditMode } from 'maplibre/edit';
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature';
import { getFeature, initializeLayers, initializeLayerSources, initializeLayerStyles, layers, renderLayers } from 'maplibre/layers/layers';
import { basemaps, defaultFont, demSource, elevationSource } from 'maplibre/styles/basemaps';
import { clearImageState, loadImage, setStyleDefaultFont } from 'maplibre/styles/styles';

export let map
export let mapProperties
export let lastMousePosition
export let backgroundMapLayer

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

  // async load mapbox-gl-draw
  const maplibreglModule = await import('maplibre-gl')
  const maplibregl = maplibreglModule.default

  initializeMaplibreProperties()
  resetEditMode()
  map = new maplibregl.Map({
    container: divId,
    center: (mapProperties.center || mapProperties.default_center),
    zoom: (mapProperties.zoom || mapProperties.default_zoom), // will zoom in on map:load
    pitch: mapProperties.pitch,
    bearing: mapProperties.bearing || 0,
    maxPitch: 72,
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
    if (layers.filter(l => (l.type === 'overpass' || l.type === 'wikipedia') && l.show !== false).length) { dom.animateElement('#layer-reload', 'fade-in') }
  })
  map.on('zoom', (_e) => { limitZoom() })
  map.on('online', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', true) }) })
  map.on('offline', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', false) }) })

  // Render heartbeat — used by the visibilitychange watchdog to detect freezes.
  let lastRenderAt = performance.now()
  map.on('render', () => { lastRenderAt = performance.now() })

  // Canvas-level WebGL context handlers. Calling preventDefault() on the lost
  // event signals the browser we want context restoration; without it the
  // canvas stays dead silently while DOM events keep firing (matches the
  // "clicks work, drag dead" symptom).
  const mapCanvas = map.getCanvas()
  mapCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    console.warn('WebGL context lost')
    status('Map context lost', 'warning')
  }, false)
  mapCanvas.addEventListener('webglcontextrestored', () => {
    console.log('WebGL context restored')
    status('Map context restored', 'info')
    map.triggerRepaint()
  }, false)

  // Diagnostic state shared with the input watchdog so freeze toasts can carry
  // the post-resume map activity summary. Tracked for 10s after each resume.
  let postResumeT0 = 0
  let postResumeRenderCount = 0
  let postResumeMaxGap = 0
  let postResumeLastRender = 0
  let postResumeCounts = {}
  const trackedEvents = ['load', 'idle', 'dataloading', 'data', 'sourcedataloading', 'sourcedata',
    'styledataloading', 'styledata', 'error', 'movestart', 'moveend', 'zoomstart', 'zoomend',
    'dragstart', 'dragend']

  const diagnosticSummary = () => {
    const elapsed = Math.round(performance.now() - postResumeT0)
    return `t+${elapsed}ms R:${postResumeRenderCount} gap:${Math.round(postResumeMaxGap)}ms ` +
      Object.entries(postResumeCounts).filter(([_, n]) => n > 0)
        .map(([k, n]) => `${k.replace('source', 'src').replace('style', 'sty').replace('loading', 'L')}×${n}`).join(' ')
  }

  // Visibility watchdog — silently tracks map activity for 10s after resume so
  // the input/render freeze toasts can include the diagnostic summary inline
  // (no separate toast that would be clobbered by the freeze toast).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    status('Visibility: visible', 'info', 'medium', 1000)

    postResumeT0 = performance.now()
    postResumeRenderCount = 0
    postResumeMaxGap = 0
    postResumeLastRender = postResumeT0
    postResumeCounts = {}

    const handlers = {}
    trackedEvents.forEach(name => {
      handlers[name] = () => { postResumeCounts[name] = (postResumeCounts[name] || 0) + 1 }
      map.on(name, handlers[name])
    })
    handlers.render = () => {
      const now = performance.now()
      const gap = now - postResumeLastRender
      if (gap > postResumeMaxGap) postResumeMaxGap = gap
      postResumeLastRender = now
      postResumeRenderCount++
    }
    map.on('render', handlers.render)

    const beforeRepaint = performance.now()
    map.triggerRepaint()
    setTimeout(() => {
      const renderedSinceWatchdog = lastRenderAt > beforeRepaint
      const glLost = map.painter?.context?.gl?.isContextLost?.()
      if (!renderedSinceWatchdog || glLost) {
        status(`Map render frozen (gl_lost=${glLost}) | ${diagnosticSummary()}`, 'warning', 'medium', 10000)
      }
    }, 500)

    setTimeout(() => {
      trackedEvents.forEach(name => map.off(name, handlers[name]))
      map.off('render', handlers.render)
    }, 10000)
  })

  // Input watchdog — detects handler-level freezes where render still works but
  // pointer drag doesn't translate to map movement (clicks work, drag doesn't).
  let pointerDownAt = null
  let pointerDownX = 0
  let pointerDownY = 0
  let mapMovedSincePointerDown = false
  let inputFreezeReported = false
  map.on('movestart', () => { if (pointerDownAt) mapMovedSincePointerDown = true })
  mapCanvas.addEventListener('pointerdown', (e) => {
    pointerDownAt = performance.now()
    pointerDownX = e.clientX
    pointerDownY = e.clientY
    mapMovedSincePointerDown = false
    inputFreezeReported = false
  })
  mapCanvas.addEventListener('pointermove', (e) => {
    if (!pointerDownAt || inputFreezeReported) return
    const dx = e.clientX - pointerDownX
    const dy = e.clientY - pointerDownY
    if (Math.sqrt(dx * dx + dy * dy) < 15) return
    if (mapMovedSincePointerDown) return
    if (performance.now() - pointerDownAt < 150) return
    inputFreezeReported = true
    const glLost = map.painter?.context?.gl?.isContextLost?.()
    console.warn('Map drag input frozen', { glLost })
    status(`Map drag frozen (gl_lost=${glLost}) | ${diagnosticSummary()}`, 'warning', 'medium', 10000)
  })
  mapCanvas.addEventListener('pointerup', () => { pointerDownAt = null })
  mapCanvas.addEventListener('pointercancel', () => { pointerDownAt = null })

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
        setTimeout(() => { map.longPressTriggered = false }, 100)
        cancelLongPress()
      }, 500)
    })

    map.on('touchmove', (e) => {
      if (!longPressTimer) return
      const dx = Math.abs(e.point.x - longPressStartPoint.x)
      const dy = Math.abs(e.point.y - longPressStartPoint.y)
      if (dx > 10 || dy > 10) cancelLongPress()
    })

    map.on('touchend', cancelLongPress)
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
  if (mapChannel && window.gon.map_mode === 'rw' && window.gon.map_properties.share_cursor) {
    const coords = e.lngLat
    functions.throttle(() => {
      mapChannel.send_message('mouse', { lng: coords.lng, lat: coords.lat })
    }, 'mouse', 100)
  }
}

// Each map layer has its own source, so different style layers can be applied
// sourceName convention: layer.type + '-source-' + layer.id
export function addGeoJSONSource(sourceName, cluster=false) {
  // https://maplibre.org/maplibre-style-spec/sources/#geojson
  // console.log("Adding source: " + sourceName)
  if (map.getSource(sourceName)) {
    console.log('Source ' + sourceName + ' already exists, skipping add')
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
  if (map.getStyle && map.getStyle().layers) {
    // Remove all layers that use this source
    map.getStyle().layers
      .filter(l => l.source === sourceName)
      .forEach(l => {
        if (map.getLayer(l.id)) map.removeLayer(l.id)
      })
  }
}

export function setLayerVisibility(sourceName, visible) {
  if (map.getStyle && map.getStyle().layers) {
    const sources = [sourceName]
    // geojson layers have companion sources for km-markers and route extras
    if (sourceName.startsWith('geojson-source-')) {
      sources.push(sourceName.replace('geojson-source-', 'km-marker-source-'))
      sources.push(sourceName.replace('geojson-source-', 'route-extras-source-'))
    }
    // raster layers with waymarkedtrails have companion sources for clicked routes
    if (sourceName.startsWith('raster-source-')) {
      sources.push(sourceName + '-features')
    }
    map.getStyle().layers
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
  map.on('click', resetControls)
}

export function upsert (updatedFeature) {
  const feature = getFeature(updatedFeature.id)
  if (!feature) { addFeature(updatedFeature); return }

  // only update feature if it was changed, disregard properties.id
  const existingFeature = JSON.parse(JSON.stringify(feature))
  delete existingFeature.properties.id
  if (!equal(existingFeature, updatedFeature)) {
    updateFeature(feature, updatedFeature)
  }
}

export function addFeature (feature) {
  feature.properties.id = feature.id
  // Adding new features to the first geojson layer
  layers.find(l => l.type === 'geojson').geojson.features.push(feature)
  renderLayers('geojson', false)
  status('Added feature')
}

function updateFeature (feature, updatedFeature) {
  if (feature.geometry.type === 'Point') {
    const newCoords = updatedFeature.geometry.coordinates
    if (!equal(feature.geometry.coordinates, newCoords)) {
      const animation = new AnimatePointAnimation()
      animation.animatePoint(feature, newCoords)
    }
  }

  feature.geometry = updatedFeature.geometry
  feature.properties = updatedFeature.properties
  status('Updated feature ' + updatedFeature.id)
  renderLayers('geojson')
}

export function destroyFeature (featureId) {
  if (getFeature(featureId)) {
    status('Deleting feature ' + featureId)
    layers.forEach(l => l.geojson.features = l.geojson.features.filter(f => f.id !== featureId))
    renderLayers('geojson')
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
    map.once('style.load', () => {
      status('Loaded base map ' + mapName)
      // on map style change, all sources and layers are removed, so we need to re-initialize them
      initializeStyles()
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

// re-sort layers to overlay geojson layers with labels & extrusion objects
// workflows to consider: first map load, basemap update, socket reconnect
// sorting (bottom to top):
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
  const layers = map.getStyle().layers

  // increase opacity of 3D houses
  if (map.getLayer('Building 3D')) {
    map.setPaintProperty('Building 3D', 'fill-extrusion-opacity', 0.8)
  }

  // Each entry is a layer group; groups are listed bottom-to-top. mapSymbols
  // excludes user symbol/label layers since the original mutating logic pulled
  // those out before computing mapSymbols.
  const groups = [
    layers.filter(e => e.id.includes('-flat')), // keep flat layers behind houses
    layers.filter(e => e.id.startsWith('line-layer_geojson-source')),
    layers.filter(e => e.id.includes('route-extras-source') && !e.id.startsWith('route-extras-labels')),
    layers.filter(e => e.paint && e.paint['fill-extrusion-height'] && e.id.startsWith('polygon-layer-extrusion')),
    layers.filter(e => e.paint && e.paint['fill-extrusion-height'] && !e.id.startsWith('polygon-layer-extrusion')),
    layers.filter(e => e.id.startsWith('maplibre-gl-directions')),
    layers.filter(e => e.type === 'symbol' &&
      !e.id.startsWith('symbols-layer') && !e.id.startsWith('symbols-border-layer') &&
      !e.id.startsWith('text-layer') && !e.id.startsWith('cluster_labels')),
    layers.filter(e => e.id.startsWith('points-layer') || e.id.startsWith('cluster_points')),
    layers.filter(e => e.id.startsWith('heatmap-layer')),
    layers.filter(e => e.id.startsWith('gl-draw-')),
    layers.filter(e => e.id.startsWith('km-marker') && !e.id.startsWith('km-marker-end')),
    layers.filter(e => e.id.startsWith('route-extras-labels')),
    layers.filter(e => e.id.startsWith('km-marker-end')),
    layers.filter(e => e.id.startsWith('symbols-layer') || e.id.startsWith('symbols-border-layer')),
    layers.filter(e => e.id.startsWith('text-layer') || e.id.startsWith('cluster_labels')),
    layers.filter(e => e.id.startsWith('line-layer-hit_geojson-source')),
    layers.filter(e => e.id.startsWith('points-hit-layer_geojson-source'))
  ]

  // moveLayer(id) with no second arg moves the layer to the top. Iterating
  // bottom-to-top builds up the desired stack order.
  groups.forEach(group => {
    group.forEach(layer => { if (map.getLayer(layer.id)) map.moveLayer(layer.id) })
  })
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
      const [feature] = features.splice(idx, 1) // Remove it
      features.push(feature) // Add to end
      layer.render()

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
