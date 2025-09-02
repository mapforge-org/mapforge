import { map, layers } from 'maplibre/map'
import * as functions from 'helpers/functions'
// import * as dom from 'helpers/dom'
import { draw } from 'maplibre/edit'
import { resetHighlightedFeature, featureIcon } from 'maplibre/feature'
import { initTooltips } from 'helpers/dom'
import MaplibreGeocoder from 'maplibre-gl-geocoder'
import { resetEditControls } from 'maplibre/controls/edit'
import { animateElement } from 'helpers/dom'
import { status } from 'helpers/status'
import { queries } from 'maplibre/overpass/queries'
import * as _fulltilt from 'fulltilt.min'

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

// create the list of layers + features
export function initLayersModal () {
  console.log("Re-draw layers modal")
  functions.e('#layers', e => {
    e.innerHTML = ''
    const template = document.querySelector('#layer-item-template')
    if (window.gon.map_mode === "rw") {
      let ul = document.querySelector('#layers-modal #query-dropdown')
      ul.innerHTML = '<li data-query-name="Custom query">Custom query</li><li>-----</li>'
      queries.sort((a, b) => a.name.localeCompare(b.name)).forEach(q => {
        let li = document.createElement('li')
        li.dataset.queryName = q['name']
        li.innerHTML = q['name']
        ul.appendChild(li)
      })
    }
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
      head.appendChild(featureCount)
      e.appendChild(layerElement)
      if (layer.type === 'overpass') {
        layerElement.querySelector('.layer-item-overpass').classList.remove('hidden')
        layerElement.querySelector('button.overpass-refresh').classList.remove('hidden')
        if (window.gon.map_mode === "rw"){
          layerElement.querySelector('button.layer-edit').classList.remove('hidden')
        }
      }

      const ul = layerElement.querySelector('ul')
      features.slice(0, 300).forEach(feature => {
        const listItem = document.createElement('li')
        listItem.classList.add('layer-feature-item')
        listItem.setAttribute('data-feature-id', feature.id)
        const source = layer.type === 'geojson' ? 'geojson-source' : layer.type + '-source-' + layer.id
        listItem.setAttribute('data-feature-source', source)
        listItem.setAttribute('data-controller', 'map--layers')
        listItem.setAttribute('data-action', 'click->map--layers#flyto')

        const icon = document.createElement('span')
        icon.innerHTML = featureIcon(feature)
        listItem.appendChild(icon)
        const name = document.createElement('span')
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
  if (draw) { draw.deleteAll() }
  resetHighlightedFeature()
  // reset cursor
  functions.e('.maplibregl-canvas', e => { e.classList.remove('cursor-crosshair') })
  // reset ctrl buttons
  functions.e('.maplibregl-ctrl-btn, .mapbox-gl-draw_paint, .mapbox-gl-draw_road, .mapbox-gl-draw_bicycle, .mapbox-gl-draw_foot',
    e => { e.classList.remove('active') })

  // reset active modals
  functions.e('.modal-center', e => { e.classList.remove('show') })
}

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
  functions.e('.maplibregl-ctrl button', e => {
    e.setAttribute('data-toggle', 'tooltip')
    e.setAttribute('data-bs-custom-class', 'maplibregl-ctrl-tooltip')
    e.setAttribute('data-bs-trigger', 'hover')
  })
  initTooltips()
}

export function initializeDefaultControls () {
  map.addControl(
    new MaplibreGeocoder(geocoderConfig, {
      maplibregl
    }), 'top-right'
  )
  document.querySelector('.maplibregl-ctrl-geocoder').classList.add('hidden')

  const nav = new maplibregl.NavigationControl({
    visualizePitch: true,
    showZoom: true,
    showCompass: true
  })
  map.addControl(nav)
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-zoom-in)').classList.add('hidden')

  // https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl
  // css: .maplibregl-user-location-dot
  // Note: This works only via https in modern browsers
  const geolocate = new maplibregl.GeolocateControl({
    // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition#options
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 60000,
      maximumAge: 30000
    },
    showAccuracyCircle: true,
    showUserLocation: true,
    trackUserLocation: functions.isMobileDevice()
  })
  geolocate.on('error', () => { status('Error detecting location', 'warning') })
  geolocate.on('trackuserlocationstart', () => {
    if (functions.isMobileDevice()) {
      var promise = FULLTILT.getDeviceOrientation({ 'type': 'world' })
      promise.then(function (orientationControl) {
        orientationControl.listen(function () {
          const dot = document.querySelector('.maplibregl-user-location-dot')
          if (dot) {
            // Get latest screen-adjusted deviceorientation data
            let screenAdjustedEvent = orientationControl.getScreenAdjustedEuler()
            console.log(screenAdjustedEvent)
            let heading
            if (screenAdjustedEvent.isAvailable(screenAdjustedEvent.BETA) && (87 < Math.abs(screenAdjustedEvent.beta) < 93)) {
              // when the phone is vertical, alpha is unreliable
            } else {
              heading = screenAdjustedEvent.alpha
              // adjust to map rotation
              heading += map.getBearing()
              dot.style.setProperty('--user-dot-rotation', `rotate(-${heading}deg)`)
            }
          }
        })
      }).catch(function (message) {
        console.error('Cannot get device orientation: ' + message)
      })
    }
  })

  map.addControl(geolocate, 'top-right')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-geolocate)').classList.add('hidden')


  const scale = new maplibregl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
  })
  map.addControl(scale)
  scale.setUnit('metric')

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