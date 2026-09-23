import { area } from "@turf/area"
import { length } from "@turf/length"
import * as dom from 'helpers/dom'
import * as f from 'helpers/functions'
import { featureIcon, featureTitle } from 'maplibre/feature'
import { showElevationChart } from 'maplibre/feature/elevation'
import { showExtrasTotals } from 'maplibre/feature/extras_totals'
import { getFeature, getLayer } from "maplibre/layers/layers"
import { marked } from 'marked'

// a modal without tabs (read only map, or a feature of a non geojson layer) has no
// geometry tab, so it keeps the coordinates in the meta line
function coordinatesTabActive () {
  if (document.querySelector('#edit-buttons').classList.contains('hidden')) { return true }
  return document.querySelector('#edit-button-geometry').classList.contains('active')
}

function formatLength (km) {
  // 2 decimals
  return km <= 2 ? Math.round(km * 1000) + ' m' : Math.round(km * 100) / 100 + ' km'
}

function formatArea (m2) {
  return m2 < 100000 ? m2.toFixed(0) + ' m²' : (m2 / 1000000).toFixed(2) + ' km²'
}

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

  const coordsPart = coordinatesTabActive() ? coordsSpan + copyIcon : ''
  return coordsPart + '<div class="mt-1">' + googleLink + osmLink + '</div>'
}

function featureMeta (feature) {
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

function featureVertexes (feature) {
  const count = vertexCount(feature.geometry)
  return count === undefined ? '' : ', ' + count + ' points'
}

export function refreshFeatureMeta (feature) {
  document.querySelector('#feature-size').innerHTML = featureMeta(feature)
  document.querySelector('#feature-vertexes').innerHTML = featureVertexes(feature)
}

function featureHasDescription (feature) {
  const p = feature?.properties
  if (!p) return false
  if (p.wikipediaId) return true
  // the tags of an osm element become the body of the modal, see overpassDescription
  if (p.osm) return true
  return !!p.desc
}

export function showFeatureDetails (feature) {
  dom.hideElements(['#feature-edit-ui'])
  f.e('#edit-buttons button', (e) => { e.classList.remove('active') })
  document.querySelector('#edit-button-details')?.classList.add('active')
  // allow edit in rw mode for geojson features only. an osm element of a search result, of
  // an overpass layer or of the basemap belongs to no geojson layer, so it keeps the tabs off
  const editable = window.gon.map_mode === 'rw' && Boolean(getFeature(feature.id, 'geojson'))
  document.querySelector('#edit-buttons').classList.toggle('hidden', !editable)
  dom.showElements('#feature-details-body')
  const modal = document.querySelector('#feature-details-modal')
  modal.classList.remove('modal-pull-down', 'modal-pull-middle', 'modal-pull-up', 'modal-pull-fade')
  modal.classList.add(featureHasDescription(feature) ? 'modal-pull-middle' : 'modal-pull-down')
  // without this, the details height depends on the tab you came from
  if (!modal.dataset.userSized) { modal.style.removeProperty('height') }
  // the sheet must appear at its class height, not slide down from the height of the
  // feature before it. The flush commits that height while the transition is off.
  modal.classList.remove('modal-pull-transition')
  modal.getBoundingClientRect()
  modal.classList.add('modal-pull-transition')
  modal.classList.add('show')
  modal.scrollTo(0, 0)
  modal.setAttribute('data-feature--modal-feature-id-value', feature.id)
  // Only set edit feature id for geojson features to avoid Stimulus controller errors
  const featureLayer = getLayer(feature.id)
  if (featureLayer && featureLayer.type === 'geojson') {
    modal.setAttribute('data-feature--edit-feature-id-value', feature.id)
  } else {
    modal.removeAttribute('data-feature--edit-feature-id-value')
  }

  f.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature, { lazy: false }) })

  const title = featureTitle(feature)
  const titleElement = document.querySelector('#feature-title')
  titleElement.textContent = title
  titleElement.style.fontSize = titleElement.textContent.length > 24 ? '1rem' : null;
  document.querySelector('.feature-modal-header').classList.toggle('no-title', !title)

  refreshFeatureMeta(feature)
  if (feature.geometry.type === 'Point' || !featureLayer || featureLayer.type !== 'geojson') {
    dom.hideElements('.feature-export')
  } else {
    dom.showElements('.feature-export')
    setExportHref('#feature-export-geo a', feature, '.geojson', '.geojson')
    setExportHref('#feature-export-gpx a', feature, '.gpx', '')
  }

  document.querySelector('#feature-details-description').innerHTML = window.__('Loading description...')
  featureDescription(feature).then(desc => {
    document.querySelector('#feature-details-description').innerHTML = desc
    // the sheet only takes its height once the description is in, an empty one still
    // needs more room than the 25% of modal-pull-down
    dom.fitModalToContent(modal)
  })

  showExtrasTotals(feature)
  dom.initTooltips(modal)

  // Fire-and-forget — Chart.js dynamic import shouldn't block the modal's basic info.
  // showElevationChart destroys any prior chart on the canvas itself.
  showElevationChart(feature)
}

// the gpx route takes the file name without an extension
function setExportHref (selector, feature, ext, nameExt) {
  const link = document.querySelector(selector)
  let href = link.getAttribute('href').replace(/feature\/.*/, 'feature/' + feature.id + ext)
  if (feature.properties.title) {
    href += '/' + encodeURIComponent(feature.properties.title.replace(/[\s\/]+/g, "_")) + nameExt
  }
  link.setAttribute('href', href)
}

async function featureDescription (feature) {
  marked.use({ gfm: true, breaks: true })
  let desc = ''
  // show link target if onclick is link
  if (feature?.properties?.onclick === 'link' && feature?.properties?.['onclick-target']) {
    desc = `<p><i class="bi bi-box-arrow-up-right"></i> ${feature.properties['onclick-target']}</p>`
  } else if (feature?.properties?.onclick === 'feature' && feature?.properties?.['onclick-target']) {
    // show feature target if onclick is feature
    desc = `<p><i class="bi bi-geo-alt-fill"></i> ${feature.properties['onclick-target']}</p>`
  } else {
    // layers can load their description on demand, the modal shows a loading message meanwhile.
    // the search layer is imported here, a static import of it breaks the module init order
    const { searchLayerOf } = await import('maplibre/layers/search')
    const layer = getLayer(feature.id) || searchLayerOf(feature.id)
    const markdown = layer?.description ? await layer.description(feature) : feature?.properties?.desc
    desc = marked(markdown || '')
  }
  // every branch builds html from properties or api answers that a stranger can control
  return f.sanitizeMarkdown(desc)
}
