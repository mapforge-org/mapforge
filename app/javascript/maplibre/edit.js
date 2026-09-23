import { centroid } from "@turf/centroid";
import { coordEach } from "@turf/meta";
import { toMercator, toWgs84 } from "@turf/projection";
import { simplify } from "@turf/simplify";
import { sendMessage } from 'channels/map_channel';
import equal from 'fast-deep-equal'; // https://github.com/epoberezkin/fast-deep-equal
import * as functions from 'helpers/functions';
import { hideInfoStatus, status } from 'helpers/status';
import { hideContextMenu } from 'maplibre/controls/context_menu';
import { disableEditControls, enableEditControls, initializeEditControls } from 'maplibre/controls/edit';
import { isGeolocateCompassModeActive } from 'maplibre/controls/geolocate';
import { initializeDefaultControls, resetControls } from 'maplibre/controls/shared';
import { featureLabel, highlightFeature } from 'maplibre/feature';
import { refreshFeatureMeta } from 'maplibre/feature/details';
import { CLICK_TOLERANCE } from 'maplibre/layers/layer';
import { addFeature, applyFeatureUpdate, destroyFeature, getFeature, hasFeatures, initializeLayers, layers, renderLayers } from 'maplibre/layers/layers';
import { map, mapProperties, onMapClickAfterLayers } from 'maplibre/map';
import { initDirections, resetDirections } from 'maplibre/routing/directions';
import { getRouteUpdate, updateElevation } from 'maplibre/routing/openrouteservice';
import { editStyles, initializeEditStyles } from 'maplibre/styles/edit_styles';
import { addUndoState, redo, undo } from 'maplibre/undo';

export let draw
// The route feature that directions currently edits. Only directions sets it.
export let selectedRoute
let currentMode
// Rotate mode is simple_select with a rotating drag, because many handlers only treat
// simple_select and direct_select as select modes.
let rotating = false

// Every handler that initializeEditMode() registers stays alive after a switch to
// view mode, so the edit-only ones must check the current mode when they fire.
const inEditMode = () => window.gon.map_mode === 'rw'

// The messages are functions so that the translation runs after the locale loads
const DRAW_MODES = {
  draw_paint_mode: {
    button: '.mapbox-gl-draw_paint', lineMenu: true,
    message: () => window.__('Paint Mode: Click on the map to start drawing, release to finish')
  },
  directions_car: {
    button: '.mapbox-gl-draw_road', lineMenu: true, profile: 'car',
    message: () => window.__('Road Mode: Click on the map to set waypoints, double click to finish')
  },
  directions_bike: {
    button: '.mapbox-gl-draw_bicycle', lineMenu: true, profile: 'bike',
    message: () => window.__('Bicycle Mode: Click on the map to set waypoints, double click to finish')
  },
  directions_foot: {
    button: '.mapbox-gl-draw_foot', lineMenu: true, profile: 'foot',
    message: () => window.__('Walk Mode: Click on the map to set waypoints, double click to finish')
  },
  draw_point: {
    button: '.mapbox-gl-draw_point',
    message: () => window.__('Point Mode: Click on the map to place a marker')
  },
  draw_polygon: {
    button: '.mapbox-gl-draw_polygon',
    message: () => window.__('Polygon Mode: Click on the map to draw a polygon')
  },
  draw_line_string: {
    button: '.ctrl-line-menu .mapbox-gl-draw_line', lineMenu: true,
    message: () => window.__('Line Mode: Click on the map to draw a line')
  }
}

// https://github.com/mapbox/mapbox-gl-draw
export async function initializeEditMode () {
  // A mode switch back into edit mode only needs the controls again. draw and every
  // map.on() handler below must stay registered exactly once. resetEditMode() clears
  // draw for each new map, so a fresh page still runs the full setup.
  if (draw) { initializeEditControls(); return }

  // console.log('Initializing MapboxDraw')
  // async load mapbox-gl-draw
  const MapboxDrawModule = await import('@mapbox/mapbox-gl-draw')
  const MapboxDraw = MapboxDrawModule.default

  MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl'
  MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-'
  MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group'

  // load mapbox-gl-draw-paint-mode on demand
  const PaintModeModule = await import('mapbox-gl-draw-paint-mode')

  draw = new MapboxDraw({
    displayControlsDefault: false,
    controls: {
      polygon: false,
      line_string: false,
      point: false,
      trash: false,
      combine_features: false
      // uncombine_features
    },
    styles: editStyles(),
    clickBuffer: CLICK_TOLERANCE,
    touchBuffer: 5, // default 25, allow more fine selection eg. of midpoints
    // user properties are available, prefixed with 'user_'
    userProperties: true,
    modes: buildModes(MapboxDraw.modes, PaintModeModule.default)
  })

  // Expose draw for testing
  window.draw = draw

  // draw re-adds its layers from options.styles on every style change, so swapping the
  // array here is enough to pick up the defaults of the new basemap. draw stores the
  // styles already split per source bucket, so rebuild them the same way it does.
  map.on('basemap.change', () => {
    const editLayers = editStyles()
    const sourceless = editLayers.filter(style => !style.source)
    const bucketed = bucket => sourceless.map(style =>
      ({ ...style, id: `${style.id}.${bucket}`, source: `mapbox-gl-draw-${bucket}` }))
    draw.options.styles = [...editLayers.filter(style => style.source), ...bucketed('cold'), ...bucketed('hot')]
  })

  initializeEditStyles()
  initializeEditControls()
  initializeDefaultControls()

  // Show map settings modal on untouched map and handle URL feature selection
  map.once('load', async function (_e) {
    // Safe to call even if already triggered by style.load — returns the cached promise, no double loading
    await initializeLayers()
    if (!mapProperties.name && !hasFeatures('geojson') && !layers?.filter(l => l.type !== 'geojson').length)  {
      functions.e('.maplibregl-ctrl-map', e => { e.click() })
    }

    const urlFeatureId = new URLSearchParams(window.location.search).get('f')
    const feature = getFeature(urlFeatureId, 'geojson')
    if (feature) { map.fire('draw.selectionchange', {features: [feature]}) }
  })

  map.on('draw.modechange', handleModeChange)

  // https://github.com/mapbox/mapbox-gl-draw/blob/main/src/constants.js#L57
  map.on('draw.create', handleCreate)
  map.on('draw.update', handleUpdate)
  map.on('draw.delete', handleDelete)

  patchTouchClick()

  map.on('online', (_e) => { enableEditControls() })
  map.on('offline', (_e) => { disableEditControls() })

  // in edit mode, map click handler is needed to hide modals
  // and to hide feature modal if no feature is selected
  onMapClickAfterLayers(() => {
    // mapbox draw type features don't fire map.click, but directions does - ignore it
    if (draw.getMode() == 'direct_select' || draw.getMode() == 'simple_select') {
      selectedRoute = null
      resetControls()
      // the edit controls are gone after a switch to view mode
      functions.e('#edit-buttons', e => { e.classList.add('hidden') })
      functions.e('.maplibregl-ctrl-select', e => { e.classList.add('active') })
    }
  })

  document.addEventListener('keydown', function (event) {
    // console.log('key', event)
    if (!inEditMode()) { return }
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

function buildModes (drawModes, PaintMode) {
  // Patching direct select mode to not allow dragging features
  // similar to https://github.com/zakjan/mapbox-gl-draw-waypoint
  const DirectSelectMode = { ...drawModes.direct_select }
  DirectSelectMode.dragFeature = function (_state, _e, _delta) { /* noop */ }

  // Hide context menu when dragging vertices
  const originalDragVertex = DirectSelectMode.dragVertex
  DirectSelectMode.dragVertex = function (state, e, delta) {
    hideContextMenu()
    return originalDragVertex.call(this, state, e, delta)
  }

  // Patch simple select mode to hide context menu when dragging points
  const SimpleSelectMode = { ...drawModes.simple_select }
  const originalStartOnActiveFeature = SimpleSelectMode.startOnActiveFeature
  SimpleSelectMode.startOnActiveFeature = function (state, e) {
    hideContextMenu()
    state.rotateStart = null
    return originalStartOnActiveFeature.call(this, state, e)
  }

  const originalDragMove = SimpleSelectMode.dragMove
  SimpleSelectMode.dragMove = function (state, e) {
    if (!rotating) { return originalDragMove.call(this, state, e) }
    state.dragMoving = true
    e.originalEvent.stopPropagation()
    const feature = this.getSelected()[0]
    const angleTo = (pivot, [x, y]) => Math.atan2(y - pivot[1], x - pivot[0])
    const mouse = toMercator([e.lngLat.lng, e.lngLat.lat])
    if (!state.rotateStart) {
      // rotate in Web Mercator, in lng/lat degrees the shape would skew away from the equator
      const geometry = toMercator(feature.toGeoJSON().geometry)
      const pivot = centroid(geometry).geometry.coordinates
      state.rotateStart = { geometry, pivot, angle: angleTo(pivot, mouse) }
    }
    const { geometry, pivot, angle } = state.rotateStart
    const delta = angleTo(pivot, mouse) - angle
    const [cos, sin] = [Math.cos(delta), Math.sin(delta)]
    const rotated = structuredClone(geometry)
    coordEach(rotated, c => {
      const [x, y] = [c[0] - pivot[0], c[1] - pivot[1]]
      c[0] = pivot[0] + x * cos - y * sin
      c[1] = pivot[1] + x * sin + y * cos
    })
    feature.incomingCoords(toWgs84(rotated, { mutate: true }).coordinates)
  }

  const DirectionsMode = { ...SimpleSelectMode }
  DirectionsMode.onClick = function (_state, _e, _delta) { /* noop */ }

  // simple_select draws the vertices of a selected line or polygon on top of it. draw only
  // starts a move on the feature itself, so a drag that starts on a vertex would pan the map.
  for (const handler of ['onMouseDown', 'onTouchStart']) {
    const original = SimpleSelectMode[handler]
    SimpleSelectMode[handler] = function (state, e) {
      const target = e.featureTarget?.properties
      if (target?.meta === 'vertex') {
        return this.startOnActiveFeature(state, { ...e, featureTarget: { properties: { id: target.parent } } })
      }
      return original.call(this, state, e)
    }
  }

  return {
    ...drawModes,
    simple_select: SimpleSelectMode,
    directions_car: DirectionsMode,
    directions_bike: DirectionsMode,
    directions_foot: DirectionsMode,
    direct_select: DirectSelectMode,
    draw_paint_mode: PaintMode
  }
}

function handleModeChange () {
  // probably mapbox draw bug: map can lose drag capabilities on double click
  if (!isGeolocateCompassModeActive()) map.dragPan.enable()
  const mode = draw.getMode()
  if (mode !== 'simple_select') { rotating = false }
  syncGeometryModeUi(mode)
  if (currentMode === mode) { return }
  console.log("Switch draw mode from '" + currentMode + "' to '" + mode + "'")

  setExtrusionOpacity(mode === 'simple_select' || mode.startsWith('draw_'))

  currentMode = mode
  resetDirections()
  functions.e('.ctrl-line-menu', e => { e.classList.add('hidden') })
  // any paint mode
  if (mode !== 'simple_select' && mode !== 'direct_select') {
    functions.e('.maplibregl-canvas', e => { e.classList.add('cursor-crosshair') })
    functions.e('.maplibregl-ctrl-select', e => { e.classList.remove('active') })
  } else {
    // select mode
    hideInfoStatus()
    functions.e('.maplibregl-ctrl-select', e => { e.classList.add('active') })
    functions.e('.maplibregl-canvas', e => { e.classList.remove('cursor-crosshair') })
  }

  const config = DRAW_MODES[mode]
  if (!config) { return }
  functions.e(config.button, e => { e.classList.add('active') })
  if (config.lineMenu) { functions.e('.ctrl-line-menu', e => { e.classList.remove('hidden') }) }
  status(config.message(), 'info', 'medium', 8000)
  if (config.profile) { initDirections(config.profile) }
}

// A click on the selected line or polygon in move mode makes draw switch to direct_select
// by itself, so the buttons follow the draw mode and not the button click.
function syncGeometryModeUi (mode) {
  let geometryMode = 'reshape'
  if (mode === 'simple_select' && draw.getSelected().features.some(f => f.geometry.type !== 'Point')) {
    geometryMode = rotating ? 'rotate' : 'move'
  }
  document.querySelectorAll('#geometry-mode-ui [data-geometry-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.geometryMode === geometryMode)
  })
  functions.e('[data-edit-section="geometry"]', e => {
    e.classList.toggle('geometry-moving', geometryMode === 'move')
    e.classList.toggle('geometry-rotating', geometryMode === 'rotate')
  })
}

// Reduce extrusion opacity to make edit handles visible. When restoring, each
// bucket layer goes back to its own opacity (encoded as the trailing number in
// the layer id, e.g. polygon-layer-extrusion-7_... → 0.7).
function setExtrusionOpacity (restoring) {
  if (!map.getStyle || !map.getStyle().layers) { return }
  map.getStyle().layers
    .filter(l => l.id.startsWith('polygon-layer-extrusion-'))
    .forEach(l => {
      const bucket = parseInt(l.id.match(/^polygon-layer-extrusion-(\d+)_/)?.[1], 10)
      const opacity = restoring ? bucket / 10 : 0.5
      map.setPaintProperty(l.id, 'fill-extrusion-opacity', opacity)
    })
}

// Mapbox Draw kills the click event on mobile (https://github.com/mapbox/mapbox-gl-js/issues/9114)
// patching click on touchstart + touchend on same position
// alternative solution: https://github.com/mapbox/mapbox-gl-draw/issues/617#issuecomment-2764850360
function patchTouchClick () {
  // A finger tap drifts, so the slop matches the platform touch slop (~8dp) instead of the
  // 3px mouse threshold. Below this, no click fires at all and no feature can be selected.
  const TAP_SLOP = 10
  let touchStartPosition
  map.on('touchstart', (e) => {
    touchStartPosition = e.point
  })
  map.on('touchend', (e) => {
    // No mode check: draw stays attached in view mode and keeps killing the click there
    const touchEndPosition = e.point
    if (touchStartPosition &&
      Math.abs(touchStartPosition.x - touchEndPosition.x) < TAP_SLOP &&
      Math.abs(touchStartPosition.y - touchEndPosition.y) < TAP_SLOP &&
      (draw.getMode() === 'simple_select' || draw.getMode().startsWith('directions_')) &&
      !map.longPressTriggered) {
      // Construct an event-like object that has preventDefault as an own property.
      // map.fire('click', e) loses prototype methods like preventDefault during the
      // event-data extend, breaking layer click handlers that call e.preventDefault().
      map.fire('click', {
        point: e.point,
        lngLat: e.lngLat,
        originalEvent: e.originalEvent,
        preventDefault () { this.defaultPrevented = true }
      })
    }
    // Fix for mapbox-gl-draw issue #650: after a touch-drag, the draw library's
    // state machine can fail to re-enable dragPan, freezing the map.
    // Run after draw's own touchend handler via setTimeout to restore it.
    // Excluded: draw_paint_mode (intentionally disables dragPan for freehand drawing)
    if (draw.getMode() !== 'draw_paint_mode') {
      setTimeout(() => { if (!isGeolocateCompassModeActive()) map.dragPan.enable() }, 0)
    }
  })
}

export function resetEditMode() {
  draw = null
}

// draw.changeMode() does not fire 'draw.modechange' itself
function changeMode (mode, options) {
  draw.changeMode(mode, options)
  map.fire('draw.modechange')
}

export function toggleDrawMode(mode) {
  // e.preventDefault()
  if (draw.getMode() === mode) {
    return  // noop - mode stays active
  }
  resetControls()
  changeMode(mode)
}

// switching directly from 'simple_select' to 'direct_select',
// allow only to select one feature
// direct_select mode does not allow to select other features
export function select (feature, { geometryMode = 'reshape' } = {}) {
  // console.log('select', feature)
  rotating = geometryMode === 'rotate'
  const route = feature?.properties?.route
  if (route?.provider === 'osrm' || route?.provider === 'ors') {
    // don't re-initialize direction if already active on same feature
    if (draw.getMode() !== 'directions_' + route.profile
      || selectedRoute?.id !== feature.id) {
      changeMode('directions_' + route.profile) // fire event before initDirections
      initDirections(route.profile, feature)
    }
  } else if (feature.geometry.type === 'Point' || geometryMode !== 'reshape') {
    changeMode('simple_select', { featureIds: [feature.id] })
  } else {
    changeMode('direct_select', { featureId: feature.id })
  }
}

export function unselect() {
  draw.deleteAll()
  resetDirections()
  changeMode('simple_select')
}

function handleCreate (e) {
  // console.log('handleCreate')
  let feature = e.features[0] // Assuming one feature is created at a time
  const mode = draw.getMode()

  // simplify hand-drawing
  if (mode === 'draw_paint_mode') {
    const options = { tolerance: 0.00005, highQuality: true, mutate: true }
    simplify(feature, options)
  }

  // status('Feature ' + feature.id + ' created')
  addFeature(feature)
  addUndoState('Feature added', feature)
  // redraw if the painted feature was changed in this method
  if (mode.startsWith('directions_') || mode === 'draw_paint_mode') {
    renderLayers('geojson', false)
  }
  sendMessage('new_feature', feature)
  if (feature.geometry.type === 'LineString') {
    // Elevation arrives after new_feature went out, so the server gets it as an update.
    // Both elevation helpers replace the coordinates array only when they got new data.
    const coordinates = feature.geometry.coordinates
    updateElevation(feature).then(() => {
      if (feature.geometry.coordinates !== coordinates) { sendMessage('update_feature', feature) }
    })
  }

  // Switch to feature edit mode after create
  setTimeout(() => {
    if (draw.getMode() !== mode) {
      highlightFeature(feature, true)
      // switch feature details to edit mode after create
      // catched by stimulus in feature modal
      window.dispatchEvent(new CustomEvent("toggle-edit-feature"))
    }
  }, 10)


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
  const geojsonFeature = getFeature(feature.id)
  // mapbox-gl-draw-waypoint sends empty update when dragging on selected feature
  if (equal(geojsonFeature.geometry, feature.geometry)) {
    // console.log('Feature update event triggered without update')
    return
  }
  addUndoState('Feature update', geojsonFeature)

  // change route with openrouteservice
  if (selectedRoute?.properties?.route?.provider === 'ors') {
    feature = await getRouteUpdate(geojsonFeature, feature)
  }

  // status('Feature ' + feature.id + ' changed')
  geojsonFeature.geometry = feature.geometry
  // Surgical single-feature update; MapboxDraw already reflects the drag, so no resetDraw.
  // Geometry changed, so companion segments/markers must follow.
  applyFeatureUpdate(geojsonFeature, { refreshRouteExtras: true, refreshKmMarkers: true })

  // updateElevation() never rejects, a failed fetch keeps the old coordinates
  if (feature.geometry.type === 'LineString') { await updateElevation(feature) }
  sendMessage('update_feature', feature)
  refreshFeatureMeta(feature)
}

export function handleDelete (e) {
  selectedRoute = null
  const deletedFeature = e.features[0] // Assuming one feature is deleted at a time
  destroyFeature(deletedFeature.id)
  addUndoState('Feature deleted', deletedFeature)
  resetDirections()
  resetControls()
  status(window.__('%{type} deleted').replace('%{type}', featureLabel(deletedFeature)))
  sendMessage('delete_feature', { id: deletedFeature.id })
}

export function setSelectedRoute(feature) {
  selectedRoute = feature
}
