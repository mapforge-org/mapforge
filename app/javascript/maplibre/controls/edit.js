import * as functions from 'helpers/functions'
import { LineMenuControl, addLineMenu } from 'maplibre/controls/buttons/lines'
import { PointControl } from 'maplibre/controls/buttons/point'
import { PolygonControl } from 'maplibre/controls/buttons/polygon'
import { MapSelectControl } from 'maplibre/controls/buttons/select'
import { MapRedoControl, MapUndoControl } from 'maplibre/controls/buttons/undo'
import { ControlGroup, MapLayersControl, MapSettingsControl, MapShareControl, revealControls } from 'maplibre/controls/shared'
import { draw } from 'maplibre/edit'
import { map } from 'maplibre/map'
import { resetDirections } from 'maplibre/routing/directions'

let editControls = []

export function resetEditControls () {
  resetDirections()
  draw.changeMode('simple_select')
  map.fire('draw.modechange')
}

export function initializeEditControls () {

  const selectGroup = new ControlGroup([new MapSelectControl()])
  map.addControl(selectGroup, 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-select)').classList.add('hidden')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-select) button').classList.add('active')

  if (!map.hasControl(draw)) { map.addControl(draw, 'top-left') }
  const editGroup = new ControlGroup(
    [new PointControl(), new LineMenuControl(), new PolygonControl()])
  map.addControl(editGroup, 'top-left')
  addLineMenu()
  functions.e('.maplibregl-ctrl:has(.mapbox-gl-draw_point)', e => { e.classList.add('hidden') })

  const undoGroup = new ControlGroup(
    [new MapUndoControl(), new MapRedoControl()])
  map.addControl(undoGroup, 'top-left')
  document.querySelector('button.maplibregl-ctrl-undo').classList.add('hidden')
  document.querySelector('button.maplibregl-ctrl-redo').classList.add('hidden')

  const controlGroup = new ControlGroup(
    [new MapSettingsControl(), new MapLayersControl(), new MapShareControl()])
  map.addControl(controlGroup, 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-map)').classList.add('hidden') // hide for aos animation

  // draw stays on the map in view mode. Removing it nulls its store, and every
  // `if (draw)` guard in the code base would then call into a dead control.
  // It draws no buttons of its own, so an attached draw is invisible.
  editControls = [selectGroup, editGroup, undoGroup, controlGroup]

  functions.e('#settings-modal', e => {
    e.setAttribute('data-map--settings-current-pitch-value', map.getPitch().toFixed(0))
    e.setAttribute('data-map--settings-current-zoom-value', map.getZoom().toFixed(2))
    e.setAttribute('data-map--settings-current-bearing-value', map.getBearing().toFixed(0))
  })

  revealControls([
    '.maplibregl-ctrl:has(button.maplibregl-ctrl-select)',
    '.maplibregl-ctrl:has(.mapbox-gl-draw_point)',
    '.maplibregl-ctrl:has(button.maplibregl-ctrl-map)'
  ])
}

export function removeEditControls () {
  editControls.forEach(control => { map.removeControl(control) })
  editControls = []
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
