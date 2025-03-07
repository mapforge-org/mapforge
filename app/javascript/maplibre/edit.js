import { map, geojsonData, initializeDefaultControls, destroy, redrawGeojson } from 'maplibre/map'
import { editStyles, initializeEditStyles } from 'maplibre/edit_styles'
import { highlightFeature } from 'maplibre/feature'
import { mapChannel } from 'channels/map_channel'
import {
  ControlGroup, MapSettingsControl, MapShareControl, MapLayersControl,
  resetControls
} from 'maplibre/controls'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import equal from 'fast-deep-equal' // https://github.com/epoberezkin/fast-deep-equal
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import PaintMode from 'mapbox-gl-draw-paint-mode'
import { animateElement } from 'helpers/dom'
import Openrouteservice from 'openrouteservice-js'
import { decodePolyline } from 'helpers/polyline'

export let draw
export let selectedFeature
let justCreated = false
let lineMenu

MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl'
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-'
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group'

// https://github.com/mapbox/mapbox-gl-draw
export function initializeEditMode () {
  // console.log('Initializing MapboxDraw')

  // Patching direct select mode to not allow dragging features
  // similar to https://github.com/zakjan/mapbox-gl-draw-waypoint
  const DirectSelectMode = { ...MapboxDraw.modes.direct_select }
  DirectSelectMode.dragFeature = function (_state, _e, _delta) { /* noop */ }

  const SimpleSelectMode = { ...MapboxDraw.modes.simple_select }
  // DirectSelectMode.dragFeature = function (state, e, delta) { /* noop */ }

  const RoadMode = { ...MapboxDraw.modes.draw_line_string }
  const BicycleMode = { ...MapboxDraw.modes.draw_line_string }

  const modes = {
    ...MapboxDraw.modes,
    road: RoadMode,
    bicycle: BicycleMode,
    direct_select: DirectSelectMode,
    simple_select: SimpleSelectMode,
    draw_paint_mode: PaintMode
  }

  draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: true,
      line_string: true,
      point: true,
      trash: false,
      combine_features: false
      // uncombine_features
    },
    styles: editStyles(),
    clickBuffer: 5,
    touchBuffer: 25, // default 25
    // user properties are available, prefixed with 'user_'
    userProperties: true,
    modes
  })

  initializeDefaultControls()
  initializeEditControls()

  map.on('geojson.load', function (_e) {
    initializeEditStyles()
    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    const feature = geojsonData.features.find(f => f.id === urlFeatureId)
    if (feature) { select(feature) }
  })

  map.on('draw.modechange', () => {
    resetControls()
    functions.e('.ctrl-line-menu', e => { e.classList.add('hidden') })
    if (draw.getMode() !== 'simple_select') {
      functions.e('.maplibregl-canvas', e => { e.classList.add('cursor-crosshair') })
    }
    if (draw.getMode() === 'draw_paint_mode') {
      functions.e('.mapbox-gl-draw_paint', e => { e.classList.add('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Paint Mode: Click on the map to start drawing, double click to finish',
        'info', 'medium', 8000)
    } else if (draw.getMode() === 'road') {
      functions.e('.mapbox-gl-draw_road', e => { e.classList.add('active') })
      functions.e('.mapbox-gl-draw_line', e => { e.classList.remove('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Road Mode: Click on the map to set waypoints, double click to finish',
        'info', 'medium', 8000)
    } else if (draw.getMode() === 'bicycle') {
      functions.e('.mapbox-gl-draw_bicycle', e => { e.classList.add('active') })
      functions.e('.mapbox-gl-draw_line', e => { e.classList.remove('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Bicycle Mode: Click on the map to set waypoints, double click to finish',
        'info', 'medium', 8000)
    } else if (draw.getMode() === 'draw_point') {
      status('Point Mode: Click on the map to place a marker', 'info', 'medium', 8000)
    } else if (draw.getMode() === 'draw_polygon') {
      status('Polygon Mode: Click on the map to draw a polygon', 'info', 'medium', 8000)
    } else if (draw.getMode() === 'draw_line_string') {
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Line Mode: Click on the map to draw a line', 'info', 'medium', 8000)
    }
    // console.log('draw mode: ' + draw.getMode())
  })

  map.on('draw.selectionchange', function (e) {
    // probably mapbox draw bug: map can lose drag capabilities on double click
    map.dragPan.enable()

    if (!e.features?.length) { justCreated = false; return }
    if (justCreated) { justCreated = false; return }
    selectedFeature = e.features[0]
    if (geojsonData.features.find(f => f.id === selectedFeature.id)) {
      console.log('selected: ' + JSON.stringify(selectedFeature))
      select(selectedFeature)
      highlightFeature(selectedFeature, true)
    }
  })

  map.on('draw.create', handleCreate)
  map.on('draw.update', handleUpdate)
  map.on('draw.delete', handleDelete)

  // Mapbox Draw kills the click event on mobile (https://github.com/mapbox/mapbox-gl-js/issues/9114)
  // patching click on touchstart + touchend on same position
  let touchStartPosition
  let touchEndPosition
  map.on('touchstart', (e) => {
    touchStartPosition = e.point
  })
  map.on('touchend', (e) => {
    touchEndPosition = e.point
    if (touchStartPosition.x === touchEndPosition.x &&
      touchStartPosition.y === touchEndPosition.y &&
      draw.getMode() === 'simple_select') {
      map.fire('click')
    }
  })

  document.querySelector('#edit-buttons').classList.remove('hidden')
}

function initializeEditControls () {
  map.addControl(draw, 'top-left')
  addLineMenu()
  document.querySelector('button.mapbox-gl-draw_polygon').setAttribute('title', 'Draw polygon')
  document.querySelector('button.mapbox-gl-draw_point').setAttribute('title', 'Draw point')
  document.querySelector('.maplibregl-ctrl:has(button.ctrl-line-menu-btn)').classList.add('hidden') // hide for aos animation

  const controlGroup = new ControlGroup(
    [new MapSettingsControl(),
      new MapLayersControl(),
      new MapShareControl()])
  map.addControl(controlGroup, 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-map)').classList.add('hidden') // hide for aos animation

  map.once('load', function (_e) {
    animateElement('.maplibregl-ctrl:has(button.ctrl-line-menu-btn)', 'fade-right', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-map)', 'fade-right', 500)
  })
}

// switching directly from 'simple_select' to 'direct_select',
// allow only to select one feature
function select (feature) {
  if (feature.geometry.type !== 'Point') {
    draw.changeMode('direct_select', { featureId: feature.id })
  } else {
    draw.changeMode('simple_select', { featureIds: [feature.id] })
  }
}

async function handleCreate (e) {
  let feature = e.features[0] // Assuming one feature is created at a time
  const mode = draw.getMode()

  // simplify hand-drawing
  if (mode === 'draw_paint_mode') {
    const options = { tolerance: 0.00001, highQuality: true }
    feature = window.turf.simplify(feature, options)
  } else if (mode === 'road') {
    feature = await getRouteFeature(feature, feature.geometry.coordinates, 'driving-car')
  } else if (mode === 'bicycle') {
    feature = await getRouteFeature(feature, feature.geometry.coordinates, 'cycling-mountain')
  } else {
    // std mapbox draw shapes will auto-select the feature.
    // This prevents automatic selection + stays in current mode
    justCreated = true
  }
  status('Feature ' + feature.id + ' created')
  geojsonData.features.push(feature)
  // redraw if the painted feature was changed in this method
  if (mode === 'road' || mode === 'bicycle' || mode === 'draw_paint_mode') { redrawGeojson(false) }
  mapChannel.send_message('new_feature', feature)

  setTimeout(() => {
    draw.changeMode(mode)
    map.fire('draw.modechange') // not fired automatically with draw.changeMode()
  }, 10)
}

async function handleUpdate (e) {
  let feature = e.features[0] // Assuming one feature is updated at a time

  const geojsonFeature = geojsonData.features.find(f => f.id === feature.id)
  // mapbox-gl-draw-waypoint sends empty update when dragging on selected feature
  if (equal(geojsonFeature.geometry, feature.geometry)) {
    // console.log('Feature update event triggered without update')
    return
  }

  // change route
  if (feature.properties.route) {
    // new waypoints are start, end, changed point and current waypoints that are still in the feature
    const waypoints = [feature.geometry.coordinates[0]]
    // Track coordinate changes
    feature.geometry.coordinates.slice(1, -1).forEach((coord, index) => {
      if (coord[0] !== geojsonFeature.geometry.coordinates[index + 1][0] ||
          coord[1] !== geojsonFeature.geometry.coordinates[index + 1][1]) {
        waypoints.push(coord)
      } else if (functions.hasCoordinate(feature.properties.route.waypoints, coord)) {
        waypoints.push(coord)
      }
    })
    waypoints.push(feature.geometry.coordinates.at(-1))
    feature = await getRouteFeature(feature, waypoints, feature.properties.route.profile)
  }

  status('Feature ' + feature.id + ' changed')
  geojsonFeature.geometry = feature.geometry
  redrawGeojson(false)
  mapChannel.send_message('update_feature', feature)
  // trigger highlight, to update eg. coordinates
  highlightFeature(feature, true)
}

export function handleDelete (e) {
  selectedFeature = null
  const deletedFeature = e.features[0] // Assuming one feature is deleted at a time
  destroy(deletedFeature.id)
  status('Feature ' + deletedFeature.id + ' deleted')
  mapChannel.send_message('delete_feature', { id: deletedFeature.id })
}

export function disableEditControls () {
  functions.e('.mapbox-gl-draw_ctrl-draw-btn', e => { e.disabled = true })
  functions.e('.maplibregl-ctrl-map', e => { e.disabled = true })
  functions.e('#save-map-name', e => { e.disabled = true })
  functions.e('#save-map-defaults', e => { e.disabled = true })
}

export function enableEditControls () {
  functions.e('.mapbox-gl-draw_ctrl-draw-btn', e => { e.disabled = false })
  functions.e('.maplibregl-ctrl-map', e => { e.disabled = false })
  functions.e('#save-map-name', e => { e.disabled = false })
  functions.e('#save-map-defaults', e => { e.disabled = false })
}

function addLineMenu () {
  const originalButton = document.querySelector('.mapbox-gl-draw_line')
  originalButton.title = 'Draw line'
  originalButton.setAttribute('data-bs-placement', 'right')
  lineMenu = document.createElement('div')
  document.querySelector('.maplibregl-ctrl-top-left').appendChild(lineMenu)
  lineMenu.classList.add('maplibregl-ctrl-group')
  lineMenu.classList.add('maplibregl-ctrl')
  lineMenu.classList.add('ctrl-line-menu')
  lineMenu.classList.add('hidden')

  const lineMenuButton = originalButton.cloneNode(true)
  lineMenuButton.title = 'Select line draw mode'
  lineMenuButton.classList.add('ctrl-line-menu-btn')
  lineMenuButton.removeEventListener('click', null)
  lineMenuButton.addEventListener('click', (_e) => {
    draw.changeMode('simple_select')
    if (lineMenu.classList.contains('hidden')) {
      lineMenu.classList.remove('hidden')
    } else {
      lineMenu.classList.add('hidden')
      resetControls()
    }
  })
  const parentElement = originalButton.parentElement
  parentElement.insertBefore(lineMenuButton, originalButton.nextSibling)
  lineMenu.appendChild(originalButton)
  addPaintButton()
  if (window.gon.map_keys.openrouteservice) {
    addBicycleButton()
    addRoadButton()
  }
}

function addPaintButton () {
  const originalButton = document.querySelector('.ctrl-line-menu .mapbox-gl-draw_line')
  const paintButton = originalButton.cloneNode(true)
  paintButton.title = 'Draw freehand'
  paintButton.classList.remove('mapbox-gl-draw_line')
  paintButton.classList.add('mapbox-gl-draw_paint')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-pencil-fill')
  paintButton.appendChild(icon)
  paintButton.removeEventListener('click', null)
  paintButton.addEventListener('click', (_e) => {
    if (draw.getMode() === 'draw_paint_mode') {
      draw.changeMode('simple_select')
    } else {
      draw.changeMode('draw_paint_mode')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(paintButton)
}

function addRoadButton () {
  const originalButton = document.querySelector('.ctrl-line-menu .mapbox-gl-draw_line')
  const roadButton = originalButton.cloneNode(true)
  roadButton.title = 'Calculate a car route'
  roadButton.classList.remove('mapbox-gl-draw_line')
  roadButton.classList.add('mapbox-gl-draw_road')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-car-front-fill')
  roadButton.appendChild(icon)
  roadButton.removeEventListener('click', null)
  roadButton.addEventListener('click', (_e) => {
    if (draw.getMode() === 'road') {
      draw.changeMode('simple_select')
    } else {
      draw.changeMode('road')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(roadButton)
}

function addBicycleButton () {
  const originalButton = document.querySelector('.ctrl-line-menu .mapbox-gl-draw_line')
  const bicycleButton = originalButton.cloneNode(true)
  bicycleButton.title = 'Calculate a bike route'
  bicycleButton.classList.remove('mapbox-gl-draw_line')
  bicycleButton.classList.add('mapbox-gl-draw_bicycle')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-bicycle')
  bicycleButton.appendChild(icon)
  bicycleButton.removeEventListener('click', null)
  bicycleButton.addEventListener('click', (_e) => {
    if (draw.getMode() === 'bicycle') {
      draw.changeMode('simple_select')
    } else {
      draw.changeMode('bicycle')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(bicycleButton)
}

// profiles are: driving-car, driving-hgv(heavy goods vehicle), cycling-regular,
//               cycling-road, cycling-mountain, cycling-electric, foot-walking,
//               foot-hiking,wheelchair
// openrouteservice js lib: https://github.com/GIScience/openrouteservice-js?tab=readme-ov-file
// openrouteservice API: https://giscience.github.io/openrouteservice/api-reference/
async function getRouteFeature (feature, waypoints, profile) {
  const Snap = new Openrouteservice.Snap({ api_key: window.gon.map_keys.openrouteservice })
  const orsDirections = new Openrouteservice.Directions({ api_key: window.gon.map_keys.openrouteservice })

  console.log('get ' + profile + ' route for: ' + waypoints)
  try {
    const snapResponse = await Snap.calculate({
      locations: waypoints,
      radius: 300,
      profile,
      format: 'json'
    })
    console.log('snap response: ', snapResponse)
    waypoints = snapResponse.locations.map(item => item.location)
    console.log('snapped values: ', waypoints)

    const routeResponse = await orsDirections.calculate({
      coordinates: waypoints,
      profile
    })
    console.log('route response: ', routeResponse)
    const routeLocations = decodePolyline(routeResponse.routes[0].geometry)
    console.log('routeLocations: ', routeLocations)
    feature.geometry.coordinates = routeLocations

    // store waypoint indexes in coordinate for style highlight
    const waypointIndexes = []
    waypoints.forEach((waypoint) => {
      const index = functions.findCoordinate(routeLocations, waypoint)
      if (index >= 0) waypointIndexes.push(index + '')
    })

    feature.properties.route = { profile, waypoints }
    feature.properties.waypointIndexes = waypointIndexes
  } catch (err) {
    console.error('An error occurred: ' + err)
  }
  return feature
}
