import { resetControls } from 'maplibre/controls/shared'
import { resetEditControls } from 'maplibre/controls/edit'
import { resetHighlightedFeature } from 'maplibre/feature'
import { draw } from 'maplibre/edit'
import { map } from 'maplibre/map'

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
  if (window.gon.map_keys.openrouteservice) {
    addFootButton()
    addBicycleButton()
    addRoadButton()
  }
}

function addLineButton() {
  const originalButton = document.querySelector('.line-menu-btn')
  const lineButton = originalButton.cloneNode(true)
  lineButton.title = 'Draw line'
  lineButton.removeEventListener('click', null)
  lineButton.addEventListener('click', (_e) => {
    if (draw.getMode() === 'draw_line_string') {
      draw.changeMode('simple_select')
    } else {
      resetControls()
      draw.changeMode('draw_line_string')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(lineButton)
}

function addPaintButton() {
  const originalButton = document.querySelector('.line-menu-btn')
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

function addRoadButton() {
  const originalButton = document.querySelector('.line-menu-btn')
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

function addBicycleButton() {
  const originalButton = document.querySelector('.line-menu-btn')
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

function addFootButton() {
  const originalButton = document.querySelector('.line-menu-btn')
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