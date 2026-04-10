import * as dom from 'helpers/dom'
import { animateElement, initTooltips } from 'helpers/dom'
import * as f from 'helpers/functions'
import * as functions from 'helpers/functions'
import MaplibreGeocoder from 'maplibre-gl-geocoder'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import { resetEditControls } from 'maplibre/controls/edit'
import { initializeGeoLocateControl } from 'maplibre/controls/geolocate'
import { draw, unselect } from 'maplibre/edit'
import { featureIcon, resetHighlightedFeature } from 'maplibre/feature'
import { layers } from 'maplibre/layers/layers'
import { map, mapProperties } from 'maplibre/map'

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
    dom.initTooltips(e)
    e.innerHTML = ''
    const template = document.querySelector('#layer-item-template')
    layers.forEach(layer => {
      let features = layer?.geojson?.features || []
      const layerElement = template.cloneNode(true)
      layerElement.id = 'layer-list-' + layer.id
      layerElement.setAttribute('data-layer-id', layer.id)
      layerElement.setAttribute('data-layer-type', layer.type)
      const head = layerElement.querySelector('.layer-name')

      const layerName = layer.name || 'Layer elements'
      // Regex to match a leading emoji (covers most common emoji including compound ones)
      const emojiRegex = /^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u
      const match = layerName.match(emojiRegex)
      if (match) {
        head.innerHTML = layerName.replace(emojiRegex, `<span class='fst-normal'>$1</span>`)
      } else {
        head.textContent = layerName
      }

      const featureCount = document.createElement('span')
      featureCount.classList.add('small')
      featureCount.textContent = '(' + features.length + ')'
      head.parentNode.insertBefore(featureCount, head.nextSibling)
      e.appendChild(layerElement)
      // visibility toggle for all layers
      const visBtn = layerElement.querySelector('button.layer-visibility')
      const visBtnMobile = layerElement.querySelector('button.layer-visibility-mobile')
      visBtn.classList.remove('hidden')
      visBtnMobile.classList.remove('hidden')
      if (layer.show === false) {
        visBtn.querySelector('i').classList.replace('bi-eye', 'bi-eye-slash')
        visBtnMobile.querySelector('i').classList.replace('bi-eye', 'bi-eye-slash')
        layerElement.classList.add('layer-dimmed')
      }
      const isFirstGeojsonLayer = layer.type === 'geojson' &&
        layers.filter(l => l.type === 'geojson').indexOf(layer) === 0

      // Show delete button for all layers except the first geojson layer
      if (layer.type !== 'geojson' || !isFirstGeojsonLayer) {
        layerElement.querySelector('button.layer-delete').classList.remove('hidden')
        layerElement.querySelector('button.layer-delete-mobile').classList.remove('hidden')
      }

      // Show refresh button only for non-geojson layers that are visible
      if (layer.type !== 'geojson' && layer.show !== false) {
        layerElement.querySelector('button.layer-refresh').classList.remove('hidden')
        layerElement.querySelector('button.layer-refresh-mobile').classList.remove('hidden')
      }
      if (layer.type === 'overpass') {
        layerElement.querySelector('.layer-item-overpass').classList.remove('hidden')
        if (window.gon.map_mode === "rw" && layer.show !== false) {
          layerElement.querySelector('button.layer-edit').classList.remove('hidden')
          layerElement.querySelector('button.layer-edit-mobile').classList.remove('hidden')
        }
      }

      const ul = layerElement.querySelector('.layer-content ul')
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
      dom.initTooltips(layerElement)

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
  // reset context menu
  hideContextMenu()
  // re-initialize tooltips for map controls
  dom.initTooltips()
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
// Velocity tracking
let dragHistory = [] // stores { y, time } entries for velocity calculation
const SNAP_POINTS = [0, 25, 45, 100] // close, down, middle, full (percent of viewport)
const VELOCITY_THRESHOLD = 0.4 // px/ms — above this, momentum takes over
const RUBBER_BAND_FACTOR = 0.3 // resistance when dragging past bounds

function initializeFeatureTouchScroll() {
  const modal = document.querySelector('#feature-details-modal')

  f.addEventListeners(modal, ['mousedown', 'touchstart', 'dragstart'], (event) => {
    if (!f.isTouchDevice()) return
    if (event.target.tagName.toLowerCase() === 'em-emoji-picker') return

    // only enable bottom sheet behavior on small or short screens
    if (window.innerWidth > 574 && window.innerHeight >= 390) return

    const isFullyExpanded = modal.offsetHeight >= window.innerHeight - 20
    // Allow form elements to work normally when modal is fully expanded
    if (dom.isInputElement(event.target) && isFullyExpanded) return

    isDragging = true
    dragStartY = event.clientY || event.touches[0].clientY
    dragStartModalHeight = modal.offsetHeight
    dragHistory = [{ y: dragStartY, time: Date.now() }]
    modal.style.cursor = 'move'
  })

  // Allow to drag up/down modal on touch devices
  // Simulating a native bottom sheet behavior with momentum
  f.addEventListeners(modal, ['mousemove', 'touchmove', 'drag'], (event) => {
    if (!isDragging) { return }

    const dragY = event.clientY || event.touches[0].clientY
    const now = Date.now()
    // Keep last 5 touch points for velocity calculation
    dragHistory.push({ y: dragY, time: now })
    if (dragHistory.length > 5) dragHistory.shift()

    // y < 0 -> dragging up
    const y = dragY - dragStartY
    let newHeight = dragStartModalHeight - y
    const maxHeight = window.innerHeight - 16 // 1rem
    const minHeight = 0

    // Rubber-band effect at edges
    if (newHeight > maxHeight) {
      const overflow = newHeight - maxHeight
      newHeight = maxHeight + overflow * RUBBER_BAND_FACTOR
    } else if (newHeight < minHeight) {
      const overflow = minHeight - newHeight
      newHeight = minHeight - overflow * RUBBER_BAND_FACTOR
    }

    const sheetHeight = newHeight / window.innerHeight * 100
    // fade out to show modal auto close
    if (sheetHeight < 25) {
      modal.classList.add('modal-pull-fade')
    } else {
      modal.classList.remove('modal-pull-fade')
    }

    // When dragging down, at first scroll up, then lower modal
    if (y < 0 || modal.scrollTop === 0) {
      modal.classList.remove('modal-pull-transition')
      modal.style.height = newHeight + 'px'
    } else {
      dragStartY = dragY
      dragStartModalHeight = modal.offsetHeight
      dragHistory = [{ y: dragY, time: now }]
    }

    // disable scrolling until modal is fully dragged up
    if (y < 0 && newHeight < maxHeight) {
      event.preventDefault()
    }
  })

  f.addEventListeners(modal, ['mouseout', 'mouseup', 'touchend', 'mouseleave'], (_event) => {
    if (!isDragging) return
    isDragging = false
    modal.style.cursor = 'default'

    const currentHeight = modal.offsetHeight
    const currentPercent = currentHeight / window.innerHeight * 100

    // Calculate velocity from recent touch history (px/ms, positive = dragging up / growing)
    let velocity = 0
    if (dragHistory.length >= 2) {
      const recent = dragHistory[dragHistory.length - 1]
      const earlier = dragHistory[0]
      const dt = recent.time - earlier.time
      if (dt > 0) {
        // negative dragY change = dragging up = positive velocity (sheet growing)
        velocity = (earlier.y - recent.y) / dt
      }
    }

    // Determine target snap point
    let targetPercent
    const isFastFlick = Math.abs(velocity) > VELOCITY_THRESHOLD

    if (isFastFlick) {
      // Momentum: snap to next snap point in flick direction
      if (velocity > 0) {
        // Flicking up — find next snap point above current position
        targetPercent = SNAP_POINTS.find(s => s > currentPercent) || SNAP_POINTS[SNAP_POINTS.length - 1]
      } else {
        // Flicking down — find next snap point below current position
        targetPercent = [...SNAP_POINTS].reverse().find(s => s < currentPercent) || SNAP_POINTS[0]
      }
    } else {
      // No momentum: stay at current position (free positioning)
      if (currentPercent < 12) {
        targetPercent = 0 // close if dragged very low
      } else {
        targetPercent = null // no snap, keep current height
      }
    }

    modal.classList.remove('modal-pull-fade')

    if (targetPercent === null) {
      // Free position — just clean up, no animation needed
      modal.style.removeProperty('transition')
    } else {
      // Snap animation
      const distance = Math.abs(targetPercent - currentPercent)
      const duration = Math.min(0.45, Math.max(0.2, distance / 200))
      modal.style.transition = `height ${duration}s cubic-bezier(0.32, 0.72, 0, 1)`

      if (targetPercent === 0) {
        modal.style.height = '0px'
        setTimeout(() => {
          resetControls()
          modal.style.removeProperty('height')
          modal.style.removeProperty('transition')
        }, duration * 1000)
      } else if (targetPercent === 100) {
        modal.style.height = 'calc(100vh - 1rem)'
        setTimeout(() => { modal.style.removeProperty('transition') }, duration * 1000)
      } else {
        modal.style.height = targetPercent + 'vh'
        setTimeout(() => { modal.style.removeProperty('transition') }, duration * 1000)
      }
    }

    dragHistory = []
  })
}

// pitch compass view like map
function pitchCompassView() {
  const dot = document.querySelector('.maplibregl-user-location-dot')
  if (dot) {
    const pitch = map.getPitch()
    dot.style.setProperty('--view-pitch', `${pitch * 0.6}deg`)
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