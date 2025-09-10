import { map } from 'maplibre/map'
import * as functions from 'helpers/functions'
import { draw } from 'maplibre/edit'
import { resetHighlightedFeature } from 'maplibre/feature'
import { animateElement } from 'helpers/dom'
import { ControlGroup, MapLayersControl, MapShareControl, MapSettingsControl, resetControls, initSettingsModal } from 'maplibre/controls/shared'
import { resetDirections } from 'maplibre/routing/osrm'
import { undo, redo } from 'maplibre/undo'

let lineMenu

export class MapSelectControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-select" type="button" title="Select mode" aria-label="Select mode" aria-pressed="false"><b><i class="bi bi-hand-index"></i></b></button>'
    this._container.onclick = function (e) {
      resetControls()
      resetEditControls()
      e.target.closest('button').classList.add('active')
    }
  }
  onAdd (map) {
    map.getCanvas().appendChild(this._container)
    return this._container
  }

  onRemove () {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container)
    }
  }
}

export class MapUndoControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-undo" type="button" title="Undo last change" aria-label="Undo last change" aria-pressed="false"><b><i class="bi bi-arrow-counterclockwise"></i></b></button>'
    this._container.onclick = function (_e) {
      undo()
    }
  }
  onAdd(map) {
    map.getCanvas().appendChild(this._container)
    return this._container
  }
  onRemove() {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container)
    }
  }
}

export class MapRedoControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-redo" type="button" title="Redo last change" aria-label="Redo last change" aria-pressed="false"><b><i class="fw-bold bi bi-arrow-clockwise "></i></b></button>'
    this._container.onclick = function (_e) {
      redo()
    }
  }
  onAdd(map) {
    map.getCanvas().appendChild(this._container)
    return this._container
  }
  onRemove() {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container)
    }
  }
}

export class TourControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-tour" type="button" title="Mapforge Feature Tour" aria-label="Tour" aria-pressed="false" data-bs-placement="right"><b><i class="bi bi-info-lg"></i></b></button>'
    this._container.onclick = function (e) {
      const modal = document.querySelector('#tour-modal')
      if (modal.classList.contains('show')) {
        resetControls()
      } else {
        resetControls()
        if (draw) { resetEditControls() }
        initSettingsModal()
        e.target.closest('button').classList.add('active')
        modal.classList.add('show')
      }
    }
  }

  onAdd (map) {
    map.getCanvas().appendChild(this._container)
    return this._container
  }

  onRemove () {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container)
    }
  }
}

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
  addLineMenu()
  document.querySelector('button.mapbox-gl-draw_polygon').setAttribute('title', 'Draw polygon')
  document.querySelector('button.mapbox-gl-draw_point').setAttribute('title', 'Draw point')
  document.querySelector('.maplibregl-ctrl:has(button.ctrl-line-menu-btn)').classList.add('hidden') // hide for aos animation

  const undoGroup = new ControlGroup(
    [new MapUndoControl(),
    new MapRedoControl()])
  map.addControl(undoGroup, 'top-left')
  document.querySelector('button.maplibregl-ctrl-undo').classList.add('hidden')
  document.querySelector('button.maplibregl-ctrl-redo').classList.add('hidden')

  const controlGroup = new ControlGroup(
    [new MapSettingsControl(),
      new MapLayersControl(),
      new MapShareControl()])
  map.addControl(controlGroup, 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-map)').classList.add('hidden') // hide for aos animation
 
  // map.addControl(new ControlGroup([new TourControl()]), 'top-left')
  // document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-tour)').classList.add('hidden') // hide for aos animation

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
    animateElement('.maplibregl-ctrl:has(button.ctrl-line-menu-btn)', 'fade-right', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-map)', 'fade-right', 500)
    // animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-tour)', 'fade-right', 500)
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
    resetHighlightedFeature()
    if (lineMenu.classList.contains('hidden')) {
      lineMenu.classList.remove('hidden')
      draw.changeMode('draw_line_string')
      map.fire('draw.modechange')
    } else {
      resetControls()
      draw.changeMode('simple_select')
      map.fire('draw.modechange')
      lineMenu.classList.add('hidden')
    }
  })
  const parentElement = originalButton.parentElement
  parentElement.insertBefore(lineMenuButton, originalButton.nextSibling)
  lineMenu.appendChild(originalButton)
  addPaintButton()
  if (window.gon.map_keys.openrouteservice) {
    addFootButton()
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
      resetControls()
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
    if (draw.getMode() === 'directions_car') {
      draw.changeMode('simple_select')
    } else {
      resetControls()
      draw.changeMode('directions_car')
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
    if (draw.getMode() === 'directions_bike') {
      draw.changeMode('simple_select')
    } else {
      resetControls()
      draw.changeMode('directions_bike')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(bicycleButton)
}

function addFootButton () {
  const originalButton = document.querySelector('.ctrl-line-menu .mapbox-gl-draw_line')
  const footButton = originalButton.cloneNode(true)
  footButton.title = 'Calculate a walking route'
  footButton.classList.remove('mapbox-gl-draw_line')
  footButton.classList.add('mapbox-gl-draw_foot')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-person-walking')
  footButton.appendChild(icon)
  footButton.removeEventListener('click', null)
  footButton.addEventListener('click', (_e) => {
    if (draw.getMode() === 'directions_foot') {
      draw.changeMode('simple_select')
    } else {
      resetControls()
      draw.changeMode('directions_foot')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(footButton)
}
