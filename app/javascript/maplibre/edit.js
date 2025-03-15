import { map, geojsonData, destroy, redrawGeojson } from 'maplibre/map'
import { editStyles, initializeEditStyles } from 'maplibre/edit_styles'
import { highlightFeature } from 'maplibre/feature'
import { mapChannel } from 'channels/map_channel'
import { resetControls, initializeDefaultControls } from 'maplibre/controls/shared'
import { initializeEditControls } from 'maplibre/controls/edit'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import equal from 'fast-deep-equal' // https://github.com/epoberezkin/fast-deep-equal
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import PaintMode from 'mapbox-gl-draw-paint-mode'
import Openrouteservice from 'openrouteservice-js'
import { decodePolyline } from 'helpers/polyline'

export let draw
export let selectedFeature
let justCreated = false

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

  initializeEditControls()
  initializeDefaultControls()

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
    //console.log('draw mode: ' + draw.getMode())
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
  // in edit mode, map click handler is only needed to hide modals
  map.on('click', () => {
    if (document.querySelector('.maplibregl-ctrl button.active')) {
      resetControls()
    }
  })

  document.querySelector('#edit-buttons').classList.remove('hidden')
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
