import { map, mapProperties, geojsonData } from 'maplibre/map'
import * as functions from 'helpers/functions'
import { draw } from 'maplibre/edit'
import { resetHighlightedFeature } from 'maplibre/feature'
import { initTooltips } from 'helpers/dom'

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

export class MapEditControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-edit" type="button" title="Switch to edit mode" aria-label="Switch to edit mode" aria-pressed="false"><b><i class="bi bi-pencil-square"></i></b></button>'
    this._container.onclick = function (_e) {
      window.location.href = '/m/' + window.gon.edit_id
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

// initialize settings modal with default map values from mapProperties
export function initSettingsModal () {
  functions.e('#settings-modal', e => {
    if (mapProperties.name) { e.setAttribute('data-map--settings-map-name-value', mapProperties.name) }
    e.setAttribute('data-map--settings-base-map-value', mapProperties.base_map)
    e.setAttribute('data-map--settings-map-terrain-value', mapProperties.terrain)
    e.setAttribute('data-map--settings-default-pitch-value', Math.round(mapProperties.pitch))
    e.setAttribute('data-map--settings-default-zoom-value', parseFloat(mapProperties.zoom || mapProperties.default_zoom).toFixed(2))
    e.setAttribute('data-map--settings-default-bearing-value', Math.round(mapProperties.bearing))
    if (mapProperties.center) {
      e.setAttribute('data-map--settings-default-center-value', JSON.stringify(mapProperties.center))
    }
    e.setAttribute('data-map--settings-default-auto-center-value', JSON.stringify(mapProperties.default_center))
  })
}

// create the list of layers + features
export function initLayersModal () {
  functions.e('#default-layer .layer-elements', e => {
    e.innerHTML = ''
    geojsonData.features.forEach(feature => {
      const listItem = document.createElement('li')
      listItem.classList.add('layer-feature-item')
      listItem.textContent = `${feature.geometry.type}: ` +
          (feature.properties.title || feature.properties.name || feature.id)
      const link = document.createElement('a')
      link.setAttribute('href', '#')
      link.setAttribute('onclick', 'return false;')
      listItem.appendChild(link)
      const icon = document.createElement('i')
      icon.classList.add('bi')
      icon.classList.add('bi-arrow-right-circle')
      icon.setAttribute('data-feature-id', feature.id)
      icon.setAttribute('data-controller', 'map--layers')
      icon.setAttribute('data-action', 'click->map--layers#flyto')
      link.appendChild(icon)
      e.appendChild(listItem)
    })
  })
}

export function resetControls () {
  resetHighlightedFeature()
  // reset cursor
  functions.e('.maplibregl-canvas', e => { e.classList.remove('cursor-crosshair') })
  // reset ctrl buttons
  functions.e('.maplibregl-ctrl-btn, .mapbox-gl-draw_paint, .mapbox-gl-draw_road, .mapbox-gl-draw_bicycle',
    e => { e.classList.remove('active') })

  // reset active modals
  functions.e('.modal-center', e => { e.classList.remove('show') })
}

function resetEditControls () {
  draw.changeMode('simple_select')
  map.fire('draw.modechange')
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
      console.error(`Failed to forwardGeocode with error: ${e}`)
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
