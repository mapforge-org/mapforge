import { area } from "@turf/area"
import { length } from "@turf/length"
import * as dom from 'helpers/dom'
import * as f from 'helpers/functions'
import { marked, sanitizeMarkdown } from 'helpers/markdown'
import { featureIcon, featureTitle, getFeatureTypeName, routeKind } from 'maplibre/feature'
import { showElevationChart } from 'maplibre/feature/elevation'
import { showExtrasTotals } from 'maplibre/feature/extras_totals'
import { heightShare, profileLine, trackProfile } from 'maplibre/feature/track_profile'
import { getFeature, getLayer } from "maplibre/layers/layers"
import { defaults } from 'maplibre/styles/defaults'

// a modal without tabs (read only map, or a feature of a non geojson layer) has no
// geometry tab, so it keeps the coordinates and the map links in the meta line
function tabActive (tab) {
  if (document.querySelector('#edit-buttons').classList.contains('hidden')) { return true }
  return document.querySelector(`#edit-button-${tab}`).classList.contains('active')
}

function formatLength (km) {
  return km <= 2 ? f.formatNumber(km * 1000) + ' m' : f.formatNumber(km, 2) + ' km'
}

function formatArea (m2) {
  return m2 < 100000 ? f.formatNumber(m2) + ' m²' : f.formatNumber(m2 / 1000000, 2) + ' km²'
}

const isLine = feature => ['LineString', 'MultiLineString'].includes(feature.geometry.type)

function pointMeta (lat, lng) {
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`

  // Clickable coordinates span with data attributes for toggle
  const coordsSpan = `<span class="link coords-text" data-action="click->feature--modal#toggleCoordFormat" data-lat="${lat}" data-lng="${lng}" title="${window.__('Click to toggle format')}">${coords}</span>`

  // Copy to clipboard icon for coordinates
  const copyIcon = `<a class="link text-muted copy-link ms-1" data-action="click->feature--modal#copyCoordinates" data-coords="${coords}" data-toggle="tooltip" data-bs-placement="bottom" data-bs-trigger="hover" title="${window.__('Copy coordinates to clipboard')}"><i class="bi bi-copy"></i></a>`

  // Navigation links
  const googleMapsUrl = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`
  const osmUrl = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}&zoom=15`

  const googleLink = `<a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="link text-nowrap d-inline-flex align-items-center me-3"><img src="/icons/google-maps.png" class="me-1" alt="Google Maps"> <span class="d-none d-sm-block me-1">See in</span> Google Maps</a>`
  const osmLink = `<a href="${osmUrl}" target="_blank" rel="noopener noreferrer" class="link text-nowrap d-inline-flex align-items-center"><img src="/icons/osm-icon-smaller.png" class="me-1" alt="OpenStreetMap"> <span class="d-none d-sm-block me-1">See in</span> OpenStreetMap</a>`

  const coordsPart = tabActive('geometry') ? coordsSpan + copyIcon : ''
  const linksPart = tabActive('details') ? '<div class="mt-1">' + googleLink + osmLink + '</div>' : ''
  return coordsPart + linksPart
}

export function featureMeta (feature) {
  const { type, coordinates } = feature.geometry
  if (type === 'LineString' && coordinates.length > 1) { return formatLength(length(feature)) }
  if (type === 'MultiLineString') { return formatLength(length(feature)) }
  if (type === 'Polygon' || type === 'MultiPolygon') { return formatArea(area(feature)) }
  if (type === 'Point') { return pointMeta(coordinates[1], coordinates[0]) }
  return ''
}

// a polygon ring repeats its first point at the end, so the count drops it
function vertexCount ({ type, coordinates }) {
  switch (type) {
    case 'LineString': return coordinates.length
    case 'MultiLineString': return coordinates.reduce((sum, line) => sum + line.length, 0)
    case 'Polygon': return coordinates[0].length - 1
    case 'MultiPolygon': return coordinates.reduce((sum, polygon) => sum + polygon[0].length - 1, 0)
  }
}

const pointCount = count => window.__('%{count} points').replace('%{count}', f.formatNumber(count))

// the stats card of the details tab shows the length of a line, the geometry tab shows it here
export function refreshFeatureMeta (feature) {
  const inCard = isLine(feature) && tabActive('details')
  const count = vertexCount(feature.geometry)
  // the summary of a routed track has the length already
  const summary = showTrackSummary(feature)
  const shown = !inCard && !summary && (tabActive('details') || tabActive('geometry'))
  document.querySelector('#feature-details-meta').classList.toggle('hidden', !shown)
  document.querySelector('#feature-size').innerHTML = inCard ? '' : featureMeta(feature)
  document.querySelector('#feature-vertexes').textContent = inCard || count === undefined ? '' : ', ' + pointCount(count)
}

const KIND_NAMES = { foot: window.__('Hike'), bike: window.__('Bike tour'), car: window.__('Car trip') }
const TIME_LABELS = { foot: window.__('Walking time'), bike: window.__('Riding time'), car: window.__('Driving time') }

// "Hike · 4 waypoints", a line without waypoints counts its points
function lineSubtitle (feature) {
  const waypoints = feature.properties.route?.waypoints?.length
  const count = waypoints
    ? window.__('%{count} waypoints').replace('%{count}', f.formatNumber(waypoints))
    : pointCount(vertexCount(feature.geometry))
  return [KIND_NAMES[routeKind(feature)] || getFeatureTypeName(feature), count].join(' · ')
}

// a ruler, the length icon of bootstrap shows two crossed rulers
const LENGTH_ICON = '<svg class="card-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="5" width="14" height="6" rx="1" ' +
  'fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M4 5v2.5M7 5v1.5M10 5v2.5M13 5v1.5" stroke="currentColor" stroke-width="1.1"/></svg>'

const icon = name => `<i class="bi ${name}"></i>`

function stat (iconHtml, label, value) {
  return `<div class="feature-stat"><div class="feature-stat-label">${iconHtml}${f.escapeHtml(label)}</div>` +
    `<div class="feature-stat-value">${f.escapeHtml(value)}</div></div>`
}

// "≈ 2:45 h"
function formatDuration (seconds) {
  const minutes = Math.round(seconds / 60)
  return `≈ ${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`
}

function statsHtml (feature, profile) {
  const duration = feature.properties.route?.duration
  return isLine(feature) ? [
    stat(LENGTH_ICON, window.__('Length'), formatLength(length(feature))),
    profile?.eles && stat(icon('bi-arrow-up'), window.__('Ascent'), f.formatNumber(profile.gain) + ' m'),
    profile?.eles && stat(icon('bi-arrow-down'), window.__('Descent'), f.formatNumber(profile.loss) + ' m'),
    duration && stat(icon('bi-clock'), TIME_LABELS[routeKind(feature)] || TIME_LABELS.foot, formatDuration(duration))
  ].filter(Boolean) : []
}

function showStats (feature, profile) {
  const element = document.querySelector('#feature-stats')
  const stats = statsHtml(feature, profile)
  element.innerHTML = stats.join('')
  element.classList.toggle('hidden', stats.length === 0)
}

// the elevation profile as a filled outline, without axes. The svg stretches to its box,
// so the line keeps its width with a non-scaling stroke.
function silhouetteSvg (profile, color) {
  const height = heightShare(profile, 10)
  // about 300 points are enough for the width of the modal
  const line = profileLine(profile, 300, e => 38 - height(e) * 36)
  return `<svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">` +
    `<path d="M0 40L${line}L100 40Z" fill="${color}" fill-opacity="0.2"/>` +
    `<path d="M${line}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`
}

// The geometry tab of a routed track shows its key values and its elevation profile, so a
// change of the waypoints shows its effect at once. Returns whether it shows.
function showTrackSummary (feature) {
  const element = document.querySelector('#geometry-track-summary')
  const shown = !!feature.properties.route && feature.geometry.type === 'LineString' && tabActive('geometry')
  element.classList.toggle('hidden', !shown)
  if (!shown) { return false }
  const profile = trackProfile(feature)
  const color = f.escapeHtml(feature.properties.stroke || defaults.featureColor)
  element.querySelector('.feature-stats').innerHTML = statsHtml(feature, profile).join('')
  element.querySelector('.track-silhouette').innerHTML = profile?.eles ? silhouetteSvg(profile, color) : ''
  return true
}

// a long description of a track folds, so the profile stays in view
function foldDescription (feature) {
  const description = document.querySelector('#feature-details-description')
  const more = document.querySelector('#feature-description-more')
  // a short text keeps no fold, the fold fades out its last line
  description.classList.toggle('folded', isLine(feature))
  if (description.scrollHeight <= description.clientHeight + 2) { description.classList.remove('folded') }
  more.textContent = window.__('Show more')
  more.classList.toggle('hidden', !description.classList.contains('folded'))
}

export function toggleDescription () {
  const folded = document.querySelector('#feature-details-description').classList.toggle('folded')
  document.querySelector('#feature-description-more').textContent = folded ? window.__('Show more') : window.__('Show less')
}

function featureHasDescription (feature) {
  const p = feature?.properties
  if (!p) return false
  if (p.wikipediaId) return true
  // the tags of an osm element become the body of the modal, see overpassDescription
  if (p.osm) return true
  return !!p.description
}

// the elevation chart and the route extras need room, they show for a LineString only,
// see showElevationChart and showExtrasTotals
function featureHasBody (feature) {
  if (featureHasDescription(feature)) return true
  const { type, coordinates } = feature.geometry ?? {}
  return type === 'LineString' && (coordinates[0]?.length === 3 || !!feature.properties?.route?.extras)
}

// the light background of the feature icon, in the feature color
export function symbolTint (feature) {
  const color = feature.properties['marker-color'] || feature.properties.stroke || feature.properties.fill
  return /^#[0-9a-f]{6}$/i.test(color) ? color + '1f' : null
}

export function showFeatureDetails (feature) {
  const modal = document.querySelector('#feature-details-modal')
  // A new look at the open feature, after an undo or a click on it, keeps its tab and the sheet.
  // A click on the details tab clears the active tab first, see toggle_edit_feature.
  const keepTab = modal.classList.contains('show') &&
    modal.getAttribute('data-feature--modal-feature-id-value') === String(feature.id) &&
    !!document.querySelector('#edit-buttons:not(.hidden) .feature-tab-btn.active:not(#edit-button-details)')
  if (!keepTab) {
    dom.hideElements(['#feature-edit-ui'])
    f.e('#edit-buttons button', (e) => { e.classList.remove('active') })
    document.querySelector('#edit-button-details')?.classList.add('active')
  }
  // allow edit in rw mode for geojson features only. an osm element of a search result, of
  // an overpass layer or of the basemap belongs to no geojson layer, so it keeps the tabs off
  const editable = window.gon.map_mode === 'rw' && Boolean(getFeature(feature.id, 'geojson'))
  document.querySelector('#edit-buttons').classList.toggle('hidden', !editable)
  if (!keepTab) {
    dom.showElements('#feature-details-body')
    modal.classList.remove('modal-pull-min', 'modal-pull-down', 'modal-pull-middle', 'modal-pull-up', 'modal-pull-fade')
    modal.classList.add(featureHasBody(feature) ? 'modal-pull-middle' : 'modal-pull-min')
    // without this, the details height depends on the tab you came from
    if (!modal.dataset.userSized) { modal.style.removeProperty('height') }
    // the sheet must appear at its class height, not slide down from the height of the
    // feature before it. The flush commits that height while the transition is off.
    modal.classList.remove('modal-pull-transition')
    modal.getBoundingClientRect()
    modal.classList.add('modal-pull-transition')
    modal.querySelector('.feature-modal-scroll').scrollTo(0, 0)
  }
  modal.classList.add('show')
  modal.setAttribute('data-feature--modal-feature-id-value', feature.id)
  // Only set edit feature id for geojson features to avoid Stimulus controller errors
  const featureLayer = getLayer(feature.id)
  if (featureLayer && featureLayer.type === 'geojson') {
    modal.setAttribute('data-feature--edit-feature-id-value', feature.id)
  } else {
    modal.removeAttribute('data-feature--edit-feature-id-value')
  }

  f.e('.feature-symbol', e => {
    e.innerHTML = featureIcon(feature, { lazy: false })
    e.style.setProperty('--symbol-tint', symbolTint(feature))
  })

  // a line always has a title, so the subtitle with its type and point count has a place
  const untitled = routeKind(feature) ? window.__('Untitled route') : window.__('Untitled line')
  const title = featureTitle(feature) || (isLine(feature) ? untitled : '')
  const subtitle = document.querySelector('#feature-subtitle')
  subtitle.textContent = isLine(feature) ? lineSubtitle(feature) : ''
  subtitle.classList.toggle('hidden', !isLine(feature))
  const titleElement = document.querySelector('#feature-title')
  titleElement.textContent = title
  titleElement.style.fontSize = titleElement.textContent.length > 24 ? '1rem' : null;
  document.querySelector('.feature-modal-header').classList.toggle('no-title', !title)
  // a small view mode sheet with a title shows the title only, see feature.css
  modal.classList.toggle('modal-title-only', !editable && !!title)

  refreshFeatureMeta(feature)
  const exportable = feature.geometry.type !== 'Point' && featureLayer?.type === 'geojson'
  document.querySelector('#feature-export-bar').classList.toggle('hidden', !exportable)
  if (exportable) {
    setExportHref('#feature-export-geo', feature, '.geojson', '.geojson')
    setExportHref('#feature-export-gpx', feature, '.gpx', '')
    showGarminState(feature)
  }

  const profile = trackProfile(feature)
  showStats(feature, profile)
  document.querySelector('#feature-details-description').innerHTML = window.__('Loading description...')
  featureDescription(feature).then(desc => {
    document.querySelector('#feature-details-description').innerHTML = desc
    foldDescription(feature)
  })

  showExtrasTotals(profile)
  dom.initTooltips(modal)

  // Fire-and-forget — Chart.js dynamic import shouldn't block the modal's basic info.
  // showElevationChart destroys any prior chart on the canvas itself.
  showElevationChart(feature, profile)
}

export function garminCourseUrl (courseId) {
  return 'https://connect.garmin.com/modern/course/' + encodeURIComponent(courseId)
}

export function showGarminState (feature) {
  f.e('#feature-export-garmin', e => {
    e.classList.toggle('hidden', feature.geometry.type !== 'LineString')
    const upload = e.querySelector('.garmin-upload')
    if (!upload) { return }
    upload.dataset.url = upload.dataset.url.replace(/feature\/[^/]*/, 'feature/' + feature.id)
    const courseId = window.gon.garmin_course_ids?.[feature.id]
    const course = e.querySelector('.garmin-course')
    course.classList.toggle('hidden', !courseId)
    if (courseId) { course.href = garminCourseUrl(courseId) }
    const icon = upload.querySelector('i')
    icon.classList.toggle('bi-cloud-upload', !courseId)
    icon.classList.toggle('bi-arrow-repeat', !!courseId)
    dom.setTooltip(upload, courseId ? window.__('Update course in Garmin Connect') : window.__('Send to Garmin Connect'))
  })
}

// the gpx route takes the file name without an extension
function setExportHref (selector, feature, ext, nameExt) {
  const link = document.querySelector(selector)
  if (!link) { return }
  let href = link.getAttribute('href').replace(/feature\/.*/, 'feature/' + feature.id + ext)
  if (feature.properties.title) {
    href += '/' + encodeURIComponent(feature.properties.title.replace(/[\s\/]+/g, "_")) + nameExt
  }
  link.setAttribute('href', href)
}

async function featureDescription (feature) {
  let desc = ''
  // show link target if onclick is link
  if (feature?.properties?.onclick === 'link' && feature?.properties?.['onclick-target']) {
    const target = f.escapeHtml(feature.properties['onclick-target'])
    desc = `<p><i class="bi bi-box-arrow-up-right"></i> <a href="${target}">${target}</a></p>`
  } else if (feature?.properties?.onclick === 'feature' && feature?.properties?.['onclick-target']) {
    // show feature target if onclick is feature
    desc = `<p><i class="bi bi-geo-alt-fill"></i> ${feature.properties['onclick-target']}</p>`
  } else {
    // layers can load their description on demand, the modal shows a loading message meanwhile.
    // the search layer is imported here, a static import of it breaks the module init order
    const layer = getLayer(feature.id) ||
      (await import('maplibre/layers/search')).searchLayerOf(feature.id)
    const markdown = layer?.description ? await layer.description(feature) : feature?.properties?.description
    desc = marked(markdown || '')
  }
  // every branch builds html from properties or api answers that a stranger can control
  return sanitizeMarkdown(desc)
}
