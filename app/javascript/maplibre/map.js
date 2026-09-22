import { centroid } from "@turf/centroid";
import { sendMessage } from 'channels/map_channel';
import equal from 'fast-deep-equal'; // https://github.com/epoberezkin/fast-deep-equal
import * as dom from 'helpers/dom';
import * as functions from 'helpers/functions';
import { status } from 'helpers/status';
import * as maplibregl from 'maplibre-gl';
import { AnimateLineAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations';
import { hideContextMenu, initContextMenu } from 'maplibre/controls/context_menu';
import { removeEditControls } from 'maplibre/controls/edit';
import { isGeolocateFollowModeActive } from 'maplibre/controls/geolocate';
import { initLevelFromURL } from 'maplibre/controls/levels';
import { hideModals, initCtrlTooltips, initializeDefaultControls, initSettingsModal, resetControls } from 'maplibre/controls/shared';
import { initializeViewControls, removeViewControls } from 'maplibre/controls/view';
import { initializeEditMode, resetEditMode } from 'maplibre/edit';
import { highlightFeature } from 'maplibre/feature';
import { refreshDescBanners, renderDescBanners } from 'maplibre/layers/geojson/desc_banners';
import { getFeature, initializeLayers, initializeLayerSources, initializeLayerStyles, layers } from 'maplibre/layers/layers';
import { basemaps } from 'maplibre/styles/basemaps';
import { applyBasemapDefaults, defaults } from 'maplibre/styles/defaults';
import { clearImageState, loadImage } from 'maplibre/styles/styles';
import { addElevationLayers } from 'maplibre/styles/terrain';

export let map
export let mapProperties
export let lastMousePosition
export let backgroundMapLayer

// Per map, so that hiding one maps description popup keeps it for other maps.
export function descriptionHiddenKey () {
  return `hide-description-${window.gon.map_properties.public_id}`
}

// View mode changes these locally and never saves them. Keep the server state, so
// that a switch to edit mode can drop the unsaved changes.
const localOnlyProperties = [ 'base_map', 'terrain', 'hillshade', 'contours', 'globe' ]
let serverProperties = {}

// Server `updated_at` of the map data currently held in memory. Compared on socket
// reconnect (against the freshly fetched value) to decide whether a full, main-thread
// -blocking reload is actually needed. Set on every full (re)load of the map data.
export let loadedMapUpdatedAt = null
export function setLoadedMapUpdatedAt (value) { loadedMapUpdatedAt = value }

// Above this zoom a clustered source shows every point on its own
export const clusterMaxZoom = 14

let mapInteracted
// basemap plus the properties that setStyle bakes into the style, see setBackgroundMapLayer
let backgroundStyleKey

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
  if (mapProperties) {
    serverProperties = Object.fromEntries(
      localOnlyProperties.map(key => [ key, mapProperties[key] ]))
  }
  if (mapProperties && !equal(lastProperties, mapProperties)) {
    console.log('Update map properties:', mapProperties)
    updateMapName(mapProperties.name)
    initSettingsModal()
    status(window.__('Map properties updated'))
    // initial load
    if (Object.keys(lastProperties).length === 0 || !mapProperties) { return }
    // animate to new view if map had no interaction yet and not in geolocate follow mode
    if (!mapInteracted && !isGeolocateFollowModeActive()) { animateViewFromProperties() }
    return true
  }
  return false
}

// Opening view, in order: the view stored on the map, the view calculated from the
// features, then the view of the client (IP based, with a static fallback).
export function initialView () {
  return {
    center: mapProperties.center || mapProperties.default_center || window.gon.client_center,
    zoom: mapProperties.zoom || mapProperties.default_zoom || window.gon.client_zoom
  }
}

export async function initializeMap (divId = 'maplibre-map') {
  backgroundMapLayer = null
  backgroundStyleKey = null
  rasterZoomLimits = {}

  // Initialize level from URL FIRST, before any layer initialization
  // This ensures the level is set before style.load triggers initializeLayers
  initLevelFromURL()

  initializeMaplibreProperties()
  resetEditMode()
  try {
    map = new maplibregl.Map({
      container: divId,
      center: initialView().center,
      zoom: initialView().zoom, // will zoom in on map:load
      pitch: mapProperties.pitch,
      bearing: mapProperties.bearing || 0,
      maxPitch: 72,
      maxZoom: 24, // hard limit of maplibre
      maplibreLogo: true,
      hash: true, // enable hash in URL for map center/zoom
      fadeDuration: 200, // shorter fade
      interactive: (window.gon.map_mode !== 'static'), // can move/zoom map
      // The static styles in public/layers/ must not carry an api key, so add the
      // configured one to every maptiler request that comes out of them
      transformRequest: (url) => {
        if (!url.includes('api.maptiler.com') || url.includes('key=')) { return }
        return { url: url + (url.includes('?') ? '&' : '?') + 'key=' + window.gon.map_keys.maptiler }
      },
      // merged over maplibres defaultLocale, only listed keys get overridden
      locale: {
        'AttributionControl.ToggleAttribution': window.__('Toggle attribution'),
        'GeolocateControl.FindMyLocation': window.__('Find my location'),
        'GeolocateControl.LocationNotAvailable': window.__('Location not available'),
        'Map.Title': window.__('Map'),
        'Marker.Title': window.__('Map marker'),
        'NavigationControl.ResetBearing': window.__('Drag to rotate map, click to reset north'),
        'NavigationControl.ZoomIn': window.__('Zoom in'),
        'NavigationControl.ZoomOut': window.__('Zoom out')
      }
      // style: {} // style/map is getting loaded by 'setBackgroundMapLayer'
    })
  } catch (error) {
    // Since 6.7 the constructor throws GPUInitializationError without WebGL2.
    // Dropping the .map element also un-hides the header nav (html:has(.map) in map.css).
    console.error(error)
    dom.deleteElements(['#preloader', '#maplibre-map', '#map-head', '#status-container'])
    functions.e('#map-header nav', e => { e.style.removeProperty('display') })
    dom.showElements('#map-error')
    return false
  }

  if (!functions.isTestEnvironment()) { map.setZoom(map.getZoom() - 1) } // will zoom in on map:load

  // for console debugging
  window.map = map
  window.maplibregl = maplibregl

  // Maplibre guesses 'wheel' vs 'trackpad' per event and then applies zoom rates that
  // differ by 4.5x, so a single misread event makes the zoom jump. Keep both rates at
  // the value that fits the device of the current event, which makes a misread harmless.
  map.getCanvasContainer().addEventListener('wheel', (e) => {
    const rate = (e.ctrlKey || Math.abs(e.deltaY) < 40) ? 0.01 : 1 / 450
    map.scrollZoom.setZoomRate(rate)
    map.scrollZoom.setWheelZoomRate(rate)
  }, { capture: true })

  if (!!mapProperties.description?.trim() && !localStorage.getItem(descriptionHiddenKey())) {
    dom.showElements('#description-modal')
  }

  map.setMissingStyleImageResolver(loadImage)

  // TODO: remove once https://github.com/maplibre/maplibre-gl-js/issues/7752 is fixed (5.25)
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('Out of bounds') &&
        event.error?.stack?.includes('loadMatchingFeature')) {
      console.warn('Swallowed MapLibre #7752 queryRenderedFeatures race')
      event.preventDefault()
    }
  })

  // NOTE: map 'load' can happen before layers are loaded when loading features is slow
  map.once('load', onMapLoad)
  bindMapEvents()

  // map.on('error', (err) => {
  //   console.log('map error >>> ', err)
  // })

  return true
}

async function onMapLoad () {
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

  // Safe to call even if already triggered by style.load — returns the cached promise, no double loading
  const layersLoaded = initializeLayers()

  const urlFeatureId = new URLSearchParams(window.location.search).get('f')
  let feature
  if (urlFeatureId) {
    // Only a feature link waits for the layers, the zoom-in below must start from its center.
    // Every other map zooms in right away, before the overpass/wikipedia fetches finish.
    await layersLoaded
    if ((feature = getFeature(urlFeatureId))) {
      resetControls()
      highlightFeature(feature, true)
      map.setCenter(centroid(feature).geometry.coordinates)
    }
  }

  if (!functions.isTestEnvironment()) { map.easeTo({ zoom: map.getZoom() + 1, duration: 1000 })} // zoom in to configured zoom level
  console.log("Map loaded ('load')")

  await layersLoaded

  // Set idle marker for screenshot task — fires after all animations complete and tiles load
  map.once('idle', () => {
    functions.e('.map', e => { e.setAttribute('data-map-idle', true) })
  })

  animateFeatureFromUrl()
}

function animateFeatureFromUrl () {
  const featureId = new URLSearchParams(window.location.search).get('a')
  const feature = featureId && getFeature(featureId)
  if (!feature) { return }

  console.log('Animating ' + feature.id)
  resetControls()
  const type = feature.geometry?.type
  if (type === 'LineString') {
    new AnimateLineAnimation().run(feature)
  } else if (type === 'Polygon') {
    new AnimatePolygonAnimation().run(feature)
  } else {
    console.error('Feature ' + featureId + ' has type ' + type + ', which cannot be animated')
  }
  animateViewFromProperties()
}

function bindMapEvents () {
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
    refreshDescBanners()
    if (e.originalEvent) { hideModals() } // ignore programmatic zoom (e.g. initial zoom-in effect)
  })
  map.on('online', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', true) }) })
  map.on('offline', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', false) }) })

  // MapLibre >= 6.11 fires contextmenu on touch long press itself
  map.on('contextmenu', (e) => {
    e.preventDefault()
    // lets the tap-to-click patch in edit.js skip the touchend that ends a long press
    map.longPressTriggered = true
    // menu gets unhidden only when there are buttons
    initContextMenu(e)
    map.once('zoom', (_e) => { hideContextMenu() })
    map.once('rotate', (_e) => { hideContextMenu() })
    map.once('drag', (_e) => { hideContextMenu() })
  })
  map.on('touchstart', () => { map.longPressTriggered = false })
}

// Read from the style JSON once per basemap load, because getStyle() copies the whole style and
// limitZoom runs on every zoom event. The live source object is no substitute: it reports the
// maplibre default maxzoom 22 when the style sets none.
let rasterZoomLimits = {}

function updateRasterZoomLimits () {
  const sources = map.getStyle().sources
  const rasterSource = sources['raster-tiles'] || sources['satellite']
  rasterZoomLimits = { maxZoom: rasterSource?.maxzoom, minZoom: rasterSource?.minzoom }
}

function limitZoom() {
  const { maxZoom, minZoom } = rasterZoomLimits

  // block zooming in closer than defined max zoom level
  if (maxZoom && (map.getZoom() > maxZoom - 0.2)) {
    map.setZoom(maxZoom - 0.2)
    status(window.__('Maximum zoom level %{zoom} reached').replace('%{zoom}', maxZoom), 'info', 'medium', 1000)
  }
  if (minZoom && (map.getZoom() < minZoom + 0.2)) {
    map.setZoom(minZoom + 0.2)
    status(window.__('Minimum zoom level %{zoom} reached').replace('%{zoom}', minZoom), 'info', 'medium', 1000)
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
export function addGeoJSONSource(sourceName, cluster=false, attribution=null) {
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
    clusterMaxZoom,
    clusterRadius: 50,
    // the attribution control drops a null and de-duplicates the rest, so layers of the
    // same type credit their data source only once
    ...(attribution && { attribution })
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
      // one image overlay source per feature, see image_overlays.js
      sources.push(sourceName.replace('geojson-source-', 'image-overlay-source-') + '-')
    }
    // raster layers with waymarkedtrails have companion sources for clicked routes
    if (sourceName.startsWith('raster-source-')) {
      sources.push(sourceName + '-features')
    }
    style.layers
      .filter(l => sources.some(s => l.source === s || (s.endsWith('-') && l.source.startsWith(s))))
      .forEach(l => {
        if (map.getLayer(l.id)) map.setLayoutProperty(l.id, 'visibility', visible ? 'visible' : 'none')
      })
  }
  // description banners are DOM popups, not style layers, see desc_banners.js
  const layer = layers?.find(l => l.sourceId === sourceName)
  if (layer?.type === 'geojson') { renderDescBanners(layer.geojson?.features || [], layer, visible) }
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

export function initializeStaticMode () {
  functions.e('.maplibregl-ctrl-attrib, #map-head', e => { e.classList.add('hidden') })
}

export function initializeViewMode () {
  map.once('style.load', () => {
    initializeViewControls()
    initializeDefaultControls()
  })
  // the handler stays registered after a switch to edit mode, where a reset would end a draw mode
  onMapClickAfterLayers(() => { if (window.gon.map_mode === 'ro') { resetControls() } })
}

// Swaps the control set of the running map, so that the mode toggle needs no page load.
// The map channel needs no re-subscription: it always streams by public id, and every
// write is authorized by the private id in the message payload.
export async function switchMapMode (mode, mapId, url, pushHistory = true) {
  // an open modal or a selected feature must not outlive the mode it belongs to
  resetControls()

  window.gon.map_mode = mode
  window.gon.map_id = mapId
  document.body.classList.toggle('map-mode-rw', mode === 'rw')
  functions.e('#map-mode-badge a', e => {
    e.classList.toggle('active', e.dataset.mode === mode)
  })
  bindModeHistory()

  if (mode === 'rw') {
    Object.assign(mapProperties, serverProperties)
    setBackgroundMapLayer()
    removeViewControls()
    await initializeEditMode()
  } else {
    removeEditControls()
    initializeViewControls()
  }
  initCtrlTooltips()

  initSettingsModal()
  // a page loaded in edit mode opens the editor for an existing description, so match it
  if (mode === 'rw' && mapProperties.description) {
    functions.e('#map-description-toggle', e => { e.click() })
  }

  if (pushHistory) { window.history.pushState({}, '', url + window.location.hash) }
}

let modeHistoryBound = false

// The back button changes the URL only. Switch the running map to match it.
function bindModeHistory () {
  if (modeHistoryBound) { return }
  modeHistoryBound = true

  window.addEventListener('popstate', () => {
    const path = window.location.pathname
    const link = document.querySelector(`#map-mode-badge a[href="${path}"]`)
    if (!link || link.classList.contains('active')) { return }
    switchMapMode(link.dataset.mode, path.split('/').pop(), path, false)
  })
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

// after basemap style is ready/changed, init layers + load their data if needed
async function initializeStyles() {
  console.log('Initializing sources and layer styles after basemap load/change')

  addElevationLayers(mapProperties, backgroundMapLayer)

  // First load: initialize layers (loads definitions, creates sources, loads styles/data)
  // Subsequent calls: re-initialize sources and styles (basemap change removes all sources/layers)
  if (!layers) {
    await initializeLayers()
  } else {
    initializeLayerSources()
    await initializeLayerStyles()
  }
}

// Restyles the labels of the basemap itself with defaults.font, defaults.fontBold
// and defaults.fontItalic. Off by default, a basemap opts in with 'applyFont: true'.
function basemapFontTransform (basemap) {
  if (basemap.applyFont !== true) { return undefined }
  return (_previous, next) => {
    if (!next?.layers) { return next }
    return { ...next, layers: next.layers.map(layer => {
      if (layer.type !== 'symbol' || !layer.layout?.['text-field']) { return layer }
      const stack = layer.layout['text-font']
      const name = typeof stack?.[0] === 'string' ? stack[0] : ''
      let font = defaults.font
      if (/bold/i.test(name)) {
        font = defaults.fontBold
      } else if (/italic|oblique/i.test(name)) {
        font = defaults.fontItalic || defaults.font
      }
      if (stack?.length === 1 && stack[0] === font) { return layer }
      // console.log(`Replacing ${name} with ${font} in ${layer.id}`)
      return { ...layer, layout: { ...layer.layout, 'text-font': [font] } }
    }) }
  }
}

// Returns true if a basemap reload was triggered (caller can rely on the
// style.load handler to re-initialize layer sources/styles), false otherwise.
export function setBackgroundMapLayer (mapName = mapProperties.base_map, force = false) {
  const { terrain, hillshade, contours, globe } = mapProperties
  const styleKey = JSON.stringify([mapName, terrain, hillshade, contours, globe])
  if (backgroundStyleKey === styleKey && !force) { return false }
  let basemap = basemaps()[mapName]
  if (!basemap) {
    console.error('Base map ' + mapName + ' not available!')
    basemap = basemaps()['osmRasterTiles']
  }
  map.once('style.load', async () => {
    status(window.__('Loaded base map %{name}').replace('%{name}', mapName))
    // on map style change, all sources and layers are removed, so we need to re-initialize them
    updateRasterZoomLimits()
    await initializeStyles()
    limitZoom()
  })
  backgroundMapLayer = mapName
  backgroundStyleKey = styleKey
  applyBasemapDefaults(basemap)
  // Edit styles are built once when MapboxDraw is created, so they need to get
  // rebuilt from the new defaults before setStyle makes draw re-add its layers
  map.fire('basemap.change')
  // Clear image cache so icons can be re-loaded after basemap change
  clearImageState()
  map.setStyle(basemap.style, { diff: true, strictMode: true, transformStyle: basemapFontTransform(basemap) })
  return true
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
    styleLayers.filter(e => e.id.startsWith('polygon-layer-pattern_geojson-source')), // pattern on the fill
    styleLayers.filter(e => e.id.startsWith('image-overlay-layer_')),
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
    styleLayers.filter(e => e.id.startsWith('text-layer') || e.id.startsWith('cluster_labels'))
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

export function viewUnchanged() {
  const tolerance = 0.01
  const mapInitCenter = initialView().center
  const lngMatch = Math.abs(map.getCenter().lng - mapInitCenter[0]) < tolerance
  const latMatch = Math.abs(map.getCenter().lat - mapInitCenter[1]) < tolerance
  // console.log(lngMatch && latMatch)
  return lngMatch && latMatch
}
