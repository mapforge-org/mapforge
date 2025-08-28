import { map, geojsonData, destroyFeature, redrawGeojson, addFeature, layers, mapProperties } from 'maplibre/map'
import { editStyles, initializeEditStyles } from 'maplibre/edit_styles'
import { initializeViewStyles } from 'maplibre/styles'
import { highlightFeature, showFeatureDetails, initializeKmMarkerStyles } from 'maplibre/feature'
import { getRouteUpdate, getRouteElevation } from 'maplibre/routing/openrouteservice'
import { initDirections, resetDirections } from 'maplibre/routing/osrm'
import { mapChannel } from 'channels/map_channel'
import { resetControls, initializeDefaultControls } from 'maplibre/controls/shared'
import { initializeEditControls } from 'maplibre/controls/edit'
import { status } from 'helpers/status'
import { undo, redo, addUndoState } from 'maplibre/undo'
import * as functions from 'helpers/functions'
import equal from 'fast-deep-equal' // https://github.com/epoberezkin/fast-deep-equal

export let draw
export let selectedFeature
let currentMode
let justCreated = false

// https://github.com/mapbox/mapbox-gl-draw
export async function initializeEditMode () {
  // console.log('Initializing MapboxDraw')
  // async load mapbox-gl-draw
  const MapboxDrawModule = await import('@mapbox/mapbox-gl-draw')
  const MapboxDraw = MapboxDrawModule.default

  MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl'
  MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-'
  MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group'

  // Patching direct select mode to not allow dragging features
  // similar to https://github.com/zakjan/mapbox-gl-draw-waypoint
  const DirectSelectMode = { ...MapboxDraw.modes.direct_select }
  DirectSelectMode.dragFeature = function (_state, _e, _delta) { /* noop */ }

  const DirectionsMode = { ...MapboxDraw.modes.simple_select }
  DirectionsMode.onClick = function (_state, _e, _delta) { /* noop */ }
  const DirectionsCarMode = { ...DirectionsMode }
  const DirectionsBikeMode = { ...DirectionsMode }
  const DirectionsFootMode = { ...DirectionsMode }

  // load mapbox-gl-draw-paint-mode on demand
  const PaintModeModule = await import('mapbox-gl-draw-paint-mode')
  const PaintMode = PaintModeModule.default

  const modes = {
    ...MapboxDraw.modes,
    directions_car: DirectionsCarMode,
    directions_bike: DirectionsBikeMode,
    directions_foot: DirectionsFootMode,
    direct_select: DirectSelectMode,
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

  // Add edit styles when basemap style is loaded
  map.on('style.load', function (_e) {
    // initializeEditStyles()
    initializeViewStyles('geojson-source')
    initializeKmMarkerStyles()
  })

  // Show map settings modal on untouched map
  map.once('load', function (_e) {
    if (!mapProperties.name && !geojsonData?.features?.length && !layers?.filter(l => l.type !== 'geojson').length)  {
      functions.e('.maplibregl-ctrl-map', e => { e.click() })
    }
  })

  map.on('geojson.load', function (_e) {
    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    const feature = geojsonData.features.find(f => f.id === urlFeatureId)
    if (feature) { map.fire('draw.selectionchange', {features: [feature]}) }
  })

  map.on('draw.modechange', () => {
    if (currentMode === draw.getMode()) { return }
    console.log("Switch draw mode from '" + currentMode + "' to '" + draw.getMode() + "'")
    currentMode = draw.getMode()

    resetDirections()
    //resetControls()
    functions.e('.ctrl-line-menu', e => { e.classList.add('hidden') })
    if (draw.getMode() !== 'simple_select' && draw.getMode() !== 'direct_select') {
      functions.e('.maplibregl-canvas', e => { e.classList.add('cursor-crosshair') })
    } else {
      functions.e('.maplibregl-ctrl-select', e => { e.classList.add('active') })
      functions.e('.maplibregl-canvas', e => { e.classList.remove('cursor-crosshair') })
    }
    if (draw.getMode() === 'draw_paint_mode') {
      functions.e('.mapbox-gl-draw_paint', e => { e.classList.add('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Paint Mode: Click on the map to start drawing, release to finish',
        'info', 'medium', 8000)
    } else if (draw.getMode() === 'directions_car') {
      functions.e('.mapbox-gl-draw_road', e => { e.classList.add('active') })
      functions.e('.mapbox-gl-draw_line', e => { e.classList.remove('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Road Mode: Click on the map to set waypoints, double click to finish',
        'info', 'medium', 8000)
      initDirections('car')
    } else if (draw.getMode() === 'directions_bike') {
      functions.e('.mapbox-gl-draw_bicycle', e => { e.classList.add('active') })
      functions.e('.mapbox-gl-draw_line', e => { e.classList.remove('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Bicycle Mode: Click on the map to set waypoints, double click to finish',
        'info', 'medium', 8000)
      initDirections('bike')
    } else if (draw.getMode() === 'directions_foot') {
      functions.e('.mapbox-gl-draw_foot', e => { e.classList.add('active') })
      functions.e('.mapbox-gl-draw_line', e => { e.classList.remove('active') })
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Walk Mode: Click on the map to set waypoints, double click to finish',
        'info', 'medium', 8000)
      initDirections('foot')
    } else if (draw.getMode() === 'draw_point') {
      status('Point Mode: Click on the map to place a marker', 'info', 'medium', 8000)
    } else if (draw.getMode() === 'draw_polygon') {
      status('Polygon Mode: Click on the map to draw a polygon', 'info', 'medium', 8000)
    } else if (draw.getMode() === 'draw_line_string') {
      functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') })
      status('Line Mode: Click on the map to draw a line', 'info', 'medium', 8000)
    }
  })

  map.on('draw.selectionchangex', function (e) {
    // probably mapbox draw bug: map can lose drag capabilities on double click
    map.dragPan.enable()
    if (!e.features?.length) { justCreated = false; selectedFeature = null; return }
    // console.log('draw.selectionchange', e.features)
    if (selectedFeature && (selectedFeature.id === e.features[0].id)) { return }
    selectedFeature = e.features[0]

    if (geojsonData.features.find(f => f.id === selectedFeature.id)) {
      document.querySelector('#edit-buttons').classList.remove('hidden')
      select(selectedFeature)
      highlightFeature(selectedFeature, true)
      // switch feature details to edit mode after create
      if (justCreated) {
        justCreated = false
        window.dispatchEvent(new CustomEvent("toggle-edit-feature"))
      }
    }
  })

  // https://github.com/mapbox/mapbox-gl-draw/blob/main/src/constants.js#L57
  map.on('draw.create', handleCreate)
  map.on('draw.update', handleUpdate)
  map.on('draw.delete', handleDelete)

  // Mapbox Draw kills the click event on mobile (https://github.com/mapbox/mapbox-gl-js/issues/9114)
  // patching click on touchstart + touchend on same position
  // alternative solution: https://github.com/mapbox/mapbox-gl-draw/issues/617#issuecomment-2764850360
  let touchStartPosition
  let touchEndPosition
  map.on('touchstart', (e) => {
    touchStartPosition = e.point
  })
  map.on('touchend', (e) => {
    touchEndPosition = e.point
    if (touchStartPosition.x === touchEndPosition.x &&
      touchStartPosition.y === touchEndPosition.y &&
      (draw.getMode() === 'simple_select' || draw.getMode().startsWith('directions_'))) {
      map.fire('click', e) // attach original event for coordinates
    }
  })

  // in edit mode, map click handler is needed to hide modals
  // and to hide feature modal if no feature is selected
  map.on('click', () => {
    // mapbox draw type features don't fire map.click, but directions does - ignore it
    if (!draw.getMode().startsWith('directions_')) {
      selectedFeature = null
      resetControls()
      document.querySelector('#edit-buttons').classList.add('hidden')
      document.querySelector('.maplibregl-ctrl-select').classList.add('active')
    }
  })

  document.addEventListener('keydown', function (event) {
    // console.log('key', event)
    if (functions.isFormFieldFocused()) { return }
    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault()
      undo()
    }
    if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
      event.preventDefault()
      redo()
    }
  })
}

// switching directly from 'simple_select' to 'direct_select',
// allow only to select one feature
// direct_select mode does not allow to select other features
export function select (feature) {
  console.log('select', feature)
  if (feature?.properties?.route?.provider === 'osrm') {
    let profile = feature?.properties?.route?.profile
    draw.changeMode('directions_' + profile)
    map.fire('draw.modechange') // fire event before initDirections
    initDirections(profile, feature)
    functions.e('.maplibregl-canvas', e => { e.classList.add('cursor-crosshair') })
  } else if (feature.geometry.type === 'Point') {
    draw.changeMode('simple_select', { featureIds: [feature.id] })
    map.fire('draw.modechange')
  } else {
    draw.changeMode('direct_select', { featureId: feature.id })
    map.fire('draw.modechange')
  }
}

function handleCreate (e) {
  // console.log('handleCreate')
  let feature = e.features[0] // Assuming one feature is created at a time
  const mode = draw.getMode()

  // simplify hand-drawing
  if (mode === 'draw_paint_mode') {
    const options = { tolerance: 0.00005, highQuality: true, mutate: true }
    window.turf.simplify(feature, options)
  }
  // std mapbox draw shapes will auto-select the feature (simple_select).
  // This var enables special handling in draw.selectionchange
  justCreated = true
  // status('Feature ' + feature.id + ' created')
  addFeature(feature)
  addUndoState('Feature added', feature)
  // redraw if the painted feature was changed in this method
  if (mode === 'directions_car' || mode === 'directions_bike' || mode === 'directions_foot' || mode === 'draw_paint_mode') {
    redrawGeojson(false)
  }
  mapChannel.send_message('new_feature', feature)
  if (feature.geometry.type === 'LineString') { updateElevation(feature) }

  // Switch back to draw mode to create multiple features
  // setTimeout(() => {
  //   if (draw.getMode() !== mode) {
  //     draw.changeMode(mode)
  //     map.fire('draw.modechange') // not fired automatically with draw.changeMode()
  //   }
  // }, 10)
}

async function handleUpdate (e) {
  let feature = e.features[0] // Assuming one feature is updated at a time
  const geojsonFeature = geojsonData.features.find(f => f.id === feature.id)
  // mapbox-gl-draw-waypoint sends empty update when dragging on selected feature
  if (equal(geojsonFeature.geometry, feature.geometry)) {
    // console.log('Feature update event triggered without update')
    return
  }
  addUndoState('Feature update', geojsonFeature)
  // change route with openrouteservice
  if (selectedFeature?.properties?.route?.provider === 'ors') {
    feature = await getRouteUpdate(geojsonFeature, feature)
  }

  status('Feature ' + feature.id + ' changed')
  geojsonFeature.geometry = feature.geometry
  redrawGeojson(false)

  if (feature.geometry.type === 'LineString') { 
    // gets also triggered on failure
    updateElevation(feature).then(() => {
      mapChannel.send_message('update_feature', feature)
      // trigger highlight, to update eg. coordinates
      showFeatureDetails(feature)
    })
  } else { 
    mapChannel.send_message('update_feature', feature)
    // trigger highlight, to update eg. coordinates
    highlightFeature(feature, true)
  }
}

export function handleDelete (e) {
  selectedFeature = null
  const deletedFeature = e.features[0] // Assuming one feature is deleted at a time
  destroyFeature(deletedFeature.id)
  addUndoState('Feature deleted', deletedFeature)
  resetDirections()
  status('Feature deleted')
  mapChannel.send_message('delete_feature', { id: deletedFeature.id })
}

// add elevation from openrouteservice async
export function updateElevation(feature) {
  return getRouteElevation(feature.geometry.coordinates).then(coords => {
    if (feature.geometry.coordinates.length === coords?.length) {
      feature.geometry.coordinates = coords
    } else { 
      console.warn('Did not receive elevation for all coords (water?)')
    }
  })
}
