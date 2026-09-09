import { Controller } from '@hotwired/stimulus'
import { sendMessage } from 'channels/map_channel'
import { copyToClipboard } from 'helpers/clipboard'
import * as dom from 'helpers/dom'
import * as functions from 'helpers/functions'
import { resetControls } from 'maplibre/controls/shared'
import { toggleDrawMode } from 'maplibre/edit'
import { mapProperties, setBackgroundMapLayer, updateMapName } from 'maplibre/map'
import { basemaps } from 'maplibre/styles/basemaps'
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
    this.setupCoordinateCopyHandlers()
    this.setupBaseMapTooltips()
  }

  setupBaseMapTooltips () {
    const maps = basemaps()
    this.element.querySelectorAll('.layer-preview').forEach(img => {
      const description = maps[img.dataset.baseMap]?.description
      if (description) {
        img.title = description
        img.dataset.toggle = 'tooltip'
        img.dataset.bsTrigger = 'hover'
      }
    })
    dom.initTooltips(this.element)
  }

  setupCoordinateCopyHandlers () {
    functions.e('#map-center', element => {
      element.style.cursor = 'pointer'
      element.addEventListener('click', (event) => {
        const text = event.target.textContent
        if (text) { copyToClipboard(text, window.__('Coordinates copied to clipboard')) }
      })
    })
  }

  mapNameValueChanged (value, _previousValue) {
    // console.log('mapNameValueChanged(): ' + value)
    functions.e('#map-name', e => { e.value = value })
  }

  mapDescriptionValueChanged (value, _previousValue) {
    // console.log('mapDescriptionValueChanged(): ' + value)
    // Render in both modes, so that a switch to view mode finds the markdown ready
    this.renderDescription()
    functions.e('#map-description-input', e => { e.value = value || '' })
    if (value && window.gon.map_mode === 'rw') { this.showDescriptionEditor() }
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

  defaultPitchValueChanged () { this.renderDefaultView() }
  defaultZoomValueChanged () { this.renderDefaultView() }
  defaultBearingValueChanged () { this.renderDefaultView() }
  defaultCenterValueChanged () { this.renderDefaultView() }

  // center and zoom are the fields the server can leave unset, which is what 'auto' means
  renderDefaultView () {
    const fixed = this.defaultCenterValue.length !== 0 || this.defaultZoomValue !== ''
    // in 'auto' mode the boxes keep showing the last fixed view, so that a switch back restores it
    if (fixed) {
      this.fixedView = {
        center: this.defaultCenterValue,
        zoom: this.defaultZoomValue,
        pitch: this.defaultPitchValue,
        bearing: this.defaultBearingValue
      }
      this.setHTML('#map-center', this.fixedView.center.map(coord => parseFloat(coord.toFixed(4))))
      this.setHTML('#map-zoom', this.fixedView.zoom)
      this.setHTML('#map-pitch', this.fixedView.pitch + '°')
      this.setHTML('#map-bearing', this.fixedView.bearing + '°')
    }
    functions.e('#map-view-auto', e => { e.checked = !fixed })
    functions.e('#map-view-fixed', e => { e.checked = fixed })
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
      sendMessage('update_map', { terrain: mapProperties.terrain, globe: mapProperties.globe })
    }
  }

  updateHillshade (event) {
    this.mapHillshadeValue = event.target.checked
    mapProperties.hillshade = this.mapHillshadeValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      sendMessage('update_map', { hillshade: mapProperties.hillshade })
    }
  }

  updateContours (event) {
    this.mapContoursValue = event.target.checked
    mapProperties.contours = this.mapContoursValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      sendMessage('update_map', { contours: mapProperties.contours })
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
      sendMessage('update_map', { globe: mapProperties.globe, terrain: mapProperties.terrain })
    }
  }

  updateBaseMap (event) {
    this.baseMapValue = event.target.dataset.baseMap
    mapProperties.base_map = this.baseMapValue
    setBackgroundMapLayer()
    if (window.gon.map_mode === 'rw') {
      sendMessage('update_map', { base_map: mapProperties.base_map })
    }
  }

  updateName (event) {
    event.preventDefault()
    const name = document.querySelector('#map-name').value
    updateMapName(name)
    functions.debounce(() => {
      sendMessage('update_map', { name })
    }, 'map_name', 2000)
  }

  updateDescription (event) {
    event?.preventDefault()
    if (descEasyMDE && mapProperties.description !== descEasyMDE.value()) {
      mapProperties.description = descEasyMDE.value()
      functions.debounce(() => {
        sendMessage('update_map', { description: descEasyMDE.value() })
      }, 'map_description', 2000)
    }
  }

  renderDescription() {
    marked.use({ gfm: true, breaks: true })
    const desc = functions.sanitizeMarkdown(marked(this.mapDescriptionValue || ''))
    // an empty element lets CSS hide the whole card in view mode
    functions.e('#map-description-view', e => { e.innerHTML = desc.trim() })
  }

  async showDescriptionEditor (event) {
    event?.preventDefault()
    dom.deleteElements('#map-description .EasyMDEContainer')
    dom.hideElements(['#map-description-toggle'])
    dom.showElements(['#map-description'])

    await import('easymde') // import EasyMDE UMD bundle
    // EasyMDE defaults to a broken font-awesome build from bootstrapcdn; load a working one ourselves
    // (v4-shims maps EasyMDE's old "fa fa-*" classes to FA6 icons)
    dom.loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css')
    dom.loadStylesheet('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/v4-shims.min.css')
    descEasyMDE = new window.EasyMDE({
      element: document.getElementById('map-description-input'),
      placeholder: window.__('Add a description text'),
      toolbar: ["bold", "italic", "heading", "code", "table", "|", "unordered-list", "horizontal-rule", "|", "link", "image", "preview"],
      minHeight: '4em',
      spellChecker: false,
      autoDownloadFontAwesome: false,
      status: [{
        className: 'autosave',
        onUpdate: () => { this.updateDescription() }
      }]
    })
    document.querySelector('#map-description-input')?.focus()
  }

  // switching back to fixed restores the previous fixed view, not the current one
  setFixedView (event) {
    event.preventDefault()
    this.applyDefaultView(this.fixedView || this.currentView())
  }

  updateDefaultView (event) {
    event.preventDefault()
    this.applyDefaultView(this.currentView())
  }

  currentView () {
    return { center: this.currentCenterValue, zoom: this.currentZoomValue,
      pitch: this.currentPitchValue, bearing: this.currentBearingValue }
  }

  applyDefaultView ({ center, zoom, pitch, bearing }) {
    this.defaultCenterValue = center
    this.defaultZoomValue = zoom
    this.defaultPitchValue = pitch
    this.defaultBearingValue = bearing
    mapProperties.default_center = center
    mapProperties.default_zoom = zoom
    mapProperties.default_pitch = pitch
    mapProperties.default_bearing = bearing
    // a restored view can miss the parts that were never fixed
    sendMessage('update_map', { center: center.length === 0 ? null : center, zoom: zoom || null, pitch, bearing })
  }

  resetDefaultView(event) {
    event.preventDefault()
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    // need to receive default values from server
    sendMessage('update_map', { center: null,
      zoom: null, pitch: null, bearing: null })
  }

  importFile () {
    resetControls()
    document.getElementById('fileInput').click()
  }

  startRoute (event) {
    toggleDrawMode(event.params.mode)
  }

  openLayers () {
    document.querySelector('.maplibregl-ctrl-layers').click()
  }
}
