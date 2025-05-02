import { map, mapProperties } from 'maplibre/map'
import * as functions from 'helpers/functions'
import { draw } from 'maplibre/edit'
import { resetHighlightedFeature } from 'maplibre/feature'
import { animateElement } from 'helpers/dom'
import { ControlGroup, MapLayersControl, MapShareControl, resetControls } from 'maplibre/controls/shared'
import { resetDirections } from 'maplibre/routing/osrm'

let lineMenu

export class MapSelectControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-select" type="button" title="Select mode" aria-label="Select mode" aria-pressed="false"><b><i class="bi bi-hand-index"></i></b></button>'
    this._container.onclick = function (e) {
      resetControls()
      if (draw) { resetEditControls() }
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


export class MapSettingsControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-map" type="button" title="Map settings" aria-label="Map settings" aria-pressed="false"><b><i class="bi bi-globe-americas"></i></b></button>'
    this._container.onclick = function (e) {
      const modal = document.querySelector('#settings-modal')
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

// initialize settings modal with default map values from mapProperties
export function initSettingsModal () {
  functions.e('#settings-modal', e => {
    if (mapProperties.name) { e.setAttribute('data-map--settings-map-name-value', mapProperties.name) }
    e.setAttribute('data-map--settings-base-map-value', mapProperties.base_map)
    e.setAttribute('data-map--settings-map-terrain-value', mapProperties.terrain)
    e.setAttribute('data-map--settings-map-hillshade-value', mapProperties.hillshade)
    e.setAttribute('data-map--settings-map-contours-value', mapProperties.contours)
    e.setAttribute('data-map--settings-default-pitch-value', Math.round(mapProperties.pitch))
    e.setAttribute('data-map--settings-default-zoom-value', parseFloat(mapProperties.zoom || mapProperties.default_zoom).toFixed(2))
    e.setAttribute('data-map--settings-default-bearing-value', Math.round(mapProperties.bearing))
    if (mapProperties.center) {
      e.setAttribute('data-map--settings-default-center-value', JSON.stringify(mapProperties.center))
    }
    e.setAttribute('data-map--settings-default-auto-center-value', JSON.stringify(mapProperties.default_center))
  })
}

export function resetEditControls () {
  resetDirections()
  draw.changeMode('simple_select')
  map.fire('draw.modechange')
}

export function initializeEditControls () {

  map.addControl(new ControlGroup([new MapSelectControl()]), 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-select)').classList.add('hidden')

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
    draw.changeMode('simple_select')
    map.fire('draw.modechange')
    resetHighlightedFeature()
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
      draw.changeMode('directions_foot')
    }
    map.fire('draw.modechange')
  })
  lineMenu.appendChild(footButton)
}
