import { sanitizeMarkdown } from 'helpers/functions'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import { featureOnLevel } from 'maplibre/controls/levels'
import { draw } from 'maplibre/edit'
import { highlightFeature } from 'maplibre/feature'
import { frontFeature, map } from 'maplibre/map'
import { defaultPointSize } from 'maplibre/styles/defaults'
import { marked } from 'marked'

// A point with 'show-desc' carries its markdown description as an HTML popup pinned above the
// marker. Popups are DOM elements, not style layers, so this module keeps them by hand, keyed
// by the geojson layer id like the image overlays.
const banners = new Map()
const prefix = layerId => `${layerId}/`
const key = (layerId, feature) => prefix(layerId) + feature.id

export const hasDescBanner = feature => feature.geometry?.type === 'Point' &&
  !!feature.properties?.['show-desc'] && !!feature.properties?.desc

export function renderDescBanners (features, layerId, visible = true) {
  const wanted = new Set()
  features.filter(hasDescBanner).forEach(feature => {
    wanted.add(key(layerId, feature))
    upsertDescBanner(feature, layerId, visible)
  })
  Array.from(banners.keys())
    .filter(id => id.startsWith(prefix(layerId)) && !wanted.has(id))
    .forEach(removeBanner)
}

export function syncDescBanner (feature, layerId, visible = true) {
  if (hasDescBanner(feature)) {
    upsertDescBanner(feature, layerId, visible)
  } else {
    removeBanner(key(layerId, feature))
  }
}

export function removeDescBanner (feature, layerId) {
  removeBanner(key(layerId, feature))
}

export function rescaleDescBanners () {
  banners.forEach(({ popup, feature }) => scaleBanner(popup, feature))
}

export const descShape = feature => feature.properties['show-desc'] || 'none'

function upsertDescBanner (feature, layerId, visible) {
  marked.use({ gfm: true, breaks: true })
  const html = sanitizeMarkdown(marked(feature.properties.desc))
  const shape = descShape(feature)
  // the tail of a bubble sits at its corner, and maplibre puts the tip where the anchor is
  const anchor = shape === 'bubble' ? 'bottom-left' : 'bottom'
  let popup = banners.get(key(layerId, feature))?.popup
  if (popup && popup.options.anchor !== anchor) {
    removeBanner(key(layerId, feature))
    popup = null
  }
  if (!popup) {
    // focusAfterOpen would pull the focus out of the description editor on every keystroke
    popup = new window.maplibregl.Popup({
      closeButton: false, closeOnClick: false, focusAfterOpen: false, anchor, className: 'desc-banner', maxWidth: '40rem'
    }).setLngLat(feature.geometry.coordinates).addTo(map)
  }
  const created = !banners.has(key(layerId, feature))
  banners.set(key(layerId, feature), { popup, feature })
  // the element of the popup exists only after its first content
  popup.setLngLat(feature.geometry.coordinates).setHTML(html)
  if (created) { bindBannerEvents(popup.getElement(), key(layerId, feature)) }
  scaleBanner(popup, feature)
  const p = feature.properties
  const el = popup.getElement()
  ;['banner', 'square', 'bubble'].forEach(s => el.classList.toggle(`shape-${s}`, s === shape))
  el.classList.toggle('no-tip', p['marker-color'] === 'transparent' && p.stroke === 'transparent')
  el.classList.toggle('hidden', !(visible && featureOnLevel(feature)))
}

// The popup sits beside the canvas container, so the map sees none of its events: the wheel
// is passed on for zooming, a click selects the feature like a click on the marker does.
function bindBannerEvents (el, id) {
  el.addEventListener('wheel', e => {
    e.preventDefault()
    map.getCanvasContainer().dispatchEvent(new WheelEvent('wheel', e))
  })
  // a drag across the text ends in a click as well, but that one selects text for a copy.
  // The selection itself is no clue, it still stands during a click on the selected text.
  let downAt = [0, 0]
  el.addEventListener('mousedown', e => { downAt = [e.clientX, e.clientY] })
  el.addEventListener('click', e => {
    if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 3) { return }
    if (window.gon.map_mode === 'static' || (draw && draw.getMode() !== 'simple_select')) { return }
    const feature = banners.get(id)?.feature
    if (!feature) { return }
    hideContextMenu()
    highlightFeature(feature, true)
    requestAnimationFrame(() => frontFeature(feature))
  })
}

// Same curve as shapeIconSize in styles.js: 1x at zoom 16, doubling with each zoom level.
function scaleBanner (popup, feature) {
  const p = feature.properties
  const radius = Number(p['marker-size'] || defaultPointSize(feature))
  const zoomFactor = p['marker-scaling'] ? 2 ** (map.getZoom() - 16) : 1
  // marker-size is the radius, so the arrow tip sits on the top edge of the marker
  popup.setOffset(radius * zoomFactor)
  // a marker at its default size gets the banner at 1x, twice the size doubles the banner
  popup.getElement().style.setProperty('--scale', radius / defaultPointSize(feature) * zoomFactor)
}

function removeBanner (id) {
  banners.get(id)?.popup.remove()
  banners.delete(id)
}
