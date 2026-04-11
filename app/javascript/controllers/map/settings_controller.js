import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import * as dom from 'helpers/dom'
import * as functions from 'helpers/functions'
import { mapProperties, setBackgroundMapLayer, updateMapName } from 'maplibre/map'
import { marked } from 'marked'

let descEasyMDE

export default class extends Controller {
  // https://stimulus.hotwired.dev/reference/values
  static values = {
    mapName: String,
    mapDescription: String,
    mapTerrain: Boolean,
    mapHillshade: Boolean,
    mapContours: Boolean,
    mapGlobe: Boolean,
    baseMap: String,
    defaultPitch: String,
    currentPitch: String,
    defaultZoom: String,
    currentZoom: String,
    defaultBearing: String,
    currentBearing: String,
    defaultCenter: Array,
    currentCenter: Array
  }

  connect () {
  }

  mapNameValueChanged (value, _previousValue) {
    // console.log('mapNameValueChanged(): ' + value)
    functions.e('#map-name', e => { e.value = value })
  }

  mapDescriptionValueChanged (value, _previousValue) {
    // console.log('mapDescriptionValueChanged(): ' + value)
    if (window.gon.map_mode === 'rw') {
      functions.e('#map-description-input', e => { e.value = value || '' })
      if (value && value !== '') { this.showDescriptionEditor() }
    } else {
      this.renderDescription()
    }
  }

  setChecked (selector, value) { document.querySelector(selector).checked = value }
  setHTML (selector, value) { document.querySelector(selector).innerHTML = value }

  mapTerrainValueChanged (value) { this.setChecked('#map-terrain', value) }
  mapHillshadeValueChanged (value) { this.setChecked('#map-hillshade', value) }
  mapContoursValueChanged (value) { this.setChecked('#map-contours', value) }
  mapGlobeValueChanged (value) { this.setChecked('#map-globe', value) }

  baseMapValueChanged (value) {
    functions.e('.layer-preview', e => { e.classList.remove('active') })
    functions.e('img[data-base-map="' + value + '"]', e => { e.classList.add('active') })
  }

  defaultPitchValueChanged (value) { this.setHTML('#map-pitch', value + '°') }
  currentPitchValueChanged (value) { this.setHTML('#map-pitch-current', value + '°') }
  defaultZoomValueChanged (value) { this.setHTML('#map-zoom', value) }
  currentZoomValueChanged (value) { this.setHTML('#map-zoom-current', value) }
  defaultBearingValueChanged (value) { this.setHTML('#map-bearing', value + '°') }
  currentBearingValueChanged (value) { this.setHTML('#map-bearing-current', value + '°') }

  defaultCenterValueChanged (value, _previousValue) {
    // console.log('defaultCenterValueChanged(): "' + value + '"')
    if (value.length !== 0) {
      value = value.map(coord => parseFloat(coord.toFixed(4)))
    } else {
      value = 'auto'
    }
    document.querySelector('#map-center').innerHTML = value
  }

  currentCenterValueChanged (value, _previousValue) {
    // console.log('currentCenterValueChanged(): ' + value)
    value = value.map(coord => parseFloat(coord.toFixed(4)))
    document.querySelector('#map-center-current').innerHTML = value
  }

  // alternative to https://maplibre.org/maplibre-gl-js/docs/API/classes/TerrainControl/
  updateTerrain (event) {
    this.mapTerrainValue = event.target.checked
    // globe and 3d don't work together
    if (this.mapTerrainValue) {
      document.querySelector('#map-globe').checked = false
      mapProperties.globe = false
    }
    mapProperties.terrain = this.mapTerrainValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      mapChannel.send_message('update_map', { terrain: mapProperties.terrain, globe: mapProperties.globe })
    }
  }

  updateHillshade (event) {
    this.mapHillshadeValue = event.target.checked
    mapProperties.hillshade = this.mapHillshadeValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      mapChannel.send_message('update_map', { hillshade: mapProperties.hillshade })
    }
  }

  updateContours (event) {
    this.mapContoursValue = event.target.checked
    mapProperties.contours = this.mapContoursValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      mapChannel.send_message('update_map', { contours: mapProperties.contours })
    }
  }

  updateGlobe (event) {
    this.mapGlobeValue = event.target.checked
    // globe and 3d don't work together
    if (this.mapGlobeValue) {
      document.querySelector('#map-terrain').checked = false
      mapProperties.terrain = false
    }
    mapProperties.globe = this.mapGlobeValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      mapChannel.send_message('update_map', { globe: mapProperties.globe, terrain: mapProperties.terrain })
    }
  }

  updateBaseMap (event) {
    this.baseMapValue = event.target.dataset.baseMap
    mapProperties.base_map = this.baseMapValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      mapChannel.send_message('update_map', { base_map: mapProperties.base_map })
    }
  }

  updateName (event) {
    event.preventDefault()
    const name = document.querySelector('#map-name').value
    updateMapName(name)
    functions.debounce(() => {
      mapChannel.send_message('update_map', { name })
    }, 'map_name', 2000)
  }

  updateDescription (event) {
    event?.preventDefault()
    if (descEasyMDE && mapProperties.description !== descEasyMDE.value()) {
      mapProperties.description = descEasyMDE.value()
      functions.debounce(() => {
        mapChannel.send_message('update_map', { description: descEasyMDE.value() })
      }, 'map_description', 2000)
    }
  }

  renderDescription() {
    marked.use({ gfm: true, breaks: true })
    let desc = marked(this.mapDescriptionValue || '')
    desc = functions.sanitizeMarkdown(desc)
    const el = document.querySelector('#map-description')
    el.innerHTML = desc
    const card = el.closest('.feature-section-card')
    if (card) { card.style.display = desc.trim() ? '' : 'none' }
  }

  async showDescriptionEditor (event) {
    event?.preventDefault()
    dom.deleteElements('#map-description .EasyMDEContainer')
    dom.hideElements(['#map-description-toggle'])
    dom.showElements(['#map-description'])

    await import('easymde') // import EasyMDE UMD bundle
    descEasyMDE = new window.EasyMDE({
      element: document.getElementById('map-description-input'),
      placeholder: 'Add a description text',
      toolbar: ["bold", "italic", "heading", "code", "table", "|", "unordered-list", "horizontal-rule", "|", "link", "image", "preview"],
      minHeight: '4em',
      spellChecker: false,
      status: [{
        className: 'autosave',
        onUpdate: () => { this.updateDescription() }
      }]
    })
    document.querySelector('#map-description-input')?.focus()
  }

  updateDefaultView (event) {
    event.preventDefault()
    this.defaultCenterValue = this.currentCenterValue
    this.defaultZoomValue = this.currentZoomValue
    this.defaultPitchValue = this.currentPitchValue
    this.defaultBearingValue = this.currentBearingValue
    mapProperties.default_center = this.currentCenterValue
    mapProperties.default_zoom = this.currentZoomValue
    mapProperties.default_pitch = this.currentPitchValue
    mapProperties.default_bearing = this.currentBearingValue
    mapChannel.send_message('update_map', { center: this.currentCenterValue,
      zoom: this.currentZoomValue, pitch: this.currentPitchValue, bearing: this.currentBearingValue })
  }

  resetDefaultView(event) {
    event.preventDefault()
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    // need to receive default values from server
    mapChannel.send_message('update_map', { center: null,
      zoom: null, pitch: null, bearing: null })
  }
}
