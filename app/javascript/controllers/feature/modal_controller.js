import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { geojsonData } from 'maplibre/map'
import { defaultLineWidth, featureColor, featureOutlineColor } from 'maplibre/styles'
import { AnimateLineAnimation, AnimatePolygonAnimation, animateViewFromProperties } from 'maplibre/animations'
import { status } from 'helpers/status'
import { showFeatureDetails, highlightedFeatureId } from 'maplibre/feature'
import * as functions from 'helpers/functions'
import * as dom from 'helpers/dom'
import { draw, select, unselect } from 'maplibre/edit'

let easyMDE

export default class extends Controller {
  // https://stimulus.hotwired.dev/reference/values
  static values = {
    featureId: String
  }

  toggle_edit_feature (event) {
    dom.showElements('#edit-button-edit')
    let type = event?.currentTarget?.dataset?.editType || 'ui'
    document.querySelector('#feature-details-body').classList.add('hidden')
    if (document.querySelector('#feature-edit-raw').classList.contains('hidden') && type === 'raw') {
      // console.log('show_feature_edit_raw')
      document.querySelector('#edit-button-edit').classList.remove('active')
      document.querySelector('#button-edit-raw').classList.add('active')
      this.show_feature_edit_raw()
    } else if (document.querySelector('#feature-edit-ui').classList.contains('hidden') && type === 'ui') {
      // console.log('show_feature_edit_ui')
      document.querySelector('#edit-button-edit').classList.add('active')
      document.querySelector('#button-edit-raw').classList.remove('active')
      this.show_feature_edit_ui()

      // add feature to draw
      const feature = this.getFeature()
      draw.add(feature)
      select(feature)
    } else {
      // repeated click on the current edit mode returns to feature description
      showFeatureDetails(this.getFeature())
      unselect()
    }
    document.querySelector('#feature-edit-raw .error').innerHTML = ''
    event.stopPropagation()
  }

  show_feature_edit_ui () {
    if (this.element.classList.contains('modal-pull-down')) {
      this.pullUpModal(this.element)
    }
    const feature = this.getFeature()
    dom.showElements(['#feature-edit-ui', '#button-add-label', '#button-add-desc'])
    dom.hideElements(['#feature-edit-raw', '#feature-label', '#feature-desc'])
    functions.e('em-emoji-picker', e => { e.remove() })

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
      
      document.querySelector('#marker-symbol').value = feature.properties['marker-symbol'] || ''
      if (feature.properties['marker-symbol']) {
        document.querySelector('#emoji').textContent = feature.properties['marker-symbol']
        dom.hideElements(['#no-emoji'])
      } else {
        document.querySelector('#emoji').textContent = ''
        dom.showElements(['#no-emoji'])
      }

      let defaultSize = feature.properties['marker-symbol'] ? 18 : 6
      const size = feature.properties['marker-size'] || defaultSize

      document.querySelector('#point-size').value = size
      document.querySelector('#point-size-val').innerHTML = size
      document.querySelector('#point-scaling').checked = feature.properties['marker-scaling']
      document.querySelector('#fill-color').value = feature.properties['marker-color'] || featureColor
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
    document.querySelector('#feature-label input').value = this.getFeature().properties.label || null
    dom.hideElements(['#button-add-label'])
    dom.showElements(['#feature-label'])
  }

  async show_add_desc () {
    dom.hideElements(['#button-add-desc'])
    dom.showElements(['#feature-desc'])
    // https://github.com/Ionaru/easy-markdown-editor
    await import('easymde') // import EasyMDE UMD bundle
    if (easyMDE) { easyMDE.toTextArea() }
    document.querySelector('#feature-desc-input').value = this.getFeature().properties.desc || ''
    easyMDE = new window.EasyMDE({
      element: document.getElementById('feature-desc-input'),
      placeholder: 'Add a description text',
      toolbar: ["bold", "italic", "heading", "code", "table", "|", "unordered-list", "horizontal-rule", "|", "link", "image", "preview"],
      minHeight: '4em',
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
    if (size > 55) {
      this.pullDownModal(modal)
    } else {
      this.pullUpModal(modal)
    }
    e.preventDefault()
  }

  pullDownModal (modal) {
    modal.classList.remove('modal-pull-up')
    modal.classList.remove('modal-pull-middle')
    modal.classList.add('modal-pull-transition')
    modal.classList.add('modal-pull-down')
    modal.style.removeProperty('height')
  }

  pullUpModal (modal) {
    modal.classList.remove('modal-pull-down')
    modal.classList.remove('modal-pull-middle')
    modal.classList.add('modal-pull-transition')
    modal.classList.add('modal-pull-up')
    modal.style.removeProperty('height')
  }

  getFeature () {
    const id = this.featureIdValue
    return geojsonData.features.find(f => f.id === id)
  }

  async copy(event) {
    if (functions.isFormFieldFocused()) { return }
    if (!highlightedFeatureId) { return }

    const feature = this.getFeature()
    if (feature) {
      await navigator.clipboard.writeText(JSON.stringify(feature))
      event.preventDefault()
      event.stopPropagation()
      console.log("Copied feature to clipboard ", feature)
      status('Feature copied to clipboard')
    }
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
}
