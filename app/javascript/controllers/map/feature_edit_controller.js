import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { geojsonData, redrawGeojson } from 'maplibre/map'
import { setFeatureTitleImage } from 'maplibre/modals'
import { handleDelete, draw } from 'maplibre/edit'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'

export default class extends Controller {
  // https://stimulus.hotwired.dev/reference/values
  static values = {
    featureId: String
  }

  delete_feature () {
    const feature = this.getFeature()
    if (confirm('Really delete this element?')) {
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
    redrawGeojson(false)
  }

  // called as preview on slider change
  updateLineWidth () {
    const feature = this.getFeature()
    const size = document.querySelector('#line-width').value
    document.querySelector('#line-width-val').textContent = size
    feature.properties['stroke-width'] = size
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'stroke-width', size)
    redrawGeojson(false)
  }

  // called as preview on slider change
  updateOutLineWidth () {
    const feature = this.getFeature()
    const size = document.querySelector('#outline-width').value
    document.querySelector('#outline-width-val').textContent = size
    feature.properties['stroke-width'] = size
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'stroke-width', size)
    redrawGeojson(false)
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
    redrawGeojson(false)
  }

  updateOpacity () {
    const feature = this.getFeature()
    const opacity = document.querySelector('#opacity').value / 10
    document.querySelector('#opacity-val').textContent = opacity * 100 + '%'
    feature.properties['fill-opacity'] = opacity
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'fill-opacity', opacity)
    redrawGeojson(false)
  }

  updateStrokeColor () {
    const feature = this.getFeature()
    const color = document.querySelector('#stroke-color').value
    feature.properties.stroke = color
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'stroke', color)
    redrawGeojson(false)
  }

  updateFillColor () {
    const feature = this.getFeature()
    const color = document.querySelector('#fill-color').value
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    redrawGeojson(false)
  }

  updateFillColorTransparent () {
    const feature = this.getFeature()
    let color
    if (document.querySelector('#fill-color-transparent').checked) {
      color = 'transparent'
      document.querySelector('#fill-color').setAttribute('disabled', 'true')
    } else {
      color = null
      document.querySelector('#fill-color').removeAttribute('disabled')
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    redrawGeojson(false)
  }

  updateMarkerSymbol () {
    const feature = this.getFeature()
    const symbol = document.querySelector('#marker-symbol').value
    feature.properties['marker-symbol'] = symbol
    // draw layer feature properties aren't getting updated by draw.set()
    draw.setFeatureProperty(this.featureIdValue, 'marker-symbol', symbol)
    redrawGeojson(false)
  }

  async updateMarkerImage () {
    const feature = this.getFeature()
    const image = document.querySelector('#marker-image').files[0]
    const formData = new FormData() // send using multipart/form-data

    if (image && image.size > (4 * 1024 * 1024)) {
      alert('Image is too large. Maximum size is 4MB.')
    }

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
        draw.setFeatureProperty(this.featureIdValue, 'marker-size', 15)
        setFeatureTitleImage(feature)
        redrawGeojson(false)
        this.saveFeature()
      })
      .catch(error => console.error('Error:', error))
  }

  saveFeature () {
    const feature = this.getFeature()
    status('Saving feature ' + feature.id)
    // send shallow copy of feature to avoid changes during send
    mapChannel.send_message('update_feature', { ...feature })
  }

  getFeature () {
    const id = this.featureIdValue
    return geojsonData.features.find(f => f.id === id)
  }
}
