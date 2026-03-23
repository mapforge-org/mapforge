import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import * as dom from 'helpers/dom'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { flyToFeature } from 'maplibre/animations'
import { draw, handleDelete } from 'maplibre/edit'
import { confirmImageLocation, featureIcon, featureImage, uploadImageToFeature } from 'maplibre/feature'
import { getFeature, getLayer, renderLayer } from 'maplibre/layers/layers'
import { featureColor, featureOutlineColor } from 'maplibre/styles/styles'
import { addUndoState } from 'maplibre/undo'

export default class extends Controller {
  // https://stimulus.hotwired.dev/reference/values
  static values = {
    featureId: String,
    layerId: String
  }

  // emoji picker
  picker = null

  featureIdValueChanged(value) {
    if (value) {
      this.layerIdValue = getLayer(value).id
    }
  }

  delete_feature (e) {
    if (dom.isInputElement(e.target)) return // Don't trigger if typing in input

    const feature = this.getEditFeature()
    if (confirm(`Really delete this ${feature.geometry.type}?`)) {
      handleDelete({ features: [feature] })
    }
  }

  update_feature_raw () {
    const feature = this.getEditFeature()
    document.querySelector('#feature-edit-raw .error').innerHTML = ''
    try {
      feature.properties = JSON.parse(document.querySelector('#feature-edit-raw textarea').value)
      renderLayer(this.layerIdValue, true)
      mapChannel.send_message('update_feature', feature)
    } catch (error) {
      console.error('Error updating feature:', error.message)
      status('Error updating feature', 'error')
      document.querySelector('#feature-edit-raw .error').innerHTML = error.message
    }
  }

  updateTitle () {
    const feature = this.getEditFeature()
    const title = document.querySelector('#feature-title-input input').value
    feature.properties.title = title
    if (document.querySelector('#feature-show-title-on-map')?.checked) {
      feature.properties.label = title
      renderLayer(this.layerIdValue, false)
    }
    document.querySelector('#feature-title').textContent = title
    functions.debounce(() => { this.saveFeature() }, 'title')
  }

  updateShowTitleOnMap () {
    const feature = this.getEditFeature()
    const isEnabled = document.querySelector('#feature-show-title-on-map').checked
    if (isEnabled) {
      feature.properties.label = feature.properties.title || ''
    } else {
      delete feature.properties.label
    }
    renderLayer(this.layerIdValue, false)
    functions.debounce(() => { this.saveFeature() }, 'show-title-on-map', 1000)
  }

  // Generic helper: read input, set feature property + draw property, re-render
  updateDrawProperty (inputSelector, propertyName, { displaySelector, displayFormat, valueTransform, useChecked } = {}) {
    const feature = this.getEditFeature()
    let value = useChecked
      ? document.querySelector(inputSelector).checked
      : document.querySelector(inputSelector).value
    if (valueTransform) value = valueTransform(value)
    if (displaySelector) {
      document.querySelector(displaySelector).textContent = displayFormat ? displayFormat(value) : value
    }
    feature.properties[propertyName] = value
    draw.setFeatureProperty(this.featureIdValue, propertyName, value)
    renderLayer(this.layerIdValue, true)
  }

  // called as preview on slider change
  updatePointSize () {
    this.updateDrawProperty('#point-size', 'marker-size', { displaySelector: '#point-size-val' })
  }

  updatePointScaling () {
    this.updateDrawProperty('#point-scaling', 'marker-scaling', { useChecked: true })
  }

  updateLineWidth () {
    this.updateDrawProperty('#line-width', 'stroke-width', { displaySelector: '#line-width-val' })
  }

  updateOutLineWidth () {
    this.updateDrawProperty('#outline-width', 'stroke-width', { displaySelector: '#outline-width-val' })
  }

  updateFillExtrusionHeight () {
    this.updateDrawProperty('#fill-extrusion-height', 'fill-extrusion-height', {
      displaySelector: '#fill-extrusion-height-val', displayFormat: v => v + 'm', valueTransform: Number
    })
  }

  updateOpacity () {
    this.updateDrawProperty('#opacity', 'fill-opacity', {
      valueTransform: v => v / 10, displaySelector: '#opacity-val', displayFormat: v => v * 100 + '%'
    })
  }

  updateStrokeColor () {
    this.updateDrawProperty('#stroke-color', 'stroke')
  }

  updateStrokeColorTransparent () {
    const feature = this.getEditFeature()
    let color
    if (document.querySelector('#stroke-color-transparent').checked) {
      color = 'transparent'
      document.querySelector('#stroke-color').setAttribute('disabled', 'true')
    } else {
      color = featureOutlineColor
      document.querySelector('#stroke-color').value = color
      document.querySelector('#stroke-color').removeAttribute('disabled')
    }
    feature.properties.stroke = color
    renderLayer(this.layerIdValue, true)
  }

  updateFillColor () {
    const feature = this.getEditFeature()
    const color = document.querySelector('#fill-color').value
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    renderLayer(this.layerIdValue, true)
  }

  updateFillColorTransparent () {
    const feature = this.getEditFeature()
    let color
    if (document.querySelector('#fill-color-transparent').checked) {
      color = 'transparent'
      document.querySelector('#fill-color').setAttribute('disabled', 'true')
    } else {
      color = featureColor
      document.querySelector('#fill-color').value = color
      document.querySelector('#fill-color').removeAttribute('disabled')
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    renderLayer(this.layerIdValue, true)
  }

  updateShowKmMarkers () {
    const feature = this.getEditFeature()
    if (document.querySelector('#show-km-markers').checked) {
      feature.properties['show-km-markers'] = true
      // feature.properties['stroke-image-url'] = "/icons/direction-arrow.png"
    } else {
      delete feature.properties['show-km-markers']
      delete feature.properties['stroke-image-url']
    }
    renderLayer(this.layerIdValue, true)
  }

  updateMarkerSymbol () {
    const feature = this.getEditFeature()
    let symbol = document.querySelector('#marker-symbol').value
    document.querySelector('#emoji').textContent = symbol
    // strip variation selector (emoji) U+FE0F to match icon file names
    symbol = symbol.replace(/\uFE0F/g, '')
    feature.properties['marker-symbol'] = symbol
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'marker-symbol', symbol)
    functions.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
    renderLayer(this.layerIdValue, true)
  }

  async updateMarkerImage () {
    const feature = this.getEditFeature()
    const image = document.querySelector('#marker-image').files[0]
    const imageLocation = await confirmImageLocation(image)

    uploadImageToFeature(image, feature)
      .then(data => {
        draw.setFeatureProperty(this.featureIdValue, 'marker-image-url', data.icon)
        document.querySelector('#stroke-color').setAttribute('disabled', 'true')
        document.querySelector('#stroke-color-transparent').checked = true
        document.querySelector('#fill-color').setAttribute('disabled', 'true')
        document.querySelector('#fill-color-transparent').checked = true

        functions.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
        functions.e('.feature-image', e => { e.innerHTML = featureImage(feature) })
        if (imageLocation) {
          feature.geometry.coordinates = imageLocation
          flyToFeature(feature)
        }
        renderLayer(this.layerIdValue, true)
        this.saveFeature()
      })
  }

  // https://github.com/missive/emoji-mart
  async openEmojiPicker() {
    // Dynamically import emoji-mart + its data
    const { Picker } = await import('emoji-mart')
    const data = async () => {
      const response = await fetch(
        '/emojis/emoji-mart-data.json',
      )
      return response.json()
    }
    const onEmojiSelect = (emoji) => {
      // console.log('Emoji selected:', emoji)
      document.querySelector('#marker-symbol').value = emoji.native
      this.updateMarkerSymbol()
      this.addUndo()
      this.saveFeature()
      //this.picker.remove()
      document.querySelector('em-emoji-picker').remove()
    }
    const onClickOutside = (event) => {
      // click in the symbol input is not considered outside
      if (event.target.id != 'marker-symbol') { document.querySelector('em-emoji-picker').remove() }
    }

    const pickerOptions = {
      data: data,
      onEmojiSelect: onEmojiSelect,
      onClickOutside: onClickOutside,
      dynamicWidth: true,
      noCountryFlags: true, // TODO country flags don't work right now
      // set: 'google', // default is native icons (they don't match the map icons)
      theme: 'light',
    }
    if (this.picker) {
      // In Safari the <em-emoji-picker> element needs to be re-initialized
      this.picker.data = data
      this.picker.onEmojiSelect = onEmojiSelect
      this.picker.onClickOutside = onClickOutside
    } else {
      this.picker = new Picker(pickerOptions)
    }
    // adding <em-emoji-picker> element
    document.querySelector('#feature-edit-ui').prepend(this.picker)
  }

  saveFeature () {
    const feature = this.getEditFeature()
    status('Saving feature ' + feature.id)
    // send shallow copy of feature to avoid changes during send
    mapChannel.send_message('update_feature', { ...feature })
  }

  addUndo() {
    const feature = this.getEditFeature()
    addUndoState('Feature property update', feature)
  }

  getEditFeature () {
    const id = this.featureIdValue
    return getFeature(id)
  }
}
