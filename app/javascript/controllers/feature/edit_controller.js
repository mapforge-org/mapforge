import { Controller } from '@hotwired/stimulus'
import { sendMessage } from 'channels/map_channel'
import * as dom from 'helpers/dom'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { syncStepperValues } from 'helpers/stepper'
import { flyToFeature } from 'maplibre/animations'
import { draw, handleDelete } from 'maplibre/edit'
import { confirmImageLocation, featureIcon, featureImage, getFeatureTypeName, resetHighlightedFeature, uploadImageToFeature } from 'maplibre/feature'
import { hasKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { applyFeatureUpdate, getFeature, getLayer, renderLayer } from 'maplibre/layers/layers'
import { defaultPointSize, defaults } from 'maplibre/styles/defaults'
import { addUndoState } from 'maplibre/undo'

// one directory with an index.json per set, see public/icon-sets/README
const iconSets = [ 'maki', 'temaki', 'fontawesome' ]
// The icons of these sets are white, so that they read well on the circle of a marker. On a
// page they need a background of their own, see the img rule in feature.css.
const whiteIconSets = [ 'maki', 'temaki', 'fontawesome' ]
const isWhiteSymbol = symbol => whiteIconSets.some(set => symbol.includes(`/icon-sets/${set}/`))

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
      const layer = getLayer(value)
      if (layer) {
        this.layerIdValue = layer.id
      }
    }
  }

  delete_feature (e) {
    if (dom.isInputElement(e.target)) return // Don't trigger if typing in input

    const feature = this.getEditFeature()
    if (confirm(window.__('Really delete this %{type}?').replace('%{type}', getFeatureTypeName(feature)))) {
      handleDelete({ features: [feature] })
    }
  }

  update_feature_raw () {
    const feature = this.getEditFeature()
    document.querySelector('#feature-edit-raw .error').innerHTML = ''
    try {
      feature.properties = JSON.parse(document.querySelector('#feature-edit-raw textarea').value)
      renderLayer(this.layerIdValue, true)
      sendMessage('update_feature', feature)
    } catch (error) {
      console.error('Error updating feature:', error.message)
      status(window.__('Error updating %{type}').replace('%{type}', getFeatureTypeName(feature)), 'error')
      document.querySelector('#feature-edit-raw .error').innerHTML = error.message
    }
  }

  update_feature_geometry () {
    const feature = this.getEditFeature()
    document.querySelector('#feature-edit-raw-geometry .error').innerHTML = ''
    try {
      const newGeometry = JSON.parse(document.querySelector('#feature-edit-raw-geometry textarea').value)
      feature.geometry = newGeometry
      renderLayer(this.layerIdValue, true)
      sendMessage('update_feature', feature)
    } catch (error) {
      console.error('Error updating feature geometry:', error.message)
      status(window.__('Error updating %{type} geometry').replace('%{type}', getFeatureTypeName(feature)), 'error')
      document.querySelector('#feature-edit-raw-geometry .error').innerHTML = error.message
    }
  }

  // mobile only, the json textarea of the advanced tab is too small to edit comfortably otherwise
  toggleFullscreen (e) {
    const container = e.target.closest('.raw-json-editor')
    const icon = e.target.closest('button').querySelector('i')
    const fullscreen = container.classList.toggle('fullscreen')
    icon.classList.toggle('bi-fullscreen', !fullscreen)
    icon.classList.toggle('bi-fullscreen-exit', fullscreen)
    // the editor covers the modal, a half-pulled bottom sheet would still cut it off
    if (fullscreen) {
      const modal = this.element
      this.application.getControllerForElementAndIdentifier(modal, 'feature--modal')?.pullUpModal(modal)
    }
  }

  updateTitle () {
    const feature = this.getEditFeature()
    const title = document.querySelector('#feature-title-input input').value
    feature.properties.title = title
    if (document.querySelector('#feature-show-title-on-map')?.checked) {
      feature.properties.label = title
      this.renderFeature()
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
    this.renderFeature()
    functions.debounce(() => { this.saveFeature() }, 'show-title-on-map', 1000)
  }

  // Generic helper: read input, set feature property + draw property, re-render
  updateDrawProperty (inputSelector, propertyName, { displaySelector, displayFormat, valueTransform, useChecked, renderOptions } = {}) {
    const feature = this.getEditFeature()
    let value = useChecked
      ? document.querySelector(inputSelector).checked
      : document.querySelector(inputSelector).value
    if (valueTransform) value = valueTransform(value)
    if (displaySelector) {
      document.querySelector(displaySelector).textContent = displayFormat ? displayFormat(value) : value
    }
    feature.properties[propertyName] = value
    // Only update draw if feature is in draw (i.e., geometry editing is active).
    // setFeatureProperty already syncs the draw overlay, so no resetDraw needed here.
    if (draw && draw.get(this.featureIdValue)) {
      draw.setFeatureProperty(this.featureIdValue, propertyName, value)
    }
    this.renderFeature(renderOptions)
    syncStepperValues()
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

  // km markers are drawn in the line's stroke color, so they have to be rebuilt with it
  updateStrokeColor () {
    const feature = this.getEditFeature()
    this.updateDrawProperty('#stroke-color', 'stroke', {
      renderOptions: { refreshKmMarkers: hasKmMarkers(feature) }
    })
  }

  updateStrokeColorMode () {
    const feature = this.getEditFeature()
    const mode = document.querySelector('#stroke-color-mode').value
    if (mode) {
      feature.properties['show-route-extras'] = mode
    } else {
      delete feature.properties['show-route-extras']
    }
    document.querySelector('#stroke-color').classList.toggle('hidden', !!mode)
    // Toggling route-extras on/off adds/removes its companion segments.
    this.renderFeature({ refreshRouteExtras: true })
  }

  updateStrokeColorTransparent () {
    const feature = this.getEditFeature()
    let color
    if (document.querySelector('#stroke-color-transparent').checked) {
      color = 'transparent'
      document.querySelector('#stroke-color').setAttribute('disabled', 'true')
    } else {
      color = defaults.featureOutlineColor
      document.querySelector('#stroke-color').value = color
      document.querySelector('#stroke-color').removeAttribute('disabled')
    }
    feature.properties.stroke = color
    this.renderFeature({ refreshKmMarkers: hasKmMarkers(feature) })
  }

  updateFillColor () {
    const feature = this.getEditFeature()
    const color = document.querySelector('#fill-color').value
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    this.renderFeature()
  }

  updateFillColorTransparent () {
    const feature = this.getEditFeature()
    let color
    if (document.querySelector('#fill-color-transparent').checked) {
      color = 'transparent'
      document.querySelector('#fill-color').setAttribute('disabled', 'true')
    } else {
      color = defaults.featureColor
      document.querySelector('#fill-color').value = color
      document.querySelector('#fill-color').removeAttribute('disabled')
    }
    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') { feature.properties.fill = color }
    if (feature.geometry.type === 'Point') { feature.properties['marker-color'] = color }
    this.renderFeature()
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
    // Toggling km-markers on/off adds/removes their companion icons.
    this.renderFeature({ refreshKmMarkers: true })
  }

  updateMarkerSymbol () {
    const feature = this.getEditFeature()
    let symbol = document.querySelector('#marker-symbol').value
    functions.showSymbol(document.querySelector('#emoji'), symbol)
    // strip variation selector (emoji) U+FE0F to match icon file names. The path of an icon
    // set keeps it, the index of the set already names the file that exists.
    if (!symbol.includes('/')) { symbol = symbol.replace(/\uFE0F/g, '') }
    feature.properties['marker-symbol'] = symbol
    // draw layer feature properties aren't getting updated by draw.set()
    // Only update draw if feature is in draw (i.e., geometry editing is active)
    if (draw && draw.get(this.featureIdValue)) {
      draw.setFeatureProperty(this.featureIdValue, 'marker-symbol', symbol)
    }
    functions.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
    this.syncPointSizeDefault()
    // An emoji reads better without the default circle behind it, but only while the user
    // has picked no colors of their own.
    if (symbol && !isWhiteSymbol(symbol) && !feature.properties['marker-color'] && !feature.properties.stroke) {
      document.querySelector('#fill-color-transparent').checked = true
      document.querySelector('#stroke-color-transparent').checked = true
      this.updateFillColorTransparent()
      this.updateStrokeColorTransparent()
    } else if (symbol && isWhiteSymbol(symbol) && feature.properties['marker-color'] === 'transparent') {
      // a white icon is invisible without the circle, an emoji before it can have removed it
      document.querySelector('#fill-color-transparent').checked = false
      this.updateFillColorTransparent()
    }
    this.renderFeature()
  }

  // A point without an explicit marker-size renders at the default for its symbol or image,
  // so the slider must follow when the symbol or the image changes.
  syncPointSizeDefault () {
    const feature = this.getEditFeature()
    if (feature.properties['marker-size']) { return }
    const size = defaultPointSize(feature)
    document.querySelector('#point-size').value = size
    document.querySelector('#point-size-val').textContent = size
    syncStepperValues()
  }

  async updateMarkerImage () {
    const feature = this.getEditFeature()
    const image = document.querySelector('#marker-image').files[0]
    const imageLocation = await confirmImageLocation(image)

    uploadImageToFeature(image, feature)
      .then(data => {
        // Only update draw if feature is in draw (i.e., geometry editing is active)
        if (draw && draw.get(this.featureIdValue)) {
          draw.setFeatureProperty(this.featureIdValue, 'marker-image-url', data.icon)
        }
        document.querySelector('#stroke-color').setAttribute('disabled', 'true')
        document.querySelector('#stroke-color-transparent').checked = true
        document.querySelector('#fill-color').setAttribute('disabled', 'true')
        document.querySelector('#fill-color-transparent').checked = true

        functions.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
        functions.e('.feature-image', e => { e.innerHTML = featureImage(feature) })
        this.syncPointSizeDefault()
        if (imageLocation) {
          feature.geometry.coordinates = imageLocation
          flyToFeature(feature)
        }
        this.renderFeature()
        this.saveFeature()
      })
  }

  removeMarkerSymbol () {
    this.removeMarkerProperty('marker-symbol')
  }

  removeMarkerImage () {
    this.removeMarkerProperty('marker-image-url')
  }

  removeMarkerProperty (property) {
    this.addUndo()
    const feature = this.getEditFeature()
    delete feature.properties[property]
    // Picking a symbol or an image can turn the colors transparent (see updateMarkerSymbol).
    // Without either of them the point would render as nothing, so it gets its colors back.
    // A feature with its own colors keeps them, only an actually transparent one is restored.
    const noSymbolOrImage = !feature.properties['marker-symbol'] && !feature.properties['marker-image-url']
    if (noSymbolOrImage && feature.properties['marker-color'] === 'transparent') {
      document.querySelector('#fill-color-transparent').checked = false
      this.updateFillColorTransparent()
    }
    if (noSymbolOrImage && feature.properties.stroke === 'transparent') {
      document.querySelector('#stroke-color-transparent').checked = false
      this.updateStrokeColorTransparent()
    }
    document.querySelector('#marker-symbol').value = feature.properties['marker-symbol'] || ''
    functions.showSymbol(document.querySelector('#emoji'), feature.properties['marker-symbol'])
    functions.e('#marker-image', e => { e.value = '' })
    functions.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
    functions.e('.feature-image', e => { e.innerHTML = featureImage(feature) })
    this.syncPointSizeDefault()
    // the draw overlay keeps its own copy of the properties, a delete does not reach it
    this.renderFeature({ resetDraw: true })
    this.saveFeature()
  }

  // https://github.com/missive/emoji-mart
  async openEmojiPicker() {
    // Dynamically import emoji-mart + its data
    const { Picker } = await import('emoji-mart')
    const data = async () => {
      const response = await fetch(
        '/icon-sets/noto/emoji-mart-data.json',
      )
      return response.json()
    }
    // Each icon set is one more category tab, see public/icon-sets
    const custom = await Promise.all(iconSets.map(async set => {
      const response = await fetch(`/icon-sets/${set}/index.json`)
      return response.json()
    }))
    const onEmojiSelect = (emoji) => {
      // console.log('Emoji selected:', emoji)
      // an icon of a set has no native character, it carries the path of its image
      document.querySelector('#marker-symbol').value = emoji.native || emoji.src
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
      custom: custom,
      onEmojiSelect: onEmojiSelect,
      onClickOutside: onClickOutside,
      dynamicWidth: true,
      noCountryFlags: true, // TODO country flags don't work right now
      set: 'native', // default is native icons (they don't match the map icons)
      theme: 'light',
      skinTonePosition: 'none',
    }
    // emoji-mart marks a removed <em-emoji-picker> as disconnected for good: it drops its
    // observers and renders nothing on re-insert. Build a fresh element on every open.
    functions.e('em-emoji-picker', e => { e.remove() })
    this.iconObserver?.disconnect()
    this.iconObserver = null
    this.picker = new Picker(pickerOptions)
    // adding <em-emoji-picker> element
    const editUi = document.querySelector('#feature-edit-ui')
    editUi.prepend(this.picker)
    // the picker covers the edit ui down to the bottom edge of the modal, so that the tab
    // buttons above it stay clickable. Only the layout knows where those buttons end. A few
    // px up so the picker's own top padding does not leave the tab row's border peeking out
    this.picker.style.top = `${editUi.offsetTop - 6}px`
    this.stylePicker()
    this.lazyLoadIcons()
    this.keepPreview()
  }

  // Moving the pointer from one emoji to the next clears the preview in between, so the block
  // collapses and pops back on every step. The clear waits, the next hover cancels it.
  keepPreview () {
    // the picker assigns its inner component only once its async render ran
    Object.defineProperty(this.picker, 'component', {
      configurable: true,
      set (component) {
        Object.defineProperty(this, 'component', { value: component, writable: true, configurable: true })
        const showEmoji = component.handleEmojiOver.bind(component)
        let clear
        component.handleEmojiOver = pos => {
          clearTimeout(clear)
          if (pos) { showEmoji(pos) } else { clear = setTimeout(showEmoji, 200) }
        }
      }
    })
  }

  // A white icon is invisible on the white background of the picker. The picker keeps its
  // markup in a shadow root, so the rule cannot come from the stylesheet of the page.
  stylePicker () {
    const root = this.picker.shadowRoot
    if (!root || root.querySelector('#white-icons')) { return }
    const style = document.createElement('style')
    style.id = 'white-icons'
    style.textContent = whiteIconSets.map(set =>
      `img[src*="/icon-sets/${set}/"] { background-color: var(--color-dark-charcoal, #354A51); border-radius: 50%; padding: 3px; margin: -3px; }`
    ).join('\n')
    style.textContent += '\n#nav img { margin: 0; }'
    root.appendChild(style)

    const previewStyle = document.createElement('style')
    previewStyle.id = 'small-preview'
    previewStyle.textContent = `
      #preview:has(.preview-placeholder) { padding: 4px 12px; }
      #preview:has(.preview-placeholder) > div > div:first-child { display: none; }
      #preview > div > div:first-child { height: 1.5rem !important; }
      #preview .emoji-mart-emoji > span { font-size: 1.5rem !important; }
      #preview .emoji-mart-emoji > img { max-width: 1.5rem !important; max-height: 1.5rem !important; }
      .scroll { padding-right: var(--padding); }
    `
    root.appendChild(previewStyle)
  }

  // The picker renders the rows of all its categories at once, so every icon of every set
  // would load on open, thousands of requests. An icon keeps its url in a data attribute
  // until it scrolls into view.
  lazyLoadIcons () {
    const root = this.picker.shadowRoot
    if (!root || this.iconObserver) { return }
    const load = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) { return }
      entry.target.src = entry.target.dataset.src
      load.unobserve(entry.target)
    }), { rootMargin: '300px' })

    // Only the grid holds that many icons. A deferred icon shows its alt text until it loads,
    // so the preview and the nav keep their src and stay quiet.
    const defer = () => root.querySelectorAll('.scroll img:not([data-src])').forEach(img => {
      img.dataset.src = img.getAttribute('src')
      img.removeAttribute('src')
      load.observe(img)
    })
    this.iconObserver = new MutationObserver(defer)
    this.iconObserver.observe(root, { subtree: true, childList: true })
    defer()
  }

  saveFeature () {
    const feature = this.getEditFeature()
    // status('Saving feature \'' + feature.properties.title + '\'')
    // send shallow copy of feature to avoid changes during send
    sendMessage('update_feature', { ...feature })
  }

  addUndo() {
    const feature = this.getEditFeature()
    addUndoState('Feature property update', feature)
  }

  getEditFeature () {
    const feature = getFeature(this.featureIdValue)
    // The feature can vanish under an open modal: another session deleted it, or a reload
    // dropped it because it never reached the server. Close the modal instead of letting
    // every handler dereference null on each keystroke.
    if (!feature) {
      resetHighlightedFeature()
      status(window.__('This feature no longer exists'), 'error')
      throw new Error(`Feature ${this.featureIdValue} no longer exists`)
    }
    return feature
  }

  // Apply the edited feature to the map with a fast surgical single-feature update (no full
  // re-render). Most property edits pass no options and skip the (expensive) companion
  // rebuilds; toggles and stroke color pass { refreshRouteExtras } / { refreshKmMarkers }.
  // See applyFeatureUpdate.
  renderFeature (options = {}) {
    applyFeatureUpdate(this.getEditFeature(), options)
  }
}
