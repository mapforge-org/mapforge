import equal from 'fast-deep-equal'; // https://github.com/epoberezkin/fast-deep-equal
import * as dom from 'helpers/dom'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { mapChannel } from 'channels/map_channel'
import { AnimateLineAnimation, AnimatePointAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations'
import { basemaps, defaultFont, elevationSource, demSource } from 'maplibre/styles/basemaps'
import { initCtrlTooltips, initializeDefaultControls, initSettingsModal, resetControls } from 'maplibre/controls/shared'
import { initializeViewControls } from 'maplibre/controls/view'
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature'
import { setStyleDefaultFont, loadImage } from 'maplibre/styles/styles'
import { layers, initializeLayerSources, loadLayerDefinitions, initializeLayerStyles, getFeature } from 'maplibre/layers/layers'
import { centroid } from "@turf/centroid"
import { renderGeoJSONLayer, renderGeoJSONLayers } from 'maplibre/layers/geojson'
import { renderWikipediaLayer } from 'maplibre/layers/wikipedia'
import { renderOverpassLayer } from 'maplibre/layers/overpass'

export let map
export let mapProperties
export let lastMousePosition
export let backgroundMapLayer

let mapInteracted
let backgroundTerrain
let backgroundHillshade
let backgroundGlobe
let backgroundContours

// workflow of event based map loading:
// page calls: initializeMap(), [initializeSocket()],
// initializeViewMode() or initializeEditMode() or initializeStaticMode()
// setBackgroundMapLayer() -> 'style.load' event
// 'style.load' (once) -> initializeDefaultControls()
// 'style.load' -> initializeStyles()
// loadLayerDefinitions() -> 'layers.load'

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
    // animate to new view if map had no interaction yet
    if (!mapInteracted) { animateViewFromProperties() }
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
  map = new maplibregl.Map({
    container: divId,
    center: (mapProperties.center || mapProperties.default_center),
    zoom: (mapProperties.zoom || mapProperties.default_zoom), // will zoom in on map:load
    pitch: mapProperties.pitch,
    bearing: mapProperties.bearing || 0,
    maxPitch: 72,
    maplibreLogo: !functions.isMobileDevice(),
    hash: true, // enable hash in URL for map center/zoom
    fadeDuration: 200, // shorter fade
    interactive: (window.gon.map_mode !== 'static') // can move/zoom map
    // style: {} // style/map is getting loaded by 'setBackgroundMapLayer'
  })

  loadLayerDefinitions()
  if (!functions.isTestEnvironment()) { map.setZoom(map.getZoom() - 1) } // will zoom in on map:load

  // for console debugging
  window.map = map
  window.maplibregl = maplibregl

  if (!!mapProperties.description?.trim()) { dom.showElements('#description-modal') }

  map.on('styleimagemissing', loadImage)

  map.on('geojson.load', (_e) => {
    functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })
  })

  // NOTE: map 'load' can happen before 'layers.load'/'geojson.load' when loading features is slow
  map.once('load', async function (_e) {
    // trigger map fade-in
    dom.animateElement('.map', 'fade-in', 250)
    initCtrlTooltips()
    functions.e('.maplibregl-ctrl button', e => {
      e.setAttribute('data-toggle', 'tooltip')
      e.setAttribute('data-bs-custom-class', 'maplibregl-ctrl-tooltip')
      e.setAttribute('data-bs-trigger', 'hover')
    })
    dom.initTooltips()
    functions.e('#preloader', e => { e.classList.add('hidden') })
    functions.e('.map', e => { e.setAttribute('data-map-loaded', true) })
    if (!functions.isTestEnvironment()) { map.easeTo({ zoom: map.getZoom() + 1, duration: 1000 }) } // zoom in to configured zoom level
    console.log("Map loaded ('load')")

    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    let feature
    if (urlFeatureId && (feature = getFeature(urlFeatureId))) {
      resetControls()
      highlightFeature(feature, true)
      const center = centroid(feature)
      map.setCenter(center.geometry.coordinates)
    }
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
    if (layers.filter(l => l.type !== 'geojson').length) { dom.animateElement('#layer-reload', 'fade-in') }
  })
  map.on('zoom', (_e) => {
    if (!layers) { return }
    // block zooming in closer than defined max zoom level
    let bgMap = basemaps()[backgroundMapLayer]
    // TODO: max zoom doesn't work for style urls
    if (!bgMap.style.layers) { return }
    let maxzoom = bgMap.style.layers[0].maxzoom
    if (map.getZoom() > maxzoom - 0.2) {
      map.setZoom(maxzoom - 0.2)
    }
    let minzoom = bgMap.style.layers[0].minzoom
    if (map.getZoom() < minzoom + 0.2) {
      map.setZoom(minzoom + 0.2)
    }    
  })
  map.on('online', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', true) }) })
  map.on('offline', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', false) }) })

  // map.on('error', (err) => {
  //   console.log('map error >>> ', err)
  // })
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
  renderGeoJSONLayers(false)
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
  renderGeoJSONLayers()
}

export function destroyFeature (featureId) {
  if (getFeature(featureId)) {
    status('Deleting feature ' + featureId)
    layers.forEach(l => l.geojson.features = l.geojson.features.filter(f => f.id !== featureId))
    renderGeoJSONLayers()
    resetHighlightedFeature()
  }
}

// after basemap style is ready/changed, init layers + load their data if needed
async function initializeStyles() {
  console.log('Initializing sources and layer styles after basemap load/change')
  
  // in case layer data is not yet loaded, wait for it 
  if (!layers) { 
    console.log('Waiting for layers to load before initializing styles...')
    await functions.waitForEvent(map, 'layers.load') 
  }

  initializeLayerSources()
  initializeLayerStyles()

  demSource.setupMaplibre(maplibregl)
  if (mapProperties.terrain) { addTerrain() }
  if (mapProperties.hillshade) { addHillshade() }
  if (mapProperties.globe) { addGlobe() }
  if (mapProperties.contours) { addContours() }
}

export function setBackgroundMapLayer (mapName = mapProperties.base_map, force = false) {
  if (backgroundMapLayer === mapName &&
      backgroundTerrain === mapProperties.terrain &&
      backgroundHillshade === mapProperties.hillshade &&
      backgroundContours === mapProperties.contours &&
      backgroundGlobe === mapProperties.globe && !force) { return }
  const basemap = basemaps()[mapName]
  if (basemap) {
    map.once('style.load', () => {
      status('Loaded base map ' + mapName)
      // on map style change, all sources and layers are removed, so we need to re-initialize them
      initializeStyles()
    })
    backgroundMapLayer = mapName
    backgroundTerrain = mapProperties.terrain
    backgroundHillshade = mapProperties.hillshade
    backgroundContours = mapProperties.contours
    backgroundGlobe = mapProperties.globe
    setStyleDefaultFont(basemap.font || defaultFont)
    map.setStyle(basemap.style, { diff: true, strictMode: true })
  } else {
    console.error('Base map ' + mapName + ' not available!')
  }
}

// re-sort layers to overlay geojson layers with labels & extrusion objects
// workflows to consider: first map load, basemap update, socket reconnect
// sorting:
// - polygons, lines etc.
// - map labels
// - extrusions
// - points
// - text/symbol
export function sortLayers () {
  const currentStyle = map.getStyle()
  let layers = currentStyle.layers

  const mapExtrusions = functions.reduceArray(layers, (e) => e.paint && e.paint['fill-extrusion-height'] && !e.id.startsWith('polygon-layer-extrusion'))
  // increase opacity of 3D houses
  mapExtrusions.filter(l => l.id === 'Building 3D').forEach((layer) => {
    layer.paint['fill-extrusion-opacity'] = 0.8
  })

  // console.log('Sorting layers', layers)
  const flatLayers = functions.reduceArray(layers, (e) => (e.id.includes('-flat'))) // keep flat layers behin houses
  const kmMarkers = functions.reduceArray(layers, (e) => (e.id.startsWith('km-marker')))
  const editLayer = functions.reduceArray(layers, (e) => (e.id.startsWith('gl-draw-')))
  const userSymbols = functions.reduceArray(layers, (e) => (e.id.startsWith('symbols-layer') || e.id.startsWith('symbols-border-layer')))
  const userLabels = functions.reduceArray(layers, (e) => e.id.startsWith('text-layer') || e.id.startsWith('cluster_labels'))
  const mapSymbols = functions.reduceArray(layers, (e) => e.type === 'symbol')
  const points = functions.reduceArray(layers, (e) => (e.id.startsWith('points-layer') || e.id.startsWith('cluster_points')))
  const lineLayers = functions.reduceArray(layers, (e) => e.id === 'line-layer_geojson-source')
  const lineLayerHits = functions.reduceArray(layers, (e) => e.id === 'line-layer-hit_geojson-source')
  const pointsLayerHits = functions.reduceArray(layers, (e) => e.id === 'points-hit-layer_geojson-source')
  const directions = functions.reduceArray(layers, (e) => (e.id.startsWith('maplibre-gl-directions')))
  const heatmap = functions.reduceArray(layers, (e) => (e.id.startsWith('heatmap-layer'))) 

  layers = layers.concat(flatLayers).concat(lineLayers).concat(mapExtrusions).concat(directions)
    .concat(mapSymbols).concat(points).concat(heatmap).concat(editLayer)
    .concat(lineLayerHits).concat(pointsLayerHits)
    .concat(kmMarkers).concat(userSymbols).concat(userLabels)

  const newStyle = { ...currentStyle, layers }
  map.setStyle(newStyle, { diff: true })
  console.log("Sorted layers:", map.getStyle().layers)
}

export function updateMapName (name) {
  mapProperties.name = name
  if (mapProperties.name) {
    document.title = 'Mapforge.org: Map "' + mapProperties.name + '" | Create and share your own maps online'
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
      // TODO: refactor to call this dynamically in the right way
      if (layer.type === 'geojson') { renderGeoJSONLayer(layer.id) }
      if (layer.type === 'overpass') { renderOverpassLayer(layer.id) }
      if (layer.type === 'wikipedia') { renderWikipediaLayer(layer.id) }

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

