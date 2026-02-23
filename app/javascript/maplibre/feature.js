import { area } from "@turf/area"
import { lineString, multiLineString, multiPolygon, polygon } from "@turf/helpers"
import { length } from "@turf/length"
import * as dom from 'helpers/dom'
import * as f from 'helpers/functions'
import { showElevationChart } from 'maplibre/feature/elevation'
import { getFeature, getFeatureSource, layers } from "maplibre/layers/layers"
import { wikipediaFeatureDescription } from 'maplibre/layers/wikipedia'
import { map } from 'maplibre/map'
import { featureColor } from 'maplibre/styles/styles'
import { marked } from 'marked'

window.marked = marked

export let highlightedFeatureId
export let highlightedFeatureSource
export let stickyFeatureHighlight = false
let elevationChart

function featureTitle (feature) {
  const title = feature?.properties?.title || feature?.properties?.user_title ||
    feature?.properties?.label || feature?.properties?.user_label ||
    feature?.properties?.name || feature?.properties?.user_name
  if (!title || title === '') {
    return ''
  }
  return title
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
    meta = '(' + feature.geometry.coordinates[1].toFixed(6) +
      ', ' + feature.geometry.coordinates[0].toFixed(6) + ')'
  }
  return meta
}

function featureVertexes(feature) {
  let vertexes = ''
  if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString' ||
    feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
    let coords = feature.geometry.coordinates.flat().length
    if (feature.geometry.type === 'Polygon') {
      coords -= 1 // don't count duplicate last point
    }
    vertexes = ', ' + coords + ' points'
  }
 return vertexes
}

export async function showFeatureDetails (feature) {
  dom.hideElements(['#feature-edit-raw', '#feature-edit-ui'])
  f.e('#edit-buttons button', (e) => { e.classList.remove('active') })
  // allow edit in rw mode for geojson features only
  if (window.gon.map_mode === 'rw' && getFeature(feature.id, 'geojson')) {
    document.querySelector('#edit-buttons').classList.remove('hidden')
  }
  dom.showElements('#feature-details-body')
  const modal = document.querySelector('#feature-details-modal')
  modal.classList.remove('modal-pull-down')
  modal.classList.remove('modal-pull-up')
  modal.classList.remove('modal-pull-fade')
  modal.classList.add('modal-pull-middle')
  modal.classList.add('modal-pull-transition')
  // keep custom modal height on selection change
  // modal.style.removeProperty('height')
  modal.classList.add('show')
  modal.scrollTo(0, 0)
  modal.setAttribute('data-feature--modal-feature-id-value', feature.id)
  modal.setAttribute('data-feature--edit-feature-id-value', feature.id)

  if (elevationChart) { elevationChart.destroy() }
  elevationChart = await showElevationChart(feature)

  f.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
  f.e('.feature-image', e => { e.innerHTML = featureImage(feature) })

  const title = featureTitle(feature)
  const titleElement = document.querySelector('#feature-title')
  titleElement.innerHTML = title
  titleElement.style.fontSize = titleElement.textContent.length > 24 ? '1rem' : null;

  document.querySelector('#feature-size').innerHTML = featureMeta(feature)
  document.querySelector('#feature-vertexes').innerHTML = featureVertexes(feature)
  if (feature.geometry.type === 'Point') {
    dom.hideElements('.feature-export')
  } else {
    dom.showElements('.feature-export')
    // set feature id in export links
    let link = document.querySelector('#feature-export-geo a')
    link.href = link.href.replace(/feature\/.*/, 'feature/' + feature.id + '.geojson')
    if (feature.properties.title) { link.href += '/' + encodeURIComponent(feature.properties.title.replace(/[\s\/]+/g, "_")) + '.geojson' }
    link = document.querySelector('#feature-export-gpx a')
    link.href = link.href.replace(/feature\/.*/, 'feature/' + feature.id + '.gpx')
    if (feature.properties.title) { link.href += '/' + encodeURIComponent(feature.properties.title.replace(/[\s\/]+/g, "_")) }
  }

  document.querySelector('#feature-details-description').innerHTML = 'Loading description...'
  featureDescription(feature).then(desc => {
    document.querySelector('#feature-details-description').innerHTML = desc
  })

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
    desc = f.sanitizeMarkdown(marked(feature?.properties?.desc || ''))
  }
  return desc
}

// set title image according to feature type
export function featureIcon (feature) {
  let image = ''
  let iconColor = feature.properties['marker-color'] || feature.properties['fill'] || feature.properties['stroke'] || featureColor
  if (iconColor === 'transparent') { iconColor = '#c0c0c0' }
  let iconColorStyle = `style='color: ${iconColor};'`
  if (feature.properties['marker-image-url']) {
    image = "<img class='feature-details-icon' src='" + feature.properties['marker-image-url'] + "'>"
  } else if (feature.properties['marker-symbol']) {
    image = "<img class='feature-details-icon' src='/emojis/noto/" + feature.properties['marker-symbol'] + ".png'>"
  } else if (feature.properties['stroke-image-url']) {
    image = "<img class='feature-details-icon' src='" + feature.properties['stroke-image-url'] + "'>"
  } else if (feature.properties?.route?.profile === "cycling-mountain" || feature.properties?.route?.profile === "bike") {
    image = `<i class='bi bi-bicycle fs-3' ${iconColorStyle}>`
  } else if (feature.properties?.route?.profile === "driving-car" || feature.properties?.route?.profile === "car") {
    image = `<i class='bi bi-car-front fs-3' ${iconColorStyle}>`
  } else if (feature.properties?.route?.profile === "foot") {
    image = `<i class='bi bi-person-walking fs-3' ${iconColorStyle}>`
  } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
    image = `<i class='bi bi-signpost fs-3' ${iconColorStyle}>`
  } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    image = `<i class='bi bi-bounding-box-circles fs-3' ${iconColorStyle}>`
  } else if (feature.geometry.type === "Point") {
    image = `<i class='bi bi-record-circle fs-3' ${iconColorStyle}></i>`
  }
  return image
}

export function featureImage(feature) {
  let image = ''
  if (feature.properties['marker-image-url']) {
    const imageUrl = feature.properties['marker-image-url'].replace('/icon/', '/image/')
    image = "<a href='" + imageUrl + "' target='_blank'>" +
      "<img class='feature-details-icon' src='" + feature.properties['marker-image-url'] + "'></a>"
  }
  return image
}

export function resetHighlightedFeature () {
  if (highlightedFeatureId) {
    map.setFeatureState({ source: highlightedFeatureSource, id: highlightedFeatureId }, { active: false })
    highlightedFeatureSource = null
    highlightedFeatureId = null
    // drop feature param from url
    const url = new URL(window.location.href)
    if (url.searchParams.get('f')) {
      url.searchParams.delete('f')
      window.history.replaceState({}, document.title, url.toString())
    }
  }
  // reset active modals
  f.e('#feature-details-modal', e => { e.classList.remove('show') })
}

export function highlightFeature (feature, sticky = false, source) {
  if (highlightedFeatureId !== feature.id) { resetHighlightedFeature() }
  // console.log('highlight', feature)
  if (!source) { source = getFeatureSource(feature.id) }
  stickyFeatureHighlight = sticky
  highlightedFeatureId = feature?.id
  highlightedFeatureSource = source
  // load feature from source, the style only returns the dimensions on screen
  const sourceFeature = layers
    .filter(l => Array.isArray(l.geojson?.features))
    .flatMap(layer => layer.geojson.features)
    .find(f => f.id === feature.id)

  showFeatureDetails(sourceFeature || feature)
  if (sourceFeature) {
    // A feature's state is not part of the GeoJSON or vector tile data but can get used in styles
    map.setFeatureState({ source, id: feature.id }, { active: true })
    // set url to feature
    if (sticky) {
      const newPath = `${window.location.pathname}?f=${feature.id}${window.location.hash}`
      window.history.pushState({}, '', newPath)
    }
  }
}

export async function uploadImage(image) {
  const formData = new FormData() // send using multipart/form-data
  formData.append('image', image)
  formData.append('map_id', window.gon.map_id)
  return fetch('/images', {
    method: 'POST',
    body: formData,
    headers: {
      'X-CSRF-Token': window.gon.csrf_token
    }
  })
  .then(response => response.json())
  .catch(error => console.error('Error:', error))
}


export async function uploadImageToFeature(image, feature) {
  return uploadImage(image)
    .then(data => {
      console.log('Setting icon: ' + data.icon)
      feature.properties = feature.properties || {}
      feature.properties['marker-image-url'] = data.icon
      feature.properties['marker-size'] = 20
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
  // Dynamically import ExifReader (https://github.com/mattiasw/ExifReader)
  const ExifReader = (await import('exif-reader'))
  const tags = await ExifReader.load(file || url, { expanded: true, async: true })
  const gpsLng = tags?.gps?.Longitude, gpsLat = tags?.gps?.Latitude

  if (gpsLng && gpsLat) {
    return new Promise((resolve) => {
      const yesBtn = document.getElementById('confirmation-yes')
      const noBtn = document.getElementById('confirmation-no')

      document.getElementById('confirmation-modal').classList.add('show')
      const cleanup = () => document.getElementById('confirmation-modal').classList.remove('show')

      document.getElementById('confirmation-message').innerHTML =
        `The image contains GPS coordinates (<code>${gpsLat.toFixed(6)}, ${gpsLng.toFixed(6)}</code>).<br/>Do you want to place the marker there?`

      yesBtn.addEventListener("click", () => { cleanup(); resolve([gpsLng, gpsLat]) })
      noBtn.addEventListener("click", () => { cleanup(); resolve(false) })
    })
  } else {
    return Promise.resolve(false)
  }
}