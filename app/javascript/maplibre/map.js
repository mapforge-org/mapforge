import { basemaps, defaultFont } from 'maplibre/basemaps'
import { draw } from 'maplibre/edit'
import { resetControls, initCtrlTooltips, initializeDefaultControls } from 'maplibre/controls/shared'
import { initializeViewControls } from 'maplibre/controls/view'
import { initSettingsModal } from 'maplibre/controls/edit'
import { initializeViewStyles, setStyleDefaultFont } from 'maplibre/styles'
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature'
import { AnimatePointAnimation, AnimateLineAnimation, AnimatePolygonAnimation } from 'maplibre/animations'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import equal from 'fast-deep-equal' // https://github.com/epoberezkin/fast-deep-equal
import maplibregl from 'maplibre-gl'
import { animateElement, initTooltips } from 'helpers/dom'

export let map
export let geojsonData //= { type: 'FeatureCollection', features: [] }
export let mapProperties
export let lastMousePosition
export let highlightedFeature
export let backgroundMapLayer

let mapInteracted
let backgroundTerrain

// workflow of event based map loading:
// page calls: initializeMap(), [initializeSocket()],
// initializeViewMode() or initializeEditMode() or initializeStaticMode()
// setBackgroundMapLayer() -> 'style.load' event
// 'style.load' -> initializeDefaultControls()
// 'style.load' -> loadGeoJsonData() -> 'geojson.load'
// 'geojson.load' -> initializeViewStyles()

export function initializeMaplibreProperties () {
  const lastProperties = JSON.parse(JSON.stringify(mapProperties || {}))
  mapProperties = window.gon.map_properties
  if (!equal(lastProperties, mapProperties)) {
    console.log('update map properties: ' + JSON.stringify(mapProperties))
    updateMapName(mapProperties.name)
    initSettingsModal()
    status('Map properties updated')
    if (Object.keys(lastProperties).length === 0 || !mapProperties) { return }
    // animate to new view if map had no interaction yet
    if (!mapInteracted) { setViewFromProperties() }
  }
}

export function setViewFromProperties () {
  map.once('moveend', function () { status('Map view updated') })
  map.flyTo({
    center: mapProperties.center || mapProperties.default_center,
    zoom: mapProperties.zoom || mapProperties.default_zoom,
    pitch: mapProperties.pitch,
    bearing: mapProperties.bearing || 0,
    curve: 0.3,
    essential: true,
    duration: 2000
  })
}

export function resetGeojsonData () {
  geojsonData = null
}

export function initializeMap (divId = 'maplibre-map') {
  // reset map data
  geojsonData = null
  backgroundMapLayer = null

  initializeMaplibreProperties()
  map = new maplibregl.Map({
    container: divId,
    center: (mapProperties.center || mapProperties.default_center),
    zoom: (mapProperties.zoom || mapProperties.default_zoom),
    pitch: mapProperties.pitch,
    bearing: mapProperties.bearing || 0,
    maxPitch: 72,
    maplibreLogo: !functions.isMobileDevice(),
    interactive: (window.gon.map_mode !== 'static') // can move/zoom map
    // style: {} // style/map is getting loaded by 'setBackgroundMapLayer'
  })
  // for console debugging
  window.map = map
  window.maplibregl = maplibregl

  // after basemap style is ready/changed, load geojson layer
  map.on('style.load', () => {
    // console.log('Map style loaded')
    loadGeoJsonData()
    if (mapProperties.terrain && window.gon.map_keys.maptiler) { addTerrain() }
  })

  map.on('geojson.load', (_e) => {
    functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })
  })

  map.once('load', async function (_e) {
    // on first map load, re-sort layers late, when all map,
    // view + edit layers are added
    sortLayers()
    // trigger map fade-in
    animateElement('.map', 'fade-in', 250)
    initCtrlTooltips()
    functions.e('.maplibregl-ctrl button', e => {
      e.setAttribute('data-toggle', 'tooltip')
      e.setAttribute('data-bs-custom-class', 'maplibregl-ctrl-tooltip')
      e.setAttribute('data-bs-trigger', 'hover')
    })
    initTooltips()
    functions.e('#preloader', e => { e.classList.add('hidden') })
    functions.e('.map', e => { e.setAttribute('map-loaded', true) })
    console.log('Map loaded')

    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    let feature = geojsonData?.features?.find(f => f.id === urlFeatureId)
    if (feature) {
      highlightFeature(feature, true)
      const centroid = window.turf.center(feature)
      map.setCenter(centroid.geometry.coordinates)
    }
    const urlFeatureAnimateId = new URLSearchParams(window.location.search).get('a')
    feature = geojsonData?.features?.find(f => f.id === urlFeatureAnimateId)
    if (feature) {
      console.log('Animating ' + feature.id)
      if (feature.geometry.type === 'LineString') {
        new AnimateLineAnimation().run(feature)
      } else if (feature?.geometry?.type === 'Polygon') {
        new AnimatePolygonAnimation().run(feature)
      } else {
        console.error('Feature to animate ' + animateFeatureId + ' not found!')
      }
      setViewFromProperties()
    }
  })

  map.on('mousemove', (e) => { lastMousePosition = e.lngLat })
  map.on('touchend', (e) => { lastMousePosition = e.lngLat })
  map.on('drag', () => { mapInteracted = true })
  map.on('pitchend', function (_e) {
    functions.e('#settings-modal', e => {
      e.setAttribute('data-map--settings-current-pitch-value', map.getPitch().toFixed(0))
    })
  })
  map.on('zoomend', function (_e) {
    functions.e('#settings-modal', e => {
      e.setAttribute('data-map--settings-current-zoom-value', map.getZoom().toFixed(2))
    })
  })
  map.on('rotate', function (_e) {
    functions.e('#settings-modal', e => {
      e.setAttribute('data-map--settings-current-bearing-value', map.getBearing().toFixed(0))
    })
  })
  map.on('moveend', function (_e) {
    functions.e('#settings-modal', e => {
      e.setAttribute('data-map--settings-current-center-value', JSON.stringify([map.getCenter().lng, map.getCenter().lat]))
    })
  })
  // map.on('error', (err) => {
  //   console.log('map error >>> ', err)
  // })
}

export function loadGeoJsonData () {
  // https://maplibre.org/maplibre-style-spec/sources/#geojson
  map.addSource('geojson-source', {
    type: 'geojson',
    promoteId: 'id',
    data: { type: 'FeatureCollection', features: [] }, // geojsonData,
    cluster: false
  })

  if (geojsonData) {
    // data is already loaded
    redrawGeojson()
    map.fire('geojson.load', { detail: { message: 'redraw cached geojson-source' } })
    return
  }

  const host = new URL(window.location.href).origin
  const url = host + '/m/' + window.gon.map_id + '.geojson'
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      return response.json()
    })
    .then(data => {
      // console.log('loaded GeoJSON from server: ', JSON.stringify(data))
      geojsonData = data
      if (geojsonData.features.length > 0) {
        console.log('loaded ' + geojsonData.features.length + ' features from ' + url)
        redrawGeojson()
      }
      console.log('Geojson layer loaded')
      map.fire('geojson.load', { detail: { message: 'geojson-source loaded' } })
    })
    .catch(error => {
      console.error('Failed to fetch GeoJSON:', error)
      console.error('geojsonData: ' + JSON.stringify(geojsonData))
    })
}

function addTerrain () {
  map.addSource('terrain', {
    type: 'raster-dem',
    url: 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=' + window.gon.map_keys.maptiler
  })

  map.setTerrain({
    source: 'terrain',
    exaggeration: 1.3
  })
  status('Terrain added to map')
}

export function initializeStaticMode () {
  map.on('geojson.load', () => {
    initializeViewStyles()
  })
  functions.e('.maplibregl-ctrl-attrib, #map-head', e => { e.classList.add('hidden') })
}

export function initializeViewMode () {
  map.once('style.load', () => {
    initializeViewControls()
    initializeDefaultControls()
  })
  map.on('geojson.load', () => { initializeViewStyles() })
  map.on('click', resetControls)
}

export function redrawGeojson (resetDraw = true) {
  // this + `promoteId: 'id'` is a workaround for the maplibre limitation:
  // https://github.com/mapbox/mapbox-gl-js/issues/2716
  // because to highlight a feature we need the id,
  // and in the style layers it only accepts mumeric ids in the id field initially
  geojsonData.features.forEach((feature, _index) => { feature.properties.id = feature.id })
  // draw has its own style layers based on editStyles
  if (draw) {
    if (resetDraw) {
      // This has a performance drawback over draw.set(), but some feature
      // properties don't get updated otherwise
      // API: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md
      draw.deleteAll()
      draw.add(geojsonData)
    } else {
      draw.set(geojsonData)
    }
  }
  map.getSource('geojson-source')?.setData(renderedGeojsonData())
  map.redraw()
  // drop the properties.id after sending to the map
  geojsonData.features.forEach(feature => { delete feature.properties.id })
}

// change geojson data before rendering:
// - For LineStrings with a 'fill-extrusion-height', add a polygon to render extrusion
export function renderedGeojsonData () {
  let extrusionLines = geojsonData.features.filter(feature => (
    feature.geometry.type === 'LineString' &&
      feature.properties['fill-extrusion-height'] &&
      feature.geometry.coordinates.length !== 1 // don't break line animation
  ))

  extrusionLines = extrusionLines.map(feature => {
    const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] * 2 || 4
    const extrusionLine = window.turf.buffer(feature, width, { units: 'meters' })
    // clone properties hash, else we're writing into the original feature's properties
    extrusionLine.properties = { ...feature.properties }
    if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
      extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
    }
    extrusionLine.properties['stroke-width'] = 0
    extrusionLine.properties['stroke-opacity'] = 0
    extrusionLine.properties['fill-opacity'] = 0
    return extrusionLine
  })
  return { type: 'FeatureCollection', features: geojsonData.features.concat(extrusionLines) }
}

export function upsert (updatedFeature) {
  const feature = geojsonData.features.find(f => f.id === updatedFeature.id)
  if (!feature) {
    addFeature(updatedFeature)
  } else if (!equal(updatedFeature, feature)) {
    updateFeature(feature, updatedFeature)
  }
}

export function addFeature (feature) {
  feature.properties.id = feature.id
  geojsonData.features.push(feature)
  redrawGeojson()
  status('Added feature ' + feature.id)
}

function updateFeature (feature, updatedFeature) {
  if (feature.geometry.type === 'Point') {
    const newCoords = updatedFeature.geometry.coordinates
    if (!equal(feature.geometry.coordinates, newCoords)) {
      const animation = new AnimatePointAnimation()
      animation.animatePoint(feature, newCoords)
    }
  }
  // only update feature if it was changed
  if (!equal(feature.geometry, updatedFeature.geometry) ||
    !equal(feature.properties, updatedFeature.properties)) {
    feature.geometry = updatedFeature.geometry
    feature.properties = updatedFeature.properties
    status('Updated feature ' + updatedFeature.id)
    redrawGeojson()
  }
}

export function destroy (featureId) {
  if (geojsonData.features.find(f => f.id === featureId)) {
    status('Deleting feature ' + featureId)
    geojsonData.features = geojsonData.features.filter(f => f.id !== featureId)
    redrawGeojson()
    resetHighlightedFeature()
  }
}

export function setBackgroundMapLayer (mapName = mapProperties.base_map, force = false) {
  if (backgroundMapLayer === mapName && backgroundTerrain === mapProperties.terrain && !force) { return }
  const basemap = basemaps()[mapName]
  if (basemap) {
    map.once('style.load', () => { status('Loaded base map ' + mapName) })
    backgroundMapLayer = mapName
    backgroundTerrain = mapProperties.terrain
    setStyleDefaultFont(basemap.font || defaultFont)
    map.setStyle(basemap.style,
      // adding 'diff: false' so that 'style.load' gets triggered (https://github.com/maplibre/maplibre-gl-js/issues/2587)
      // which will trigger loadGeoJsonData()
      { diff: false, strictMode: true })
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
  // console.log('Sorting layers')
  const currentStyle = map.getStyle()
  let layers = currentStyle.layers

  const mapExtrusions = functions.reduceArray(layers, (e) => e.paint && e.paint['fill-extrusion-height'])
  // increase opacity of 3D houses
  mapExtrusions.filter(l => l.id === 'Building 3D').forEach((layer) => {
    layer.paint['fill-extrusion-opacity'] = 0.8
  })
  const editLayer = functions.reduceArray(layers, (e) => (e.id.startsWith('gl-draw-')))
  const userSymbols = functions.reduceArray(layers, (e) => (e.id === 'symbols-layer' || e.id === 'symbols-border-layer'))
  const userLabels = functions.reduceArray(layers, (e) => e.id === 'text-layer')
  const mapSymbols = functions.reduceArray(layers, (e) => e.type === 'symbol')
  const points = functions.reduceArray(layers, (e) => (e.id === 'points-layer.hot' || e.id === 'points-layer.cold' || e.id === 'points-layer' || e.id === 'points-border-layer' || e.id === 'points-border-layer.cold' || e.id === 'points-border-layer.hot'))
  const lineLayerHits = functions.reduceArray(layers, (e) => e.id === 'line-layer-hit')
  const pointsLayerHits = functions.reduceArray(layers, (e) => e.id === 'points-hit-layer')

  layers = layers.concat(mapExtrusions)
    .concat(mapSymbols).concat(points).concat(editLayer)
    .concat(userSymbols).concat(userLabels)
    .concat(lineLayerHits).concat(pointsLayerHits)
  const newStyle = { ...currentStyle, layers }
  map.setStyle(newStyle, { diff: true })
  // console.log(map.getStyle().layers)
}

export function updateMapName (name) {
  if (!document.getElementById('frontpage-map')) {
    mapProperties.name = name
    if (mapProperties.name) {
      document.title = 'Mapforge.org: Map "' + mapProperties.name + '"'
    }
    functions.e('#map-title', e => { e.textContent = mapProperties.name })
  }
}
