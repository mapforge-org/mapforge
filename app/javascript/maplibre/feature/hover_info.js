import * as f from 'helpers/functions'
import { featureIcon, featureTitle } from 'maplibre/feature'
import { featureMeta } from 'maplibre/feature/details'
import { hasKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { STEEPNESS_RANGES, computeCumulativeDistances } from 'maplibre/layers/geojson/route_extras'
import { getFeature } from 'maplibre/layers/layers'
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'

let popup = null
let dot = null
// the hovered track: the card follows the cursor along it
let route = null

const meters = m => Math.round(m).toLocaleString() + ' m'

function head (title, before = '', after = '') {
  return `<div class="hover-head">${before}<span>${f.escapeHtml(title)}</span>${after}</div>`
}

// a routed or imported track, not a drawn line. Elevation alone does not make a track.
const isTrack = feature => hasKmMarkers(feature) ||
  (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1 && !!feature.properties.route)

function lineCard (feature) {
  const title = featureTitle(feature)
  const track = isTrack(feature)
  // a card with only the length tells too little
  if (!title && !track) { return null }
  const color = f.cssColor(feature.properties.stroke) || defaults.featureColor
  const bar = track ? '<div class="hover-bar"><span class="hover-ring"></span></div><div class="hover-position"></div>' : ''
  return {
    html: `<div style="--route-color: ${f.escapeHtml(color)}">` +
      head(title, featureIcon(feature, { link: false, lazy: false }),
        `<span class="hover-total">${featureMeta(feature)}</span>`) + bar + '</div>',
    options: { anchor: 'left', offset: 14 },
    route: track && {
      feature,
      color,
      cumulative: computeCumulativeDistances(feature.geometry.coordinates),
      steepness: feature.properties.route?.extras?.steepness?.values
    }
  }
}

// A point has no card, it shows its title as a label, see 'text-layer-front' in styles.js
function polygonCard (feature) {
  const p = feature.properties
  const title = featureTitle(feature)
  // a label already shows the name on the map
  if (!title || f.present(p.label) || f.present(p['label-title'])) { return null }
  const color = f.escapeHtml(f.cssColor(p['fill-extrusion-color'] || p.fill) || defaults.featureColor)
  return {
    html: head(title, `<span class="hover-swatch" style="background: ${color}"></span>`),
    options: { anchor: 'top-left', offset: 14 },
    trackPointer: true
  }
}

const cards = {
  LineString: lineCard,
  MultiLineString: lineCard,
  Polygon: polygonCard,
  MultiPolygon: polygonCard
}

// the elevation chart of the details modal marks the same point, null clears it
const showOnChart = at => window.dispatchEvent(new CustomEvent('track-position',
  { detail: { featureId: route.feature.id, meters: at } }))

// the screen positions of the track points hold until the camera moves
const dropProjection = () => { if (route) { route.points = null } }

export function showHoverInfo (feature, lngLat) {
  popup?.remove()
  dot?.remove()
  if (route) { showOnChart(null) }
  map.off('move', dropProjection)
  route = null
  // a rendered feature has its geometry cut at the tile edges, the card needs the whole one
  const card = feature && cards[feature.geometry.type]
  const info = card?.(getFeature(feature.id) || feature)
  if (!info) { return }
  popup = new window.maplibregl.Popup({
    closeButton: false, closeOnClick: false, focusAfterOpen: false,
    className: 'feature-hover-info', maxWidth: '16rem', ...info.options
  }).setHTML(info.html).setLngLat(lngLat).addTo(map)
  // trackPointer() places the card on the next mouse move only, setLngLat places it now
  if (info.trackPointer) { popup.trackPointer() }
  if (info.route) {
    route = info.route
    const el = popup.getElement()
    route.ring = el.querySelector('.hover-bar .hover-ring')
    route.position = el.querySelector('.hover-position')
    map.on('move', dropProjection)
    dot = routeDot(dot, route.color)
    dot.setLngLat(lngLat).addTo(map)
    moveHoverInfo(lngLat)
  }
}

// the ring that marks a position on a track, also for the hover on the elevation chart
export function routeDot (marker, color) {
  marker ||= new window.maplibregl.Marker({
    element: Object.assign(document.createElement('div'), { className: 'hover-ring hover-route-dot' })
  })
  marker.getElement().style.setProperty('--route-color', color)
  return marker
}

// The point of the track nearest to the cursor on screen: the index of its segment and how far
// along that segment it is, from 0 to 1
function nearestOnTrack (lngLat) {
  const p = map.project(lngLat)
  const points = route.points ||= route.feature.geometry.coordinates.map(c => map.project([c[0], c[1]]))
  let nearest = { distance: Infinity }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const dx = points[i + 1].x - a.x
    const dy = points[i + 1].y - a.y
    const squared = dx * dx + dy * dy
    const share = squared ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / squared)) : 0
    const distance = (a.x + share * dx - p.x) ** 2 + (a.y + share * dy - p.y) ** 2
    if (distance < nearest.distance) { nearest = { distance, index: i, share } }
  }
  return nearest
}

// the cursor moved on the same feature
export function moveHoverInfo (lngLat) {
  if (!route) { return }
  const { index, share } = nearestOnTrack(lngLat)
  const coords = route.feature.geometry.coordinates
  const step = route.cumulative[index + 1] - route.cumulative[index]
  const at = route.cumulative[index] + step * share
  const position = coords[index].map((c, i) => c + (coords[index + 1][i] - c) * share)

  dot.setLngLat(position)
  popup.setLngLat(position)

  route.ring.style.left = (100 * at / route.cumulative.at(-1)) + '%'
  // the steepness class of the routing service, a grade from two track points jumps around
  const steepness = route.steepness?.find(([start, end]) => start <= index && index < end)?.[2]
  const arrow = steepness > 0 ? 'bi-arrow-up-right' : steepness < 0 ? 'bi-arrow-down-right' : 'bi-arrow-right'
  // the icons tell elevation and steepness apart, the values are numbers, so the html is safe
  const html = [
    '<span class="hover-ring"></span>',
    `<span>km ${(at / 1000).toFixed(1)}</span>`,
    position[2] != null && `<span><i class="bi bi-triangle"></i>${meters(position[2])}</span>`,
    steepness != null && `<span><i class="bi ${arrow}"></i>${STEEPNESS_RANGES[Math.abs(steepness)]}</span>`
  ].filter(Boolean).join('')
  // the text changes only every 100m or so, a new html would rebuild the elements in each frame
  if (html !== route.html) { route.position.innerHTML = route.html = html }
  showOnChart(at)
}
