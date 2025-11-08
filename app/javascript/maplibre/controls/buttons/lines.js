import { resetControls } from 'maplibre/controls/shared'
import { resetEditControls } from 'maplibre/controls/edit'
import { resetHighlightedFeature } from 'maplibre/feature'
import { draw, toggleDrawMode } from 'maplibre/edit'
import { map } from 'maplibre/map'
import * as dom from 'helpers/dom'

let lineMenu

export class LineMenuControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="line-menu-btn mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_line" type="button" title="Select line draw mode" aria-label="Select mode" aria-pressed="false" data-bs-placement="right"></button>'
    this._container.onclick = function (e) {
    resetHighlightedFeature()
    resetControls()
    resetEditControls()
      if (lineMenu.classList.contains('hidden')) {
        e.target.closest('button').classList.add('active')
        lineMenu.classList.remove('hidden')
      } else {
        e.target.closest('button').classList.remove('active')
        draw.changeMode('simple_select')
        map.fire('draw.modechange')
      }
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

export function addLineMenu() {
  lineMenu = document.createElement('div')
  document.querySelector('.maplibregl-ctrl-top-left').appendChild(lineMenu)
  lineMenu.classList.add('maplibregl-ctrl-group')
  lineMenu.classList.add('maplibregl-ctrl')
  lineMenu.classList.add('ctrl-line-menu')
  lineMenu.classList.add('hidden')
  addLineButton()
  addPaintButton()
  addFootButton()
  addBicycleButton()
  addRoadButton()
}

function addLineButton() {
  const originalButton = document.querySelector('.line-menu-btn')
  const lineButton = originalButton.cloneNode(true)
  lineButton.title = 'Draw line (l)'
  lineButton.removeEventListener('click', null)
  lineButton.addEventListener('click', (_e) => { toggleDrawMode('draw_line_string') })
  document.addEventListener('keydown', (e) => {
    // skip key event when typing in input field
    if (dom.isInputElement(e.target)) return
    if (e.key === 'l') { toggleDrawMode('draw_line_string') }
  })
  lineMenu.appendChild(lineButton)
}

function addPaintButton() {
  const originalButton = document.querySelector('.line-menu-btn')
  const paintButton = originalButton.cloneNode(true)
  paintButton.title = 'Draw freehand (f)'
  paintButton.classList.remove('mapbox-gl-draw_line')
  paintButton.classList.add('mapbox-gl-draw_paint')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-pencil-fill')
  paintButton.appendChild(icon)
  paintButton.removeEventListener('click', null)
  paintButton.addEventListener('click', (_e) => {
    toggleDrawMode('draw_paint_mode')
  })
  document.addEventListener('keydown', (e) => {
    // skip key event when typing in input field
    if (dom.isInputElement(e.target)) return
    if (e.key === 'f') { toggleDrawMode('draw_paint_mode') }
  })
  lineMenu.appendChild(paintButton)
}

function addRoadButton() {
  const originalButton = document.querySelector('.line-menu-btn')
  const roadButton = originalButton.cloneNode(true)
  roadButton.title = 'Calculate a car route (c)'
  roadButton.classList.remove('mapbox-gl-draw_line')
  roadButton.classList.add('mapbox-gl-draw_road')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-car-front-fill')
  roadButton.appendChild(icon)
  roadButton.removeEventListener('click', null)
  roadButton.addEventListener('click', (_e) => {
    toggleDrawMode('directions_car')
  })
  document.addEventListener('keydown', (e) => {
    // skip key event when typing in input field
    if (dom.isInputElement(e.target)) return
    if (e.key === 'c') { toggleDrawMode('directions_car') }
  })
  lineMenu.appendChild(roadButton)
}

function addBicycleButton() {
  const originalButton = document.querySelector('.line-menu-btn')
  const bicycleButton = originalButton.cloneNode(true)
  bicycleButton.title = 'Calculate a bike route (b)'
  bicycleButton.classList.remove('mapbox-gl-draw_line')
  bicycleButton.classList.add('mapbox-gl-draw_bicycle')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-bicycle')
  bicycleButton.appendChild(icon)
  bicycleButton.removeEventListener('click', null)
  bicycleButton.addEventListener('click', (_e) => { toggleDrawMode('directions_bike') })
  document.addEventListener('keydown', (e) => {
    // skip key event when typing in input field
    if (dom.isInputElement(e.target)) return
    if (e.key === 'b') { toggleDrawMode('directions_bike') }
  })
  lineMenu.appendChild(bicycleButton)
}

function addFootButton() {
  const originalButton = document.querySelector('.line-menu-btn')
  const footButton = originalButton.cloneNode(true)
  footButton.title = 'Calculate a walking route (w)'
  footButton.classList.remove('mapbox-gl-draw_line')
  footButton.classList.add('mapbox-gl-draw_foot')
  const icon = document.createElement('i')
  icon.classList.add('bi')
  icon.classList.add('bi-person-walking')
  footButton.appendChild(icon)
  footButton.removeEventListener('click', null)
  footButton.addEventListener('click', (_e) => { toggleDrawMode('directions_foot') })
  document.addEventListener('keydown', (e) => {
    // skip key event when typing in input field
    if (dom.isInputElement(e.target)) return
    if (e.key === 'w') { toggleDrawMode('directions_foot') }
  })
  lineMenu.appendChild(footButton)
}