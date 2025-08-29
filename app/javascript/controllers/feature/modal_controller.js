import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { geojsonData } from 'maplibre/map'
import { defaultLineWidth, featureColor, featureOutlineColor } from 'maplibre/styles'
import { AnimateLineAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations'
import { status } from 'helpers/status'
import { showFeatureDetails } from 'maplibre/feature'
import * as functions from 'helpers/functions'
import * as dom from 'helpers/dom'
import { resetControls } from 'maplibre/controls/shared'
import { draw, select } from 'maplibre/edit'
import { resetDirections } from 'maplibre/routing/osrm'

let easyMDE

export default class extends Controller {
  // https://stimulus.hotwired.dev/reference/values
  static values = {
    featureId: String
  }

  toggle_edit_feature (event) {
    dom.showElements('#edit-button-edit', '#edit-button-raw')
    let type = event?.currentTarget?.dataset?.editType || 'ui'
    document.querySelector('#feature-details-body').classList.add('hidden')
    if (document.querySelector('#feature-edit-raw').classList.contains('hidden') && type === 'raw') {
      // console.log('show_feature_edit_raw')
      document.querySelector('#edit-button-raw').classList.add('active')
      document.querySelector('#edit-button-edit').classList.remove('active')
      this.show_feature_edit_raw()
    } else if (document.querySelector('#feature-edit-ui').classList.contains('hidden') && type === 'ui') {
      console.log('show_feature_edit_ui')
      document.querySelector('#edit-button-raw').classList.remove('hidden')
      document.querySelector('#edit-button-raw').classList.remove('active')
      document.querySelector('#edit-button-edit').classList.add('active')
      this.show_feature_edit_ui()

      // add feature to draw
      const feature = this.getFeature()
      draw.add(feature)
      select(feature)
    } else {
      // repeated click on the current edit mode returns to feature description
      document.querySelector('#edit-button-raw').classList.add('hidden')
      showFeatureDetails(this.getFeature())
      draw.deleteAll()
      resetDirections()
    }
    document.querySelector('#feature-edit-raw .error').innerHTML = ''
    event.stopPropagation()
  }

  show_feature_edit_ui () {
    if (this.element.classList.contains('modal-pull-down')) {
      this.pullUpModal(this.element)
    }
    const feature = this.getFeature()
    dom.showElements(['#feature-edit-ui', '#feature-title-input', '#button-add-desc', '#button-add-label'])
    dom.hideElements(['#feature-edit-raw', '#feature-desc', '#feature-label'])

    // init ui input elements
    document.querySelector('#feature-title-input input').value = feature.properties.title || null
    if (feature.properties.label) { this.show_add_label() }
    if (feature.properties.desc) { this.show_add_desc() }

    dom.hideElements(['.edit-point', '.edit-line', '.edit-polygon'])

    // transparent stroke
    if (feature.properties.stroke === 'transparent') {
      document.querySelector('#stroke-color').setAttribute('disabled', 'true')
      document.querySelector('#stroke-color-transparent').checked = true
    } else {
      document.querySelector('#stroke-color').removeAttribute('disabled')
      let default_stroke = featureOutlineColor
      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        default_stroke = featureColor
      }
      document.querySelector('#stroke-color').value = feature.properties.stroke || default_stroke
      document.querySelector('#stroke-color-transparent').checked = false
    }

    // transparent fill
    if (feature.properties.fill === 'transparent' || feature.properties['marker-color'] === 'transparent') {
      document.querySelector('#fill-color').setAttribute('disabled', 'true')
      document.querySelector('#fill-color-transparent').checked = true
    } else {
      document.querySelector('#fill-color').removeAttribute('disabled')
      document.querySelector('#fill-color').value = feature.properties.fill || featureColor
      document.querySelector('#fill-color-transparent').checked = false
    }

    if (feature.geometry.type === 'Point') {
      dom.showElements(['#feature-edit-ui .edit-point'])
      const size = feature.properties['marker-size'] || 6
      document.querySelector('#point-size').value = size
      document.querySelector('#point-size-val').innerHTML = size
      document.querySelector('#fill-color').value = feature.properties['marker-color'] || featureColor
      document.querySelector('#marker-symbol').value = feature.properties['marker-symbol'] || ''
      functions.e('#marker-image', e => { e.value = '' })
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
      const size = feature.properties['stroke-width'] || defaultLineWidth
      document.querySelector('#line-width').value = size
      document.querySelector('#line-width-val').innerHTML = size
      document.querySelector('#show-km-markers').checked = feature.properties['show-km-markers']
      dom.showElements(['#feature-edit-ui .edit-line'])
    } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      dom.showElements(['#feature-edit-ui .edit-polygon'])
      document.querySelector('#fill-color').value = feature.properties.fill || featureColor
      document.querySelector('#stroke-color').value = feature.properties.stroke || featureOutlineColor
      const size = feature.properties['stroke-width'] || defaultLineWidth
      document.querySelector('#outline-width').value = size
      document.querySelector('#outline-width-val').innerHTML = size
      document.querySelector('#opacity').value = (feature.properties['fill-opacity'] || 0.7) * 10
      document.querySelector('#opacity-val').textContent = (feature.properties['fill-opacity'] || 0.7) * 100 + '%'
    }

    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString' ||
      feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const height = feature.properties['fill-extrusion-height'] || 0
      document.querySelector('#fill-extrusion-height').value = height
      document.querySelector('#fill-extrusion-height-val').innerHTML = height + 'm'
    }
  }

  show_feature_edit_raw () {
    if (this.element.classList.contains('modal-pull-down')) {
      this.pullUpModal(this.element)
    }
    const feature = this.getFeature()
    dom.hideElements(['#feature-edit-ui'])
    dom.showElements(['#feature-edit-raw'])
    document.querySelector('#feature-edit-raw textarea')
      .value = JSON.stringify(feature.properties, undefined, 2)
  }

  show_add_label () {
    dom.hideElements(['#button-add-label'])
    dom.showElements(['#feature-label'])
    document.querySelector('#feature-label input').value = this.getFeature().properties.label || null
  }

  show_add_desc () {
    dom.hideElements(['#button-add-desc'])
    dom.showElements(['#feature-desc'])
    // https://github.com/Ionaru/easy-markdown-editor
    if (easyMDE) { easyMDE.toTextArea() }
    document.querySelector('#feature-desc-input').value = this.getFeature().properties.desc || ''
    easyMDE = new window.EasyMDE({
      element: document.getElementById('feature-desc-input'),
      placeholder: 'Add a description text',
      hideIcons: ['quote', 'ordered-list', 'fullscreen', 'side-by-side', 'preview', 'guide'],
      maxHeight: '6em',
      spellChecker: false,
      status: [{
        className: 'autosave',
        onUpdate: () => { this.updateDesc() }
      }]
    })
  }

  updateDesc () {
    const feature = this.getFeature()
    try {
      if (easyMDE && feature.properties.desc !== easyMDE.value()) {
        feature.properties.desc = easyMDE.value()
        functions.debounce(() => { this.saveFeature() }, 'desc', 2000)
      }
    } catch (error) {
      console.error('Error updating feature:', error.message)
      status('Error updating feature', 'error')
    }
  }

  saveFeature () {
    const feature = this.getFeature()
    status('Saving feature ' + feature.id)
    // send shallow copy of feature to avoid changes during send
    mapChannel.send_message('update_feature', { ...feature })
  }

  toggleModalSize (e) {
    const modal = this.element
    const size = (modal.offsetHeight / modal.parentElement.offsetHeight) * 100
    if (size > 50) {
      this.pullDownModal(modal)
    } else {
      this.pullUpModal(modal)
    }
    e.stopPropagation()
  }

  pullDownModal (modal) {
    modal.style.removeProperty('height')
    modal.classList.add('modal-pull-down')
    modal.classList.remove('modal-pull-up')
  }

  pullUpModal (modal) {
    modal.style.removeProperty('height')
    modal.classList.remove('modal-pull-down')
    // console.log('screen width: ' + screen.width)
    modal.classList.add('modal-pull-up')
  }

  getFeature () {
    const id = this.featureIdValue
    return geojsonData.features.find(f => f.id === id)
  }

  animate () {
    const feature = this.getFeature()
    console.log('Animating ' + feature.id)
    if (feature.geometry.type === 'LineString') {
      new AnimateLineAnimation().run(feature)
    } else if (feature.geometry.type === 'Polygon') {
      new AnimatePolygonAnimation().run(feature)
    }
    animateViewFromProperties()
  }

  close () {
    resetControls()
    if (draw) { draw.changeMode('simple_select', { featureIds: [] }) }
  }
}
