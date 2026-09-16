import { area } from "@turf/area"
import { center } from "@turf/center"
import { lineString, multiLineString, multiPolygon, polygon } from "@turf/helpers"
import { length } from "@turf/length"
import { coordEach } from "@turf/meta"
import * as dom from 'helpers/dom'
import * as f from 'helpers/functions'
import { status } from 'helpers/status'
import { resetControls } from 'maplibre/controls/shared'
import { showElevationChart } from 'maplibre/feature/elevation'
import { showExtrasTotals } from 'maplibre/feature/extras_totals'
import { canPinImage } from 'maplibre/layers/geojson/image_overlays'
import { getFeature, getFeatureSource, getLayer, layers } from "maplibre/layers/layers"
import { wikipediaFeatureDescription } from 'maplibre/layers/wikipedia'
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'
import { patternDataUrl, patternKeys } from 'maplibre/styles/pattern_image'
import { marked } from 'marked'

window.marked = marked

export let highlightedFeatureId
export let highlightedFeatureSource
export let highlightedSourceLayer = null
export let stickyFeatureHighlight = false

export function featureTitle (feature) {
  const title = feature?.properties?.title || feature?.properties?.user_title ||
    feature?.properties?.label || feature?.properties?.user_label ||
    feature?.properties?.name || feature?.properties?.user_name
  if (!title || title === '') {
    return ''
  }
  return title
}

// a modal without tabs (read only map, or a feature of a non geojson layer) has no
// geometry tab, so it keeps the coordinates in the meta line
function coordinatesTabActive () {
  if (document.querySelector('#edit-buttons').classList.contains('hidden')) { return true }
  return document.querySelector('#edit-button-geometry').classList.contains('active')
}

function featureMeta (feature) {
  let meta = ''
  if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1) {
    const turfLineString = lineString(feature.geometry.coordinates)
    const turfLength = length(turfLineString)
    if (turfLength <= 2) {
      meta = Math.round(turfLength * 1000) + ' m'
    } else {
      // 2 decimals
      meta = Math.round(turfLength * 100) / 100 + ' km'
    }
  } else if (feature.geometry.type === 'MultiLineString') {
    const turfLineString = multiLineString(feature.geometry.coordinates)
    const turfLength = length(turfLineString)
    if (turfLength <= 2) {
      meta = Math.round(turfLength * 1000) + ' m'
    } else {
      // 2 decimals
      meta = Math.round(turfLength * 100) / 100 + ' km'
    }
  } else if (feature.geometry.type === 'Polygon') {
    const turfPolygon = polygon(feature.geometry.coordinates)
    const turfArea = area(turfPolygon)
    if (turfArea < 100000) {
      meta = turfArea.toFixed(0) + ' m²'
    } else {
      meta = (turfArea / 1000000).toFixed(2) + ' km²'
    }
  } else if (feature.geometry.type === 'MultiPolygon') {
    const turfPolygon = multiPolygon(feature.geometry.coordinates)
    const turfArea = area(turfPolygon)
    if (turfArea < 100000) {
      meta = turfArea.toFixed(0) + ' m²'
    } else {
      meta = (turfArea / 1000000).toFixed(2) + ' km²'
    }
  } else if (feature.geometry.type === 'Point') {
    const lat = feature.geometry.coordinates[1]
    const lng = feature.geometry.coordinates[0]
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
    meta = coordsPart + '<div class="mt-1">' + googleLink + osmLink + '</div>'
  }
  return meta
}

function featureVertexes(feature) {
  let vertexes = ''
  if (feature.geometry.type === 'LineString') {
    const coords = feature.geometry.coordinates.length
    vertexes = ', ' + coords + ' points'
  } else if (feature.geometry.type === 'MultiLineString') {
    const coords = feature.geometry.coordinates.reduce((sum, line) => sum + line.length, 0)
    vertexes = ', ' + coords + ' points'
  } else if (feature.geometry.type === 'Polygon') {
    const coords = feature.geometry.coordinates[0].length - 1
    vertexes = ', ' + coords + ' points'
  } else if (feature.geometry.type === 'MultiPolygon') {
    const coords = feature.geometry.coordinates.reduce((sum, polygon) => sum + polygon[0].length - 1, 0)
    vertexes = ', ' + coords + ' points'
  }
  return vertexes
}

export function refreshFeatureMeta (feature) {
  document.querySelector('#feature-size').innerHTML = featureMeta(feature)
  document.querySelector('#feature-vertexes').innerHTML = featureVertexes(feature)
}

export function featureHasDescription (feature) {
  const p = feature?.properties
  if (!p) return false
  if (p.wikipediaId) return true
  // the tags of an osm element become the body of the modal, see overpassDescription
  if (p.osm) return true
  return !!p.desc
}

export async function showFeatureDetails (feature) {
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
  titleElement.innerHTML = title
  titleElement.style.fontSize = titleElement.textContent.length > 24 ? '1rem' : null;
  document.querySelector('.feature-modal-header').classList.toggle('no-title', !title)

  document.querySelector('#feature-size').innerHTML = featureMeta(feature)
  document.querySelector('#feature-vertexes').innerHTML = featureVertexes(feature)
  if (feature.geometry.type === 'Point' || !featureLayer || featureLayer.type !== 'geojson') {
    dom.hideElements('.feature-export')
  } else {
    dom.showElements('.feature-export')
    // set feature id in export links
    let link = document.querySelector('#feature-export-geo a')
    link.setAttribute('href', link.getAttribute('href').replace(/feature\/.*/, 'feature/' + feature.id + '.geojson'))
    if (feature.properties.title) { link.setAttribute('href', link.getAttribute('href')  + '/' + encodeURIComponent(feature.properties.title.replace(/[\s\/]+/g, "_")) + '.geojson') }
    link = document.querySelector('#feature-export-gpx a')
    link.setAttribute('href', link.getAttribute('href').replace(/feature\/.*/, 'feature/' + feature.id + '.gpx'))
    if (feature.properties.title) { link.setAttribute('href', link.getAttribute('href') + '/' + encodeURIComponent(feature.properties.title.replace(/[\s\/]+/g, "_"))) }
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

async function featureDescription (feature) {
  marked.use({ gfm: true, breaks: true })
  let desc = ''
  // show link target if onclick is link
  if (feature?.properties?.onclick === 'link' && feature?.properties?.['onclick-target']) {
    desc = `<p><i class="bi bi-box-arrow-up-right"></i> ${feature.properties['onclick-target']}</p>`
  } else if (feature?.properties?.onclick === 'feature' && feature?.properties?.['onclick-target']) {
    // show feature target if onclick is feature
    desc = `<p><i class="bi bi-geo-alt-fill"></i> ${feature.properties['onclick-target']}</p>`
  } else if (feature?.properties?.wikipediaId) {
    desc = wikipediaFeatureDescription(feature)
  } else {
    // layers can load their description on demand, the modal shows a loading message meanwhile.
    // the search layer is imported here, a static import of it breaks the module init order
    const { searchLayerOf } = await import('maplibre/layers/search')
    const layer = getLayer(feature.id) || searchLayerOf(feature.id)
    const markdown = layer?.description ? await layer.description(feature) : feature?.properties?.desc
    desc = f.sanitizeMarkdown(marked(markdown || ''))
  }
  return desc
}

// A marker image that is drawn on the fly is a name of a map image, not a url, and an
// img tag cannot show it. See maplibre/styles/circle_image.js
const isImageUrl = url => !!url && (url.startsWith('/') || url.startsWith('http'))

// set title image according to feature type
// A long feature list loads its images lazily. A single icon that replaces another one must
// not: a lazy image stays blank until an async viewport check, so it flickers even from cache.
export function featureIcon (feature, { link = true, lazy = true } = {}) {
  let image = ''
  let iconColor = feature.properties['marker-color'] || feature.properties['fill'] || feature.properties['stroke'] || defaults.featureColor
  if (iconColor === 'transparent') { iconColor = '#c0c0c0' }
  let iconColorStyle = `style='color: ${iconColor};'`
  const loading = lazy ? "loading='lazy' " : ''
  if (isImageUrl(feature.properties['marker-image-url'])) {
    const markerImageUrl = feature.properties['marker-image-url']
    const imageHref = markerImageUrl.startsWith('/icon') ? markerImageUrl.replace('/icon', '/image') : markerImageUrl
    const img = `<img ${loading}class='feature-details-icon' src='${markerImageUrl}'>`
    image = link ? `<a target='_blank' href='${imageHref}'>${img}</a>` : img
  } else if (feature.properties['marker-symbol']) {
    const outlineColor = feature.properties['stroke'] || defaults.featureOutlineColor
    image = `<img ${loading}class='feature-details-icon marker-circle' ` +
      `style='background-color: ${iconColor}; border-color: ${outlineColor};' ` +
      "src='" + f.symbolUrl(feature.properties['marker-symbol']) + "'>"
  } else if (feature.properties['stroke-image-url']) {
    image = `<img ${loading}class='feature-details-icon' src='` + feature.properties['stroke-image-url'] + "'>"
  } else if (feature.properties?.route?.profile?.startsWith("cycling-") || feature.properties?.route?.profile === "bike") {
    image = `<i class='bi bi-bicycle fs-3' ${iconColorStyle}></i>`
  } else if (feature.properties?.route?.profile === "driving-car" || feature.properties?.route?.profile === "car") {
    image = `<i class='bi bi-car-front fs-3' ${iconColorStyle}></i>`
  } else if (feature.properties?.route?.profile === "foot") {
    image = `<i class='bi bi-person-walking fs-3' ${iconColorStyle}></i>`
  } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
    image = `<i class='bi bi-signpost fs-3' ${iconColorStyle}></i>`
  } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    image = `<i class='bi bi-bounding-box-circles fs-3' ${iconColorStyle}></i>`
  } else if (feature.geometry.type === "Point") {
    image = `<i class='bi bi-record-circle fs-3' ${iconColorStyle}></i>`
  }
  return image
}

// Marks the button of the shape that the feature uses. No 'marker-shape' means a circle.
export function syncShapeButtons (feature) {
  const shape = feature.properties['marker-shape'] || 'circle'
  document.querySelectorAll('#marker-shape-ui [data-shape]').forEach(button => {
    button.classList.toggle('active', button.dataset.shape === shape)
  })
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

export function getFeatureTypeName(feature) {
  if (!feature?.geometry?.type) { return window.__('Feature') }
  if (feature.geometry.type === 'LineString' && feature.properties?.route?.profile) {
    const profile = feature.properties.route.profile
    if (profile === 'bike' || profile.includes('cycling')) {
      return window.__('Bicycle route')
    }
    if (profile === 'car' || profile.includes('driving')) {
      return window.__('Car route')
    }
    if (profile === 'foot' || profile.includes('foot')) {
      return window.__('Hiking route')
    }
  }
  switch (feature.geometry.type) {
    case 'Point': return window.__('Point')
    case 'LineString': return window.__('Line')
    case 'Polygon': return window.__('Polygon')
    default: return feature.geometry.type
  }
}

// type name plus the feature title, for status messages: "Point 'Cafe'"
export function featureLabel (feature) {
  const title = featureTitle(feature)
  const type = getFeatureTypeName(feature)
  return title ? `${type} '${title}'` : type
}

// move a feature so that its center sits on the given position
export function moveFeatureTo(feature, lngLat) {
  const [ lng, lat ] = center(feature).geometry.coordinates
  coordEach(feature, coord => {
    coord[0] += lngLat.lng - lng
    coord[1] += lngLat.lat - lat
  })
}

export function resetHighlightedFeature () {
  if (highlightedFeatureId && map.getSource(highlightedFeatureSource)) {
    const stateParams = { source: highlightedFeatureSource, id: highlightedFeatureId }
    if (highlightedSourceLayer) {
      stateParams.sourceLayer = highlightedSourceLayer
    }
    map.setFeatureState(stateParams, { active: false })
  }
  if (highlightedFeatureId) {
    highlightedFeatureSource = null
    highlightedFeatureId = null
    highlightedSourceLayer = null
    // drop feature param from url
    const url = new URL(window.location.href)
    if (url.searchParams.get('f')) {
      url.searchParams.delete('f')
      window.history.replaceState({}, document.title, url.toString())
    }
  }
  stickyFeatureHighlight = false
  // Clear layer-specific highlight state
  layers?.forEach(layer => layer.clearHighlight())
  // reset active modals
  f.e('#feature-details-modal', e => { e.classList.remove('show') })
}

// For highlighting features from vector layers, we need to track their sourceLayer.
export function highlightFeature (feature, sticky = false, source, sourceLayer = null) {
  // Only reset if there's a different feature currently highlighted
  if (highlightedFeatureId && highlightedFeatureId !== feature.id) { resetHighlightedFeature() }

  // Close any open modals (settings, layers, share) when initially selecting a feature
  // Don't reset when:
  // - cycling through overlaying features (highlightedFeatureId already set), OR
  // - context menu is currently being shown (right-click interaction)
  const contextMenuVisible = !document.querySelector('#map-context-menu')?.classList.contains('hidden')
  if (!highlightedFeatureId && !contextMenuVisible) {
    resetControls()
  }

  console.log('highlight feature', feature)
  if (!source) { source = getFeatureSource(feature.id) }
  stickyFeatureHighlight = sticky
  highlightedFeatureId = feature?.id
  highlightedFeatureSource = source
  highlightedSourceLayer = sourceLayer
  // load feature from source, the style only returns the dimensions on screen
  const sourceFeature = layers
    .filter(l => Array.isArray(l.geojson?.features))
    .flatMap(layer => layer.geojson.features)
    .find(f => f.id === feature.id)

  showFeatureDetails(sourceFeature || feature)

  // Set feature state for both GeoJSON and vector tile features
  if (feature?.id != null) {
    const stateParams = { source, id: feature.id }
    if (sourceLayer) {
      stateParams.sourceLayer = sourceLayer
    }
    map.setFeatureState(stateParams, { active: true })
  }

  // URL persistence only for GeoJSON features (vector tile IDs are not stable across sessions)
  if (sourceFeature && sticky) {
    const newPath = `${window.location.pathname}?f=${feature.id}${window.location.hash}`
    window.history.pushState({}, '', newPath)
  }
}

export async function uploadImage(image) {
  const formData = new FormData() // send using multipart/form-data
  formData.append('image', image)
  formData.append('map_id', window.gon.map_id)
  dom.showElements('#preloader')
  return fetch('/images', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': window.gon.csrf_token
    }
  })
  .then(async (response) => {
    if (response.ok) {
      return response.json()
    } else {
      // const bodyText = await response.text()
      status(window.__('Error uploading image'), 'error')
      return Promise.reject(response.statusText)
    }
  })
  .finally(() => { dom.hideElements('#preloader') })
}


export async function uploadImageToFeature(image, feature) {
  return uploadImage(image)
    .then(data => {
      console.log('Setting icon: ' + data.icon)
      feature.properties = feature.properties || {}
      feature.properties['marker-image-url'] = data.icon
      feature.properties['stroke'] = 'transparent'
      feature.properties['marker-color'] = 'transparent'
      const desc = feature.properties?.desc
      if (!desc || desc.trim() === '' || desc.trim().startsWith('[![image]')) {
        feature.properties['desc'] = `[![image](${data.image})](${data.image})\n`
      }

      return data
    })
}

export async function confirmImageLocation(file) {
  let tags
  try {
    // Dynamically import ExifReader (https://github.com/mattiasw/ExifReader)
    const ExifReader = (await import('exif-reader'))
    tags = await ExifReader.load(file, { expanded: true, async: true })
  } catch (error) {
    // ExifReader throws on images without metadata and on containers it cannot parse.
    // Mobile uploads hit this often, iOS strips EXIF when a photo comes from the photo picker.
    console.log('No usable EXIF data: ' + error)
    return false
  }
  const gpsLng = tags?.gps?.Longitude, gpsLat = tags?.gps?.Latitude

  if (gpsLng && gpsLat) {
    return new Promise((resolve) => {
      const yesBtn = document.getElementById('confirmation-yes')
      const noBtn = document.getElementById('confirmation-no')

      document.getElementById('confirmation-modal').classList.add('show')
      const cleanup = () => document.getElementById('confirmation-modal').classList.remove('show')

      document.getElementById('confirmation-message').innerHTML =
        window.__('The image contains GPS coordinates (<code>%{coordinates}</code>).<br/>Do you want to place the marker there?')
          .replace('%{coordinates}', `${gpsLat.toFixed(6)}, ${gpsLng.toFixed(6)}`)

      yesBtn.addEventListener("click", () => { cleanup(); resolve([gpsLng, gpsLat]) })
      noBtn.addEventListener("click", () => { cleanup(); resolve(false) })
    })
  } else {
    return Promise.resolve(false)
  }
}