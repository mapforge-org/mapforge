import { map, geojsonData } from 'maplibre/map'
import * as functions from 'helpers/functions'
import { draw } from 'maplibre/edit'
import { resetHighlightedFeature, featureIcon } from 'maplibre/feature'
import { initTooltips } from 'helpers/dom'
import MaplibreGeocoder from 'maplibre-gl-geocoder'
import { resetEditControls } from 'maplibre/controls/edit'
import { animateElement } from 'helpers/dom'
import { status } from 'helpers/status'

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
  functions.e('#default-layer .layer-elements', e => {
    e.innerHTML = ''
    geojsonData.features.forEach(feature => {
      const listItem = document.createElement('li')
      listItem.classList.add('layer-feature-item')
      listItem.setAttribute('data-feature-id', feature.id)
      listItem.setAttribute('data-controller', 'map--layers')
      listItem.setAttribute('data-action', 'click->map--layers#flyto')

      const icon = document.createElement('span')
      icon.innerHTML = featureIcon(feature)
      listItem.appendChild(icon)
      const name = document.createElement('span')
      name.textContent = (feature.properties.title || feature.properties.name || feature.id)
      listItem.appendChild(name)
      const link = document.createElement('a')
      link.setAttribute('href', '#')
      link.setAttribute('onclick', 'return false;')
      listItem.appendChild(link)
      e.appendChild(listItem)
    })
    if (geojsonData.features.length === 0) {
      e.innerHTML = 'Your map has no elements yet. You can either import or manually create some with the controls on the left.'
    }
  })
}

export function resetControls () {
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
    positionOptions: {
      enableHighAccuracy: true
    },
    trackUserLocation: functions.isMobileDevice()
  })
  geolocate.on('error', () => { status('Error detecting location', 'warning') })
  geolocate.on('trackuserlocationstart', () => {
    if (functions.isMobileDevice()) {
      window.removeEventListener('deviceorientation', updateOrientation)
      window.addEventListener('deviceorientation', updateOrientation)
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
    if (window.location.protocol !== 'https:') {
      document.querySelector('button.maplibregl-ctrl-geolocate').setAttribute('disabled', '1')
      document.querySelector('button.maplibregl-ctrl-geolocate').setAttribute('data-bs-original-title', 'Location (https only)')
    }
    animateElement('.maplibregl-ctrl-geocoder', 'fade-left', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-zoom-in)', 'fade-left', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-geolocate)', 'fade-left', 500)
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-edit)', 'fade-right', 500)
  })
}

const updateOrientation = (event) => {
  // console.log("Orientation:", event.alpha)
  let dot = document.querySelector('.maplibregl-user-location-dot')
  if (dot) {
    dot.style.setProperty('--user-dot-rotation', `rotate(${event.alpha}deg)`)
  }
}
