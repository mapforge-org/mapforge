import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { geojsonData, redrawGeojson } from 'maplibre/map'
import { featureIcon } from 'maplibre/feature'
import { handleDelete, draw } from 'maplibre/edit'
import { featureColor, featureOutlineColor } from 'maplibre/styles'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import * as dom from 'helpers/dom'
import { addUndoState } from 'maplibre/undo'

export default class extends Controller {
  // https://stimulus.hotwired.dev/reference/values
  static values = {
    featureId: String
  }

  delete_feature () {
    const feature = this.getFeature()
    if (confirm(`Really delete this ${feature.geometry.type}?`)) {
      handleDelete({ features: [feature] })
    }
  }

  update_feature_raw () {
    const feature = this.getFeature()
    document.querySelector('#feature-edit-raw .error').innerHTML = ''
    try {
      feature.properties = JSON.parse(document.querySelector('#feature-edit-raw textarea').value)
      redrawGeojson()
      mapChannel.send_message('update_feature', feature)
    } catch (error) {
      console.error('Error updating feature:', error.message)
      status('Error updating feature', 'error')
      document.querySelector('#feature-edit-raw .error').innerHTML = error.message
    }
  }

  updateTitle () {
    const feature = this.getFeature()
    const title = document.querySelector('#feature-title-input input').value
    feature.properties.title = title
    document.querySelector('#feature-title').textContent = title
    functions.debounce(() => { this.saveFeature() }, 'title')
  }

  updateLabel () {
    const feature = this.getFeature()
    const label = document.querySelector('#feature-label input').value
    feature.properties.label = label
    draw.setFeatureProperty(this.featureIdValue, 'label', label)
    redrawGeojson(false)
    functions.debounce(() => { this.saveFeature() }, 'label')
  }

  // called as preview on slider change
  updatePointSize () {
    const feature = this.getFeature()
    const size = document.querySelector('#point-size').value
    document.querySelector('#point-size-val').textContent = size
    feature.properties['marker-size'] = size
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'marker-size', size)
    redrawGeojson(true)
  }

  // called as preview on slider change
  updateLineWidth () {
    const feature = this.getFeature()
    const size = document.querySelector('#line-width').value
    document.querySelector('#line-width-val').textContent = size
    feature.properties['stroke-width'] = size
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'stroke-width', size)
    redrawGeojson(true)
  }

  // called as preview on slider change
  updateOutLineWidth () {
    const feature = this.getFeature()
    const size = document.querySelector('#outline-width').value
    document.querySelector('#outline-width-val').textContent = size
    feature.properties['stroke-width'] = size
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'stroke-width', size)
    redrawGeojson(true)
  }

  // called as preview on slider change
  updateFillExtrusionHeight () {
    const feature = this.getFeature()
    const size = document.querySelector('#fill-extrusion-height').value
    document.querySelector('#fill-extrusion-height-val').textContent = size + 'm'
    feature.properties['fill-extrusion-height'] = Number(size)
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'fill-extrusion-height', Number(size))
    // needs redraw to add extrusion
    redrawGeojson(true)
  }

  updateOpacity () {
    const feature = this.getFeature()
    const opacity = document.querySelector('#opacity').value / 10
    document.querySelector('#opacity-val').textContent = opacity * 100 + '%'
    feature.properties['fill-opacity'] = opacity
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'fill-opacity', opacity)
    redrawGeojson(true)
  }

  updateStrokeColor () {
    const feature = this.getFeature()
    const color = document.querySelector('#stroke-color').value
    feature.properties.stroke = color
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'stroke', color)
    redrawGeojson(true)
  }

  updateStrokeColorTransparent () {
    const feature = this.getFeature()
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
    redrawGeojson(true)
  }

  updateFillColor () {
    const feature = this.getFeature()
    const color = document.querySelector('#fill-color').value
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    redrawGeojson(true)
  }

  updateFillColorTransparent () {
    const feature = this.getFeature()
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
    redrawGeojson(true)
  }

  updateShowKmMarkers () {
    const feature = this.getFeature()
    if (document.querySelector('#show-km-markers').checked) {
      feature.properties['show-km-markers'] = true
      // feature.properties['stroke-image-url'] = "/icons/direction-arrow.png"
    } else {
      delete feature.properties['show-km-markers']
      delete feature.properties['stroke-image-url']
    }
    redrawGeojson(false)
  }

  updateMarkerSymbol () {
    const feature = this.getFeature()
    let symbol = document.querySelector('#marker-symbol').value
    document.querySelector('#emoji').textContent = symbol
    dom.hideElements(['#emoji-select'])
    // strip variation selector (emoji) U+FE0F to match icon file names
    symbol = symbol.replace(/\uFE0F/g, '')
    feature.properties['marker-symbol'] = symbol
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'marker-symbol', symbol)
    document.querySelector('#feature-symbol').innerHTML = featureIcon(feature)
    redrawGeojson(true)
  }

  async updateMarkerImage () {
    const feature = this.getFeature()
    const image = document.querySelector('#marker-image').files[0]
    const formData = new FormData() // send using multipart/form-data
    formData.append('image', image)
    formData.append('map_id', window.gon.map_id)
    fetch('/images', {
      method: 'POST',
      body: formData,
      headers: {
        'X-CSRF-Token': window.gon.csrf_token
      }
    })
      .then(response => response.json())
      .then(data => {
        console.log(data)
        console.log('Setting icon: ' + data.icon)
        feature.properties['marker-image-url'] = data.icon
        draw.setFeatureProperty(this.featureIdValue, 'marker-image-url', data.icon)

        // set default size + transparent background
        feature.properties['marker-size'] = 15
        document.querySelector('#point-size').value = 15
        document.querySelector('#point-size-val').innerHTML = 15
        feature.properties['stroke'] = 'transparent'
        document.querySelector('#stroke-color').setAttribute('disabled', 'true')
        document.querySelector('#stroke-color-transparent').checked = true
        feature.properties['marker-color'] = 'transparent'
        document.querySelector('#fill-color').setAttribute('disabled', 'true')
        document.querySelector('#fill-color-transparent').checked = true
        feature.properties['desc'] = (feature.properties['desc'] || '') + `\n[![image](${data.image})](${data.image})\n`

        document.querySelector('#feature-symbol').innerHTML = featureIcon(feature)
        redrawGeojson(true)
        this.saveFeature()
      })
      .catch(error => console.error('Error:', error))
  }

  // https://github.com/missive/emoji-mart
  async openEmijiPicker() {
    // Dynamically import emoji-mart + its data
    const { Picker } = await import('emoji-mart')
    const pickerOptions = {
      data: async () => {
        const response = await fetch(
          '/emojis/emoji-mart-data.json',
        )
        return response.json()
      }, 
      onEmojiSelect: (emoji) => {
        // console.log('Emoji selected:', emoji)
        document.querySelector('#marker-symbol').value = emoji.native
        this.updateMarkerSymbol()
        this.addUndo()
        this.saveFeature()
        this.picker.remove()
      }, 
      onClickOutside: (event) => {
        // click in the symbol input is not considered outside
        if (event.target.id != 'marker-symbol') { this.picker.remove() }
      }, 
      dynamicWidth: true, 
      noCountryFlags: true, // TODO country flags don't work right now
      // set: 'google', // default is native icons (they don't match the map icons)
      theme: 'light',
    }

    this.picker = new Picker(pickerOptions)
    document.querySelector('#feature-edit-ui').prepend(this.picker)
  }

  saveFeature () {
    const feature = this.getFeature()
    status('Saving feature ' + feature.id)
    // send shallow copy of feature to avoid changes during send
    mapChannel.send_message('update_feature', { ...feature })
  }

  addUndo() {
    const feature = this.getFeature()
    addUndoState('Feature property update', feature)
  }  

  getFeature () {
    const id = this.featureIdValue
    return geojsonData.features.find(f => f.id === id)
  }
}
