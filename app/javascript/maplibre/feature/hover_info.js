import * as f from 'helpers/functions'
import { featureIcon, featureTitle } from 'maplibre/feature'
import { featureMeta, symbolTint } from 'maplibre/feature/details'
import { GRADE_ICON } from 'maplibre/feature/extras_totals'
import { GRADE_CLASSES, gradeClass, heightShare, ORS_CLASS, profileLine, trackProfile } from 'maplibre/feature/track_profile'
import { hasKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { EXTRAS_COLOR_CONFIGS, STEEPNESS_RANGES } from 'maplibre/layers/geojson/route_extras'
import { getFeature } from 'maplibre/layers/layers'
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'

let popup = null
let dot = null
// the hovered track: the card follows the cursor along it
let route = null

// The position on a track, the same in the hover card and in the elevation profile of the details
// modal: distance, elevation, gradient and surface. Without elevation, the steepness class of the
// routing service stands in for the gradient. The values are numbers or translations.
export function trackPositionHtml (profile, segment, at, elevation) {
  const grade = profile.grades?.[segment]
  const steepness = grade == null ? profile.steepness?.[segment] : null
  const arrow = steepness > 0 ? 'bi-arrow-up-right' : steepness < 0 ? 'bi-arrow-down-right' : 'bi-arrow-right'
  const surface = profile.surfaces?.[segment]
  // the steep classes in the color of the chart, the base classes are too light for text
  const grading = GRADE_CLASSES[grade != null ? gradeClass(grade) : ORS_CLASS[steepness]]
  const tint = grading && !grading.base ? ` style="color: ${grading.color}"` : ''
  return [
    '<span class="hover-ring"></span>',
    `<span>km ${f.formatNumber(at / 1000, 1)}</span>`,
    elevation != null && `<span><i class="bi bi-triangle"></i>${f.formatNumber(elevation)} m</span>`,
    grade != null && `<span${tint}>${GRADE_ICON}${f.formatNumber(grade, 1, { signDisplay: 'exceptZero' })} %</span>`,
    steepness != null && `<span${tint}><i class="bi ${arrow}"></i>${STEEPNESS_RANGES[Math.abs(steepness)]}</span>`,
    // 0 is the unknown surface of the routing service, it tells nothing
    surface > 0 && `<span><i class="bi bi-layers"></i>${f.escapeHtml(EXTRAS_COLOR_CONFIGS.surface.labels[surface] || '')}</span>`
  ].filter(Boolean).join('')
}

function head (title, before = '', after = '') {
  return `<div class="hover-head">${before}<span>${f.escapeHtml(title)}</span>${after}</div>`
}

// The elevation of the track as a filled area. The svg stretches to the width of the card, so the
// ring at the position in percent of the length runs on its top edge.
function silhouette (profile, y) {
  return '<svg class="hover-silhouette" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    `<path d="M0 100L${profileLine(profile, 200, y)}L100 100Z"/></svg>`
}

// a routed or imported track, not a drawn line. Elevation alone does not make a track.
const isTrack = feature => hasKmMarkers(feature) ||
  (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1 && !!feature.properties.route)

function lineCard (feature) {
  const title = featureTitle(feature)
  // a MultiLineString has no single profile, its card shows the length only
  const profile = isTrack(feature) && trackProfile(feature)
  const track = !!profile
  // a card with only the length tells too little
  if (!title && !track) { return null }
  const color = feature.properties.stroke || defaults.featureColor
  const tint = symbolTint(feature)
  // without elevation, the ring runs on a line
  // the height of an elevation in percent from the top of the silhouette
  const height = profile?.eles && profile.total && heightShare(profile)
  const y = height && (e => 100 - height(e) * 100)
  const bar = track ? `<div class="hover-bar${y ? ' hover-elevation' : ''}">${y ? silhouette(profile, y) : ''}` +
    '<span class="hover-ring"></span></div><div class="hover-position"></div>' : ''
  return {
    html: `<div class="${track ? 'hover-track' : ''}" style="--route-color: ${f.escapeHtml(color)}">` +
      head(title, `<span class="hover-symbol"${tint ? ` style="--symbol-tint: ${tint}"` : ''}>` +
        featureIcon(feature, { link: false, lazy: false }) + '</span>',
        `<span class="hover-total">${featureMeta(feature)}</span>`) + bar + '</div>',
    options: { anchor: 'left', offset: 14 },
    // a track places the card at its point under the cursor, any other line follows the mouse
    trackPointer: !track,
    route: track && {
      feature,
      color,
      y,
      profile
    }
  }
}

// A point has no card, it shows its title as a label, see 'text-layer-front' in styles.js
function polygonCard (feature) {
  const p = feature.properties
  const title = featureTitle(feature)
  // a label already shows the name on the map
  if (!title || f.present(p.label) || f.present(p['label-title'])) { return null }
  const color = f.escapeHtml(p['fill-extrusion-color'] || p.fill || defaults.featureColor)
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
const showOnChart = position => window.dispatchEvent(new CustomEvent('track-position',
  { detail: { featureId: route.feature.id, position } }))

// the screen positions of the track points hold until the camera moves
const dropProjection = () => { if (route) { route.points = null } }

export function showHoverInfo (feature, lngLat) {
  popup?.remove()
  popup = null
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
    className: 'feature-hover-info', maxWidth: 'none', ...info.options
  }).setHTML(info.html).setLngLat(lngLat).addTo(map)
  // trackPointer() places the card on the next mouse move only, setLngLat places it now
  if (info.trackPointer) { popup.trackPointer() }
  placeSide(lngLat)
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

// The card goes left of the cursor where it would leave the map on the right. The anchor of a
// popup has no setter, setOffset() redraws it with the changed option.
function placeSide (lngLat) {
  const { anchor, offset } = popup.options
  const flip = map.project(lngLat).x + offset + popup.getElement().offsetWidth > map.getContainer().clientWidth
  const side = flip ? anchor.replace('left', 'right') : anchor.replace('right', 'left')
  if (side !== anchor) {
    popup.options.anchor = side
    popup.setOffset(offset)
  }
}

// the cursor moved on the same feature
export function moveHoverInfo (lngLat) {
  if (!popup) { return }
  if (!route) {
    placeSide(lngLat)
    return
  }
  const { index, share } = nearestOnTrack(lngLat)
  const { dists, total } = route.profile
  const coords = route.feature.geometry.coordinates
  const at = dists[index] + (dists[index + 1] - dists[index]) * share
  const position = coords[index].map((c, i) => c + (coords[index + 1][i] - c) * share)

  dot.setLngLat(position)
  popup.setLngLat(position)

  route.ring.style.left = (100 * at / total) + '%'
  // the profile fills the gaps where the track has no elevation
  const { eles } = route.profile
  const elevation = eles && eles[index] + (eles[index + 1] - eles[index]) * share
  if (route.y) { route.ring.style.top = route.y(elevation) + '%' }
  const html = trackPositionHtml(route.profile, index, at, elevation)
  // the text changes only every 100m or so, a new html would rebuild the elements in each frame
  if (html !== route.html) { route.position.innerHTML = route.html = html }
  placeSide(position)
  showOnChart({ segment: index, share, meters: at, elevation })
}
