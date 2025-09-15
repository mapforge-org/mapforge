import { map } from 'maplibre/map'
import * as functions from 'helpers/functions'
import { draw } from 'maplibre/edit'
import { animateElement } from 'helpers/dom'
import { ControlGroup, MapLayersControl, MapShareControl, MapSettingsControl } from 'maplibre/controls/shared'
import { resetDirections } from 'maplibre/routing/osrm'
import { MapSelectControl } from 'maplibre/controls/buttons/select'
import { MapUndoControl, MapRedoControl } from 'maplibre/controls/buttons/undo'
import { LineMenuControl, addLineMenu } from 'maplibre/controls/buttons/lines'
import { PointControl } from 'maplibre/controls/buttons/point'
import { PolygonControl } from 'maplibre/controls/buttons/polygon'

export function resetEditControls () {
  resetDirections()
  draw.changeMode('simple_select')
  map.fire('draw.modechange')
}

export function initializeEditControls () {

  map.addControl(new ControlGroup([new MapSelectControl()]), 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-select)').classList.add('hidden')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-select) button').classList.add('active')

  map.addControl(draw, 'top-left')
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
 
  functions.e('#settings-modal', e => {
    e.setAttribute('data-map--settings-current-pitch-value', map.getPitch().toFixed(0))
    e.setAttribute('data-map--settings-current-zoom-value', map.getZoom().toFixed(2))
    e.setAttribute('data-map--settings-current-bearing-value', map.getBearing().toFixed(0))
  })
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
  map.once('load', function (_e) {
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-select)', 'fade-right', 500)
    animateElement('.maplibregl-ctrl:has(.mapbox-gl-draw_point)', 'fade-right', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-map)', 'fade-right', 500)
  })
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
