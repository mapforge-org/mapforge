import * as dom from 'helpers/dom'
import * as f from 'helpers/functions'
import { featureIcon, getFeatureTypeName } from 'maplibre/feature'
import { descShape } from 'maplibre/layers/geojson/desc_banners'
import { canPinImage } from 'maplibre/layers/geojson/image_overlays'
import { layers } from 'maplibre/layers/layers'
import { defaults } from 'maplibre/styles/defaults'
import { patternDataUrl, patternKeys } from 'maplibre/styles/pattern_image'

// Marks the button of the shape that the feature uses. No 'marker-shape' means a circle.
export function syncShapeButtons (feature) {
  const shape = feature.properties['marker-shape'] || 'circle'
  document.querySelectorAll('#marker-shape-ui [data-shape]').forEach(button => {
    button.classList.toggle('active', button.dataset.shape === shape)
  })
}

export function syncDescShapeButtons (feature) {
  const shape = descShape(feature)
  document.querySelectorAll('#desc-shape-ui [data-desc-shape]').forEach(button => {
    button.classList.toggle('active', button.dataset.descShape === shape)
  })
}

// 'onclick' false is a boolean in the geojson, the menu needs a name for it
export const featureOnclickMode = feature => {
  const onclick = feature.properties.onclick
  if (onclick === false) { return 'none' }
  return ['link', 'feature'].includes(onclick) ? onclick : 'details'
}

const featureItem = feature =>
  `${featureIcon(feature, { link: false })}<span>${f.escapeHtml(feature.properties.title ||
    feature.properties.label || getFeatureTypeName(feature))}</span>`

// The toggle of a dropdown shows the chosen item, the same as a select does
export function syncFeatureOnclickUi (feature) {
  const mode = featureOnclickMode(feature)
  const target = feature.properties['onclick-target'] || ''
  const item = document.querySelector(`#feature-onclick-ui [data-feature-onclick-mode='${mode}']`)
  document.querySelector('#feature-onclick').innerHTML = item.innerHTML
  const link = document.querySelector('#feature-onclick-link')
  link.classList.toggle('hidden', mode !== 'link')
  if (mode === 'link' && document.activeElement !== link) { link.value = target }
  document.querySelector('#feature-onclick-feature-ui').classList.toggle('hidden', mode !== 'feature')
  if (mode !== 'feature') { return }
  const others = layers.filter(l => l.type === 'geojson')
    .flatMap(l => l.geojson?.features || [])
    .filter(other => other.id !== feature.id)
  document.querySelector('#feature-onclick-feature-menu').innerHTML = others.map(other =>
    `<li><button type='button' class='dropdown-item' data-feature-id='${f.escapeHtml(other.id)}'
      data-action='click->feature--edit#addUndo click->feature--edit#updateFeatureOnclick'>${featureItem(other)}</button></li>`
  ).join('')
  const chosen = others.find(other => other.id === target)
  document.querySelector('#feature-onclick-feature').innerHTML = chosen
    ? featureItem(chosen)
    : `<span>${window.__('Select a feature')}</span>`
}

// An image covers a symbol, so a point that carries both reads as an image.
export function markerContentMode (feature) {
  if (feature.properties['marker-image-url']) { return 'image' }
  if (feature.properties['marker-symbol']) { return 'symbol' }
  return 'none'
}

// What the marker content toggle stepped away from, keyed by feature id. Lets the value come
// back when the user switches back to its mode. Page local, it never reaches the server.
export const markerMemory = new Map()

// Each toggle button carries what it holds, so the previews live inside the buttons. A button
// that is off keeps showing what it remembers, so the user sees what a click brings back.
export function syncMarkerContent (feature) {
  const mode = markerContentMode(feature)
  document.querySelectorAll('#marker-content-ui [data-content]').forEach(button => {
    button.classList.toggle('active', button.dataset.content === mode)
  })
  const memory = markerMemory.get(feature.id) || {}
  const symbol = feature.properties['marker-symbol'] || memory['marker-symbol']
  const imageUrl = feature.properties['marker-image-url'] || memory['marker-image-url']
  f.e('#marker-symbol', e => { e.value = feature.properties['marker-symbol'] || '' })
  // the same rendering as the icon in the modal head, circle color and border included. An
  // image wins over a symbol in featureIcon, so the preview feature carries the symbol alone.
  const symbolFeature = { ...feature, properties: { ...feature.properties, 'marker-image-url': null, 'marker-symbol': symbol } }
  f.e('#emoji', e => { e.innerHTML = symbol ? featureIcon(symbolFeature, { link: false, lazy: false }) : '' })
  f.e('#marker-image-preview', e => {
    e.innerHTML = imageUrl ? `<img class='feature-details-icon' src='${f.escapeHtml(imageUrl)}'>` : ''
  })
  // a reset lets the same file fire 'change' again
  f.e('#marker-image', e => { e.value = '' })
}

export function backgroundMode (feature) {
  if (feature.properties['fill-image-url']) { return 'image' }
  if (feature.properties['fill-pattern']) { return 'pattern' }
  return 'fill'
}

// One tile of a pattern on the fill color of the feature, the same as the map draws it
function patternSwatch (feature, key) {
  const fill = feature.properties.fill || defaults.featureColor
  const url = patternDataUrl(key, feature.properties.stroke || defaults.featureOutlineColor)
  return `<span class='pattern-swatch' style='background-color: ${f.escapeHtml(fill)}; background-image: url(${url})'></span>`
}

// The menu carries the colors of the feature, so it is built again on every sync.
function syncPatternMenu (feature) {
  const labels = {
    hatch: window.__('Hatch'),
    cross: window.__('Crosshatch'),
    lines: window.__('Lines'),
    'lines-bold': window.__('Thick lines'),
    grid: window.__('Grid'),
    dots: window.__('Dots'),
    'dots-big': window.__('Big dots'),
    checker: window.__('Checker')
  }
  f.e('#fill-pattern-menu', menu => {
    menu.innerHTML = patternKeys.map(key =>
      `<li><button type='button' class='dropdown-item' data-pattern='${key}'
        data-action='click->feature--edit#updateFillPattern'>${patternSwatch(feature, key)}${labels[key]}</button></li>`
    ).join('')
  })
}

// The image button carries the image that it holds, the same as the symbol row of a point, and
// keeps showing it while the button is off. The file input of the image only exists for a
// logged in user, and only a polygon with four corners can pin an image.
export function syncBackground (feature) {
  const mode = backgroundMode(feature)
  const memory = markerMemory.get(feature.id) || {}
  const imageUrl = feature.properties['fill-image-url'] || memory['fill-image-url']
  const input = document.querySelector('#fill-image')
  const pinnable = canPinImage(feature)
  document.querySelectorAll('#fill-image-ui [data-background]').forEach(button => {
    button.classList.toggle('active', button.dataset.background === mode)
  })
  f.e('#fill-image-preview', e => {
    e.innerHTML = imageUrl ? `<img class='feature-details-icon' src='${f.escapeHtml(imageUrl)}'>` : ''
  })
  // the swatch says which pattern is on, so a remembered one must not show it
  f.e('#fill-pattern-preview', e => {
    const pattern = feature.properties['fill-pattern']
    e.innerHTML = pattern ? patternSwatch(feature, pattern) : ''
  })
  syncPatternMenu(feature)
  // a reset lets the same file fire 'change' again
  if (input) { input.value = '' }
  f.e('#fill-image-button', e => {
    e.disabled = !input || !pinnable
    dom.setTooltip(e, !input
      ? window.__('Please log in to upload images')
      : (pinnable ? window.__('Max. 5MB') : window.__('Needs a polygon with four corners')))
  })
}
