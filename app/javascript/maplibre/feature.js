import { map, geojsonData } from 'maplibre/map'
import * as f from 'helpers/functions'
import * as dom from 'helpers/dom'
import { marked } from 'marked'
import { featureColor } from 'maplibre/styles'

window.marked = marked

export let highlightedFeatureId
export let stickyFeatureHighlight = false
let isDragging = false
let dragStartY, dragStartModalHeight

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
  const turf = window.turf
  let meta = ''
  if (feature.geometry.type === 'LineString') {
    const turfLineString = turf.lineString(feature.geometry.coordinates)
    const length = turf.length(turfLineString)
    if (length <= 2) {
      meta = Math.round(length * 1000) + ' m'
    } else {
      // 2 decimals
      meta = Math.round(length * 100) / 100 + ' km'
    }
  } else if (feature.geometry.type === 'MultiLineString') {
    const turfLineString = turf.multiLineString(feature.geometry.coordinates)
    const length = turf.length(turfLineString)
    if (length <= 2) {
      meta = Math.round(length * 1000) + ' m'
    } else {
      // 2 decimals
      meta = Math.round(length * 100) / 100 + ' km'
    }
  } else if (feature.geometry.type === 'Polygon') {
    const turfPolygon = turf.polygon(feature.geometry.coordinates)
    const area = turf.area(turfPolygon)
    if (area < 100000) {
      meta = area.toFixed(0) + ' m²'
    } else {
      meta = (area / 1000000).toFixed(2) + ' km²'
    }
  } else if (feature.geometry.type === 'MultiPolygon') {
    const turfPolygon = turf.multiPolygon(feature.geometry.coordinates)
    const area = turf.area(turfPolygon)
    if (area < 100000) {
      meta = area.toFixed(0) + ' m²'
    } else {
      meta = (area / 1000000).toFixed(2) + ' km²'
    }
  } else if (feature.geometry.type === 'Point') {
    meta = '(' + feature.geometry.coordinates[1].toFixed(6) +
      ', ' + feature.geometry.coordinates[0].toFixed(6) + ')'
  }
  return meta
}


export function showFeatureDetails (feature) {
  dom.hideElements(['#feature-edit-raw', '#edit-button-raw', '#feature-edit-ui'])
  f.e('#edit-buttons button', (e) => { e.classList.remove('active') })
  dom.showElements('#feature-details-body')
  const modal = document.querySelector('#feature-details-modal')
  modal.classList.remove('expanded')
  modal.classList.add('show')
  modal.scrollTo(0, 0)
  modal.setAttribute('data-map--feature-modal-feature-id-value', feature.id)
  modal.setAttribute('data-map--feature-edit-feature-id-value', feature.id)

  f.addEventListeners(modal, ['mousedown', 'touchstart', 'dragstart'], (event) => {
    if (!f.isTouchDevice()) return
    if (isDragging) return

    isDragging = true
    dragStartY = event.clientY || event.touches[0].clientY
    dragStartModalHeight = modal.offsetHeight
    modal.style.cursor = 'move'
  })

  // Allow to drag up/down modal on touch devices
  f.addEventListeners(modal, ['mousemove', 'touchmove', 'drag'], (event) => {
    if (!isDragging) return

    const dragY = event.clientY || event.touches[0].clientY
    const y = dragY - dragStartY
    modal.classList.remove('modal-pull-up')
    modal.classList.remove('modal-pull-up-half')
    modal.classList.remove('modal-pull-down')
    modal.style.height = (dragStartModalHeight - y) + 'px'
  })

  f.addEventListeners(modal, ['mouseout', 'mouseup', 'touchend'], (_event) => {
    isDragging = false
    modal.style.cursor = 'default'
  })

  document.querySelector('#feature-symbol').innerHTML = featureIcon(feature)
  dom.hideElements('#feature-title-input')
  document.querySelector('#feature-title').innerHTML = featureTitle(feature)
  document.querySelector('#feature-size').innerHTML = featureMeta(feature)
  if (feature.geometry.type === 'Point') {
    dom.hideElements('#feature-export')
  } else {
    dom.showElements('#feature-export')
    // set feature id in export link
    const link = document.querySelector('#feature-export a')
    link.href = link.href.replace(/feature\/.*/, 'feature/' + feature.id)
  }
  const desc = marked(feature?.properties?.desc || '')
  document.querySelector('#feature-details-body').innerHTML = desc
}

// set title image according to feature type
export function featureIcon (feature) {
  let image = ''
  if (feature.properties['marker-image-url']) {
    const imageUrl = feature.properties['marker-image-url'].replace('/icon/', '/image/')
    image = "<a href='" + imageUrl + "' target='_blank'>" +
      "<img class='feature-details-icon' src='" + feature.properties['marker-image-url'] + "'></a>"
  } else if (feature.properties['marker-symbol']) {
    image = "<img class='feature-details-icon' src='/emojis/noto/" + feature.properties['marker-symbol'] + ".png'>"
  } else if (feature.properties?.route?.profile === "cycling-mountain") {
    image = "<i class='bi bi-bicycle me-2 fs-2'>"
  } else if (feature.properties?.route?.profile === "driving-car") {
    image = "<i class='bi bi-car-front me-2 fs-2'>"
  } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiString") {
    image = "<i class='bi bi-signpost me-2 fs-2'>"
  } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    image = "<i class='bi bi-bounding-box-circles me-2 fs-2'>"
  } else if (feature.geometry.type === "Point") {
    image = "<i class='bi bi-cursor me-2 fs-2'>"
  }
  return image
}

export function resetHighlightedFeature (source = 'geojson-source') {
  if (highlightedFeatureId) {
    map.setFeatureState({ source, id: highlightedFeatureId }, { active: false })
    highlightedFeatureId = null
    // drop feature param from url
    const url = new URL(window.location.href)
    url.searchParams.delete('f')
    window.history.replaceState({}, document.title, url.toString())
  }
  // reset active modals
  f.e('#feature-details-modal', e => { e.classList.remove('show') })
}

export function highlightFeature (feature, sticky = false, source = 'geojson-source') {
  if (highlightedFeatureId !== feature.id) { resetHighlightedFeature() }
  if (feature.id) {
    stickyFeatureHighlight = sticky
    highlightedFeatureId = feature.id
    // load feature from source, the style only returns the dimensions on screen
    const sourceFeature = geojsonData.features.find(f => f.id === feature.id)
    if (sourceFeature) {
      showFeatureDetails(sourceFeature)
      // A feature's state is not part of the GeoJSON or vector tile data but can get used in styles
      map.setFeatureState({ source, id: feature.id }, { active: true })
      // set url to feature
      if (sticky) {
        const newPath = `${window.location.pathname}?f=${feature.id}`
        window.history.pushState({}, '', newPath)
      }
    } else {
      console.error('Feature #' + feature.id + ' not found in geojson-source!')
    }
  }
}

// called from map.renderedGeojsonData()
let kmMarkers

export function initializeMarkers () {
  kmMarkers = []

  // hide km markers when zooming out
  map.on('zoom', () => {
    const currentZoom = map.getZoom()
    if (currentZoom < 9) {
      kmMarkers.forEach((m) => {
        if (!m.getElement().classList.contains('km-marker-final')) {
        m.getElement().style.display = 'none'
      }})
    } else {
      kmMarkers.forEach((m) => { m.getElement().style.display = 'block' })
    }
  })
}

export function renderKmMarkers () {
  kmMarkers.forEach((m) => { m.remove() })
  geojsonData.features.filter(feature => (feature.geometry.type === 'LineString' &&
    feature.properties['show-km-markers'])).forEach((f) => {
    const line = turf.lineString(f.geometry.coordinates)
    const length = turf.length(line, { units: 'kilometers' })
    const currentZoom = map.getZoom()
    // Create markers at useful intervals
    let interval = 1
    if (Math.ceil(length) > 15) { interval = 5 }
    if (Math.ceil(length) > 40) { interval = 10 }
    if (Math.ceil(length) > 150) { interval = 50 }
    if (Math.ceil(length) > 500) { interval = 100 }
    if (Math.ceil(length) > 2000) { interval = 500 }
    for (let i = interval; i < Math.ceil(length) + interval; i += interval) {
        // Get point at current kilometer
        const point = turf.along(line, i, { units: 'kilometers' })

        // Create marker element
        const markerDiv = document.createElement('div')
        markerDiv.style.backgroundColor = f.properties['stroke'] || featureColor
        markerDiv.className = 'km-marker'
        if (i >= Math.ceil(length)) {
          markerDiv.className += ' km-marker-final'
          markerDiv.textContent = Math.round(length)
          if (Math.ceil(length) < 100) {
            markerDiv.textContent = Math.round(length * 10) / 10
          }
        } else {
          markerDiv.textContent = `${i}`
          if (currentZoom < 9) { markerDiv.style.display = 'none' }
        }
        if (i >= 100) { markerDiv.style.fontSize = '1em' }
        if (i >= 1000) { markerDiv.style.fontSize = '0.8em' }

        // Add marker to map; https://maplibre.org/maplibre-gl-js/docs/API/classes/Marker/
        let marker = new maplibregl.Marker({
          element: markerDiv,
          opacity: '0.8',
          opacityWhenCovered: '0',
          rotationAlignment: 'viewport',
          pitchAlignment: 'viewport'
          })
        marker.setLngLat([point.geometry.coordinates[0], point.geometry.coordinates[1]])
        kmMarkers.push(marker)
        marker.addTo(map)
    }
  })
}

export function renderExtrusionLines () {
  let extrusionLines = geojsonData.features.filter(feature => (
    feature.geometry.type === 'LineString' &&
      feature.properties['fill-extrusion-height'] &&
      feature.geometry.coordinates.length !== 1 // don't break line animation
  ))

  extrusionLines = extrusionLines.map(feature => {
    const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] * 2 || 4
    const extrusionLine = window.turf.buffer(feature, width, { units: 'meters' })
    // clone properties hash, else we're writing into the original feature's properties
    extrusionLine.properties = { ...feature.properties }
    if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
      extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
    }
    extrusionLine.properties['stroke-width'] = 0
    extrusionLine.properties['stroke-opacity'] = 0
    extrusionLine.properties['fill-opacity'] = 0
    return extrusionLine
  })
  return extrusionLines
}


