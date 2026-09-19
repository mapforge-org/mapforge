import { sanitizeMarkdown } from 'helpers/functions'
import { featureOnLevel } from 'maplibre/controls/levels'
import { map } from 'maplibre/map'
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

function upsertDescBanner (feature, layerId, visible) {
  marked.use({ gfm: true, breaks: true })
  const html = sanitizeMarkdown(marked(feature.properties.desc))
  let popup = banners.get(key(layerId, feature))?.popup
  if (!popup) {
    // focusAfterOpen would pull the focus out of the description editor on every keystroke
    popup = new window.maplibregl.Popup({
      closeButton: false, closeOnClick: false, focusAfterOpen: false, anchor: 'bottom', className: 'desc-banner',
      maxWidth: '40rem'
    }).setLngLat(feature.geometry.coordinates).addTo(map)
  }
  banners.set(key(layerId, feature), { popup, feature })
  popup.setLngLat(feature.geometry.coordinates).setHTML(html)
  scaleBanner(popup, feature)
  popup.getElement().classList.toggle('hidden', !(visible && featureOnLevel(feature)))
}

// Same curve as shapeIconSize in styles.js: 1x at zoom 16, doubling with each zoom level.
// A plain circle ignores marker-scaling (see pointSize in styles.js), so its offset stays put.
function scaleBanner (popup, feature) {
  const p = feature.properties
  const radius = Number(p['marker-size'] || defaultPointSize(feature))
  const zoomFactor = p['marker-scaling'] ? 2 ** (map.getZoom() - 16) : 1
  const plainCircle = !p['marker-symbol'] && !p['marker-image-url'] && (p['marker-shape'] || 'circle') === 'circle'
  // marker-size is the radius, so the arrow tip sits on the top edge of the marker
  popup.setOffset(radius * (plainCircle ? 1 : zoomFactor))
  // a marker at its default size gets the banner at 1x, twice the size doubles the banner
  popup.getElement().style.setProperty('--scale', radius / defaultPointSize(feature) * zoomFactor)
}

function removeBanner (id) {
  banners.get(id)?.popup.remove()
  banners.delete(id)
}
