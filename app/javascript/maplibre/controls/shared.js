import * as functions from 'helpers/functions'
import { map, mapProperties } from 'maplibre/map'
// import * as dom from 'helpers/dom'
import * as dom from 'helpers/dom'
import { animateElement, initTooltips } from 'helpers/dom'
import * as f from 'helpers/functions'
import MaplibreGeocoder from 'maplibre-gl-geocoder'
import { resetEditControls } from 'maplibre/controls/edit'
import { initializeGeoLocateControl } from 'maplibre/controls/geolocate'
import { draw, unselect } from 'maplibre/edit'
import { featureIcon, resetHighlightedFeature } from 'maplibre/feature'
import { layers } from 'maplibre/layers/layers'

export class ControlGroup {
  constructor (controls) {
    this.controls = controls
  }

  onAdd (map) {
    this.container = document.createElement('div')
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group'

    // Add each control to the container
    this.controls.forEach(control => {
      this.container.appendChild(control.onAdd(map))
    })

    return this.container
  }

  onRemove (map) {
    this.controls.forEach(control => {
      control.onRemove(map)
    })
    this.container.parentNode.removeChild(this.container)
    this.map = undefined
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
        window.history.pushState({ modal: 'settings' }, '', `${window.location.pathname}#settings`)
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

export class MapShareControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-share" type="button" title="Share map" aria-label="Share map" aria-pressed="false"><b><i class="bi bi-share-fill"></i></b></button>'
    this._container.onclick = function (e) {
      const modal = document.querySelector('#share-modal')
      if (modal.classList.contains('show')) {
        resetControls()
      } else {
        resetControls()
        if (draw) { resetEditControls() }
        e.target.closest('button').classList.add('active')
        modal.classList.add('show')
        window.history.pushState({ modal: 'share' }, '', `${window.location.pathname}#share`)
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

export class MapLayersControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-layers" ' +
      'type="button" title="Map layers" aria-label="Map layers" aria-pressed="false">' +
      '<b><i class="bi bi-stack"></i></b></button>'
    this._container.onclick = function (e) {
      const modal = document.querySelector('#layers-modal')
      if (modal.classList.contains('show')) {
        resetControls()
      } else {
        resetControls()
        if (draw) { resetEditControls() }
        initLayersModal()
        e.target.closest('button').classList.add('active')
        modal.classList.add('show')
        window.history.pushState({ modal: 'layers' }, '', `${window.location.pathname}#layers`)
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

export class ConnectionStatusControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.classList.add('hidden')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-connection" type="button" title="Connection error" aria-label="Connection error" aria-pressed="false"><b><i class="bi bi-wifi-off"></i></b></button>'
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

// initialize settings modal with default map values from mapProperties
export function initSettingsModal () {
  functions.e('#settings-modal', e => {
    if (mapProperties.name) { e.setAttribute('data-map--settings-map-name-value', mapProperties.name) }
    e.setAttribute('data-map--settings-map-description-value', mapProperties.description || '')
    e.setAttribute('data-map--settings-base-map-value', mapProperties.base_map)
    e.setAttribute('data-map--settings-map-terrain-value', mapProperties.terrain)
    e.setAttribute('data-map--settings-map-hillshade-value', mapProperties.hillshade)
    e.setAttribute('data-map--settings-map-contours-value', mapProperties.contours)
    e.setAttribute('data-map--settings-map-globe-value', mapProperties.globe)
    e.setAttribute('data-map--settings-default-pitch-value', Math.round(mapProperties.pitch))
    e.setAttribute('data-map--settings-default-zoom-value', parseFloat(mapProperties.zoom || mapProperties.default_zoom).toFixed(2))
    e.setAttribute('data-map--settings-default-bearing-value', Math.round(mapProperties.bearing))
    if (mapProperties.center) {
      e.setAttribute('data-map--settings-default-center-value', JSON.stringify(mapProperties.center))
    } else {
      e.removeAttribute('data-map--settings-default-center-value')
    }
  })

}

// create the list of layers + features
export function initLayersModal () {
  functions.e('#layers', e => {
    e.innerHTML = ''
    const template = document.querySelector('#layer-item-template')
    layers.forEach(layer => {
      let features = layer?.geojson?.features || []
      const layerElement = template.cloneNode(true)
      layerElement.id = 'layer-list-' + layer.id
      layerElement.setAttribute('data-layer-id', layer.id)
      layerElement.setAttribute('data-layer-type', layer.type)
      const head = layerElement.querySelector('.layer-name')
      head.textContent = layer.name || 'Layer elements'
      const featureCount = document.createElement('span')
      featureCount.classList.add('small')
      featureCount.textContent = '(' + features.length + ')'
      head.parentNode.insertBefore(featureCount, head.nextSibling)
      e.appendChild(layerElement)
      if (layer.type !== 'geojson') {
        layerElement.querySelector('button.layer-refresh').classList.remove('hidden')
      }
      if (layer.type === 'overpass') {
        layerElement.querySelector('.layer-item-overpass').classList.remove('hidden')
        if (window.gon.map_mode === "rw") {
          layerElement.querySelector('button.layer-edit').classList.remove('hidden')
        }
      }

      const ul = layerElement.querySelector('ul')
      features.slice(0, 300).forEach(feature => {
        const listItem = document.createElement('li')
        listItem.classList.add('layer-feature-item')
        listItem.classList.add('flex-center')
        listItem.classList.add('align-items-center')
        listItem.setAttribute('data-feature-id', feature.id)
        listItem.setAttribute('data-controller', 'map--layers')
        listItem.setAttribute('data-action', 'click->map--layers#flyToLayerElement')

        const icon = document.createElement('span')
        icon.classList.add('feature-icon')
        icon.classList.add('flex-center')
        icon.innerHTML = featureIcon(feature)
        listItem.appendChild(icon)
        const name = document.createElement('span')
        name.classList.add('feature-name')
        name.textContent = (feature.properties.title || feature.properties.name || feature.properties.label || feature.geometry.type)
        listItem.appendChild(name)
        const link = document.createElement('a')
        link.setAttribute('href', '#')
        listItem.appendChild(link)
        ul.appendChild(listItem)
      })
      // expand layer items when there is only one layer
      if (layers.length === 1) {
        e.querySelector('.layer-content').classList.remove('hidden')
        layerElement.querySelector('h4 i').classList.remove('bi-caret-right-fill')
        layerElement.querySelector('h4 i').classList.add('bi-caret-down-fill')
      }
      //dom.initTooltips()

      if (features.length === 0) {
        const newNode = document.createElement('i')
        newNode.textContent = 'No elements in this layer'
        layerElement.querySelector('.layer-content').appendChild(newNode)
      }
    })
  })
}

export function resetControls () {
  if (draw) { unselect() }
  resetHighlightedFeature()
  // reset cursor
  functions.e('.maplibregl-canvas', e => { e.classList.remove('cursor-crosshair') })
  // reset ctrl buttons
  functions.e('.maplibregl-ctrl-btn, .mapbox-gl-draw_ctrl-draw-btn',
    e => { e.classList.remove('active') })
  // reset line submenu
  functions.e('.ctrl-line-menu', e => { e.classList.add('hidden') })

  // reset active modals
  functions.e('.modal-center', e => { e.classList.remove('show') })
}

// https://maplibre.org/maplibre-gl-geocoder/types/MaplibreGeocoderOptions.html
export const geocoderConfig = {
  forwardGeocode: async (config) => {
    const features = []
    try {
      const request = `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&polygon_geojson=1&addressdetails=1`
      const response = await fetch(request)
      const geojson = await response.json()
      for (const feature of geojson.features) {
        const center = [feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2,
          feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2
        ]
        const point = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: center
          },
          place_name: feature.properties.display_name,
          properties: feature.properties,
          text: feature.properties.display_name,
          place_type: ['place'],
          center
        }
        features.push(point)
      }
    } catch (e) {
      console.error(`Failed to forward Geocode with error: ${e}`)
    }

    return {
      features
    }
  }
}

export function initCtrlTooltips () {
  functions.e('.maplibregl-ctrl, .maplibregl-ctrl button', e => {
    e.setAttribute('data-toggle', 'tooltip')
    e.setAttribute('data-bs-custom-class', 'maplibregl-ctrl-tooltip')
    e.setAttribute('data-bs-trigger', 'hover')
  })
  initTooltips()
}

export function initializeDefaultControls () {

  // https://maplibre.org/maplibre-gl-geocoder/
  map.addControl(
    new MaplibreGeocoder(geocoderConfig, {
      maplibregl,
      zoom: 15,
      clearAndBlurOnEsc: true,
      // prioritize results near map center
      proximity: {
        latitude: () => { map.getCenter().lat }, longitude: () => { map.getCenter().lng }
      }
    }), 'top-right'
  )
  const geocoderButton = document.querySelector('.maplibregl-ctrl-geocoder')
  geocoderButton.classList.add('hidden')
  geocoderButton.title = 'Search location'
  document.querySelector('.maplibregl-ctrl-geocoder--icon-search').addEventListener('click', (_e) => {
    if (parseFloat(window.getComputedStyle(geocoderButton).width) > 100) {
      geocoderButton.style.setProperty('width', '32px', 'important')
    } else {
      geocoderButton.style.setProperty('width', '14rem', 'important')
    }
  })

  const nav = new maplibregl.NavigationControl({
    visualizePitch: true,
    showZoom: true,
    showCompass: true
  })
  map.addControl(nav)
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-zoom-in)').classList.add('hidden')

  initializeGeoLocateControl()

  map.on('pitch', pitchCompassView)

  const scale = new maplibregl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
  })
  map.addControl(scale)
  scale.setUnit('metric')
  map.addControl(new ControlGroup([new ConnectionStatusControl()]), 'bottom-left')

  map.once('load', function (_e) {
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      document.querySelector('button.maplibregl-ctrl-geolocate').setAttribute('disabled', '1')
      document.querySelector('button.maplibregl-ctrl-geolocate').setAttribute('data-bs-original-title', 'Location (https only)')
    }
    animateElement('.maplibregl-ctrl-geocoder', 'fade-left', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-zoom-in)', 'fade-left', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-geolocate)', 'fade-left', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-edit)', 'fade-right', 500)
  })

  map.on('online', (_e) => {
    functions.e('div:has(> button.maplibregl-ctrl-connection)', e => { e.classList.add('hidden') })
  })
  map.on('offline', (_e) => {
    functions.e('div:has(> button.maplibregl-ctrl-connection)', e => { e.classList.remove('hidden') })
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

  initializeFeatureTouchScroll()
}

let isDragging = false
let dragStartY, dragStartModalHeight

function initializeFeatureTouchScroll() {
  const modal = document.querySelector('#feature-details-modal')

  f.addEventListeners(modal, ['mousedown', 'touchstart', 'dragstart'], (event) => {
    if (!f.isTouchDevice()) return
    if (dom.isInputElement(event.target)) return
    if (event.target.tagName.toLowerCase() === 'em-emoji-picker') return

    // only enable bottom sheet behavior on small screens
    if (window.innerWidth > 574) return

    isDragging = true
    dragStartY = event.clientY || event.touches[0].clientY
    dragStartModalHeight = modal.offsetHeight
    modal.style.cursor = 'move'
  })

  // Allow to drag up/down modal on touch devices
  // Simulating an android bottom sheet behavior
  f.addEventListeners(modal, ['mousemove', 'touchmove', 'drag'], (event) => {
    if (!isDragging) { return }
    if (dom.isInputElement(event.target)) { event.preventDefault(); return }

    const dragY = event.clientY || event.touches[0].clientY
    // y < 0 -> dragging up
    const y = dragY - dragStartY
    const sheetHeight = parseInt(modal.style.height) / window.innerHeight * 100
    // fade out to show modal auto close
    if (sheetHeight < 25) {
      modal.classList.add('modal-pull-fade')
    } else {
      modal.classList.remove('modal-pull-fade')
    }

    // When dragging down, at first scroll up, then lower modal
    if (y < 0 || modal.scrollTop === 0) {
      modal.classList.remove('modal-pull-transition')
      modal.style.height = (dragStartModalHeight - y) + 'px'
    } else {
      dragStartY = dragY
    }

    // disable scrolling until modal is fully dragged up (#feature-details-modal class)
    const max_height = parseInt(window.getComputedStyle(document.querySelector('.map')).height, 10) - 20
    if (y < 0 && parseInt(modal.style.height, 10) < max_height) {
      event.preventDefault()
    }
  })

  f.addEventListeners(modal, ['mouseout', 'mouseup', 'touchend', 'mouseleave'], (event) => {
    if (!isDragging) return
    isDragging = false
    modal.style.cursor = 'default'
    const sheetHeight = parseInt(modal.style.height) / window.innerHeight * 100
    const dragY = event.clientY || event.changedTouches[0].clientY
    const y = dragY - dragStartY
    // console.log(y)
    if (sheetHeight < 25) {
      modal.classList.remove('show')
      modal.style.removeProperty('height')
    } else if (sheetHeight > 75 && y < 0) { // only 'snap' on dragging upwards
      modal.style.height = 'calc(100vh - 1rem)'
    }
  })
}


// pitch compass view like map
function pitchCompassView() {
  const dot = document.querySelector('.maplibregl-user-location-dot')
  if (dot) {
    // pitch = 0 -> scaleY(1); pitch = 90 -> scaleY(0)
    const scale = 1 - (map.getPitch() / 90) / 2
    dot.style.setProperty('--view-scale-y', `scaleY(${scale})`)
  }
}

// Restore modals on back/forward buttons
window.addEventListener('popstate', (e) => {
  const state = e.state || {}
  const modalIdInState = state.modal || null
  if (modalIdInState === 'share') {
    document.querySelector('.maplibregl-ctrl-share').click()
  } else if (modalIdInState === 'settings') {
    document.querySelector('.maplibregl-ctrl-map').click()
  } else if (modalIdInState === 'layers') {
    document.querySelector('.maplibregl-ctrl-layers').click()
  } else {
    resetControls()
  }
})