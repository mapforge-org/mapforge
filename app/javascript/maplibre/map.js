import equal from 'fast-deep-equal'; // https://github.com/epoberezkin/fast-deep-equal
import { animateElement, initTooltips } from 'helpers/dom'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import maplibregl from 'maplibre-gl'
import { AnimateLineAnimation, AnimatePointAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations'
import { basemaps, defaultFont, elevationSource, demSource } from 'maplibre/basemaps'
import { initSettingsModal } from 'maplibre/controls/edit'
import { initCtrlTooltips, initializeDefaultControls, resetControls } from 'maplibre/controls/shared'
import { initializeViewControls } from 'maplibre/controls/view'
import { draw } from 'maplibre/edit'
import { highlightFeature, resetHighlightedFeature, renderKmMarkers,
  renderExtrusionLines, initializeKmMarkerStyles } from 'maplibre/feature'
import { initializeViewStyles, setStyleDefaultFont } from 'maplibre/styles'
import { initializeOverpassLayers } from 'maplibre/overpass/overpass'

export let map
export let layers // [{ id:, type: "overpass"||"geojson", name:, query:, geojson: { type: 'FeatureCollection', features: [] } }]
export let geojsonData //= { type: 'FeatureCollection', features: [] }
export let mapProperties
export let lastMousePosition
export let highlightedFeature
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
// 'style.load' -> initializeDefaultControls()
// 'style.load' -> initializeViewStyles() || initializeEditStyles()
// 'style.load' -> loadLayers() -> 'geojson.load'

export function initializeMaplibreProperties () {
  const lastProperties = JSON.parse(JSON.stringify(mapProperties || {}))
  mapProperties = window.gon.map_properties
  if (!equal(lastProperties, mapProperties)) {
    console.log('Update map properties:', mapProperties)
    updateMapName(mapProperties.name)
    initSettingsModal()
    status('Map properties updated')
    // initial load
    if (Object.keys(lastProperties).length === 0 || !mapProperties) { return }
    // animate to new view if map had no interaction yet
    if (!mapInteracted) { animateViewFromProperties() }
  }
}

// reset map data
export function resetLayers () {
  functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', false) })
  geojsonData = null
  layers = []
}

export function resetGeojsonLayers () {
  functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', false) })
  geojsonData = null
  layers = layers.filter(l => l.type !== 'geojson')
}

export function initializeMap (divId = 'maplibre-map') {
  resetLayers()
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
    hash: true, // enable hash in URL for map center/zoom
    interactive: (window.gon.map_mode !== 'static') // can move/zoom map
    // style: {} // style/map is getting loaded by 'setBackgroundMapLayer'
  })

  // for console debugging
  window.map = map
  window._layers = layers
  window.maplibregl = maplibregl

  // after basemap style is ready/changed, init source layers +
  // load geojson data
  map.on('style.load', () => {
    console.log('Basemap style loaded (style.load)')
    addGeoJSONSource('geojson-source')
    addGeoJSONSource('km-marker-source')
    loadLayers()
    demSource.setupMaplibre(maplibregl)
    if (mapProperties.terrain) { addTerrain() }
    if (mapProperties.hillshade) { addHillshade() }
    if (mapProperties.globe) { addGlobe() }
    if (mapProperties.contours) { addContours() }
  })

  map.on('geojson.load', (_e) => {
    functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })
  })

  // NOTE: map 'load' can happen before 'geojson.load' when loading features is slow
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
    functions.e('.map', e => { e.setAttribute('data-map-loaded', true) })
    console.log("Map loaded ('load')")

    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    let feature = geojsonData?.features?.find(f => f.id === urlFeatureId)
    if (feature) {
      if (!draw) { highlightFeature(feature, true) }
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
      animateViewFromProperties()
    }
  })

  map.on('mousemove', (e) => { lastMousePosition = e.lngLat })
  map.on('touchend', (e) => { lastMousePosition = e.lngLat })
  map.on('drag', () => { 
    mapInteracted = true 
    if (layers.filter(l => l.type === 'overpass')) { animateElement('#layer-reload', 'fade-in') }
  })
  map.on('zoom', (_e) => {
    mapInteracted = true
    if (layers.filter(l => l.type === 'overpass')) { animateElement('#layer-reload', 'fade-in') }
    // block zooming in closer than defined max zoom level
    let bgMap = basemaps()[backgroundMapLayer]
    // TODO: max zoom doesn't work for style urls
    if (!bgMap.style.layers) { return }
    let maxzoom = bgMap.style.layers[0].maxzoom
    if (map.getZoom() > maxzoom - 0.2) {
      map.setZoom(maxzoom - 0.2)
    }
  })
  map.on('online', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', true) }) })
  map.on('offline', (_e) => { functions.e('#maplibre-map', e => { e.setAttribute('data-online', false) }) })

  // map.on('error', (err) => {
  //   console.log('map error >>> ', err)
  // })
}

export function addGeoJSONSource (sourceName, cluster=false ) {
  // https://maplibre.org/maplibre-style-spec/sources/#geojson
  // console.log("Adding source: " + sourceName)
  if (map.getSource(sourceName)) { return } // source already exists
  map.addSource(sourceName, {
    type: 'geojson',
    promoteId: 'id',
    data: { type: 'FeatureCollection', features: [] }, // geojsonData,
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

export function loadLayers () {
  // return if all layers already loaded (eg. in case of basemap style change)
  if (gon.map_layers.length == layers.length) {
    // console.log('All layers already loaded, re-rendering from cache', layers)
    initializeOverpassLayers()
    redrawGeojson()
    map.fire('geojson.load', { detail: { message: 'redraw cached geojson-source' } })
    return
  }

  const host = new URL(window.location.href).origin
  const url = host + '/m/' + window.gon.map_id + '.json'
  fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was not ok') }
      return response.json()
    })
    .then(data => {
      console.log('Loaded map layers from server: ', data.layers)
      // make sure we're still showing the map the request came from
      if (window.gon.map_properties.public_id !== data.properties.public_id){
        return
      }
      data.layers.forEach((layer) => {
        if (!layers.find( l => l.id === layer.id) ) {
          layers.push(layer)
        }
      })
      geojsonData = mergedGeoJSONLayers()
      redrawGeojson()
      functions.e('#maplibre-map', e => { e.setAttribute('data-geojson-loaded', true) })
      map.fire('geojson.load', { detail: { message: 'geojson-source loaded' } })
      initializeOverpassLayers()
    })
    .catch(error => {
      console.error('Failed to fetch GeoJSON:', error)
      console.error('GeoJSONData:', geojsonData)
    })
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
      window.gon.map_layers = data.layers
    })
    .catch(error => { console.error('Failed to fetch map properties', error) })
}

function addTerrain () {
  if (backgroundMapLayer === 'test') { return }
  map.addSource('terrain', elevationSource)
  map.setTerrain({
    source: 'terrain',
    exaggeration: 0.05
  })
  status('Terrain added to map')
}

function addHillshade () {
  if (backgroundMapLayer === 'test') { return }
  map.addSource('hillshade', elevationSource)
  map.addLayer({
    id: 'hills',
    type: 'hillshade',
    source: 'hillshade',
    layout: {visibility: 'visible'},
    paint: {
      "hillshade-method": "standard",
      'hillshade-shadow-color': '#473B24',
      "hillshade-exaggeration": 0.1
    }
  })
  status('Hillshade added to map')
}

function addContours () {
  if (backgroundMapLayer === 'test') { return }
  map.addSource('contours', {
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
      }),
    ],
    maxzoom: 16,
  })
  map.addLayer({
    id: "contours",
    type: "line",
    source: "contours",
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
    source: "contours",
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
  map.on('style.load', () => {
    initializeViewStyles('geojson-source')
    initializeKmMarkerStyles ()
  })
  functions.e('.maplibregl-ctrl-attrib, #map-head', e => { e.classList.add('hidden') })
}

export function initializeViewMode () {
  map.once('style.load', () => {
    initializeViewControls()
    initializeDefaultControls()
    initializeViewStyles('geojson-source')
    initializeKmMarkerStyles()
  })
  map.on('click', resetControls)
}

export function redrawGeojson (resetDraw = true) {
  // this + `promoteId: 'id'` is a workaround for the maplibre limitation:
  // https://github.com/mapbox/mapbox-gl-js/issues/2716
  // because to highlight a feature we need the id,
  // and in the style layers it only accepts mumeric ids in the id field initially
  mergedGeoJSONLayers('geojson').features.forEach((feature) => { feature.properties.id = feature.id })
  mergedGeoJSONLayers('overpass').features.forEach((feature) => { feature.properties.id = feature.id })

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
  layers.filter(f => f.type === 'overpass').forEach((layer) => {
    if (layer.geojson && layer.geojson.features.length > 0) {
      map.getSource('overpass-source-' + layer.id)?.setData(layer.geojson)
    }
  })

  map.triggerRepaint()
  // drop the properties.id after sending to the map
  mergedGeoJSONLayers('geojson').features.forEach((feature) => { delete feature.properties.id })
}

// change geojson data before rendering:
export function renderedGeojsonData () {
  // - For LineStrings with 'show-km-markers', show markers each X km
  renderKmMarkers()
  // - For LineStrings with a 'fill-extrusion-height', add a polygon to render extrusion
  let extrusionLines = renderExtrusionLines()
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
  layers.find(l => l.type === 'geojson').geojson.features.push(feature)
  geojsonData = mergedGeoJSONLayers()
  redrawGeojson()
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
  // only update feature if it was changed
  if (!equal(feature.geometry, updatedFeature.geometry) ||
    !equal(feature.properties, updatedFeature.properties)) {
    feature.geometry = updatedFeature.geometry
    feature.properties = updatedFeature.properties
    status('Updated feature ' + updatedFeature.id)
    redrawGeojson()
  }
}

export function destroyFeature (featureId) {
  if (geojsonData.features.find(f => f.id === featureId)) {
    status('Deleting feature ' + featureId)
    geojsonData.features = geojsonData.features.filter(f => f.id !== featureId)
    layers.forEach(l => l.geojson.features = l.geojson.features.filter(f => f.id !== featureId))
    redrawGeojson()
    resetHighlightedFeature()
  }
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
      // re-sort layers after basemap style change
      sortLayers()
    })
    backgroundMapLayer = mapName
    backgroundTerrain = mapProperties.terrain
    backgroundHillshade = mapProperties.hillshade
    backgroundContours = mapProperties.contours
    backgroundGlobe = mapProperties.globe
    setStyleDefaultFont(basemap.font || defaultFont)
    map.setStyle(basemap.style,
      // adding 'diff: false' so that 'style.load' gets triggered (https://github.com/maplibre/maplibre-gl-js/issues/2587)
      // which will trigger loadLayers()
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
  const directions = functions.reduceArray(layers, (e) => (e.id.startsWith('maplibre-gl-directions')))

  layers = layers.concat(mapExtrusions).concat(directions)
    .concat(mapSymbols).concat(points).concat(editLayer)
    .concat(userSymbols).concat(userLabels)
    .concat(lineLayerHits).concat(pointsLayerHits)
  const newStyle = { ...currentStyle, layers }
  map.setStyle(newStyle, { diff: true })

  // place km markers under symbols layer (icons)
  if (layers.find(layer => layer.id === 'km-marker-points')) {
    map.moveLayer('km-marker-points', 'symbols-layer_geojson-source')
    map.moveLayer('km-marker-numbers', 'symbols-layer_geojson-source')
  }

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

export function mergedGeoJSONLayers(type='geojson') {
  return { type: "FeatureCollection",
    features: layers.filter(f => f.type === type)
      .flatMap(layer => (layer?.geojson?.features || [])) }
}

export function frontFeature(frontFeature) {
  for (const layer of layers) {
    if (!layer?.geojson?.features) { continue }
    const features = layer.geojson.features
    const idx = features.findIndex(f => f.id === frontFeature.id)
    if (idx !== -1) {
      const [feature] = features.splice(idx, 1) // Remove it
      features.push(feature) // Add to end
      break // done, exit loop
    }
  }
  redrawGeojson()
}

export function viewUnchanged() {
  const tolerance = 0.01
  const mapInitCenter= (mapProperties.center || mapProperties.default_center)
  const lngMatch = Math.abs(map.getCenter().lng - mapInitCenter[0]) < tolerance
  const latMatch = Math.abs(map.getCenter().lat - mapInitCenter[1]) < tolerance
  // console.log(lngMatch && latMatch)
  return lngMatch && latMatch
}

