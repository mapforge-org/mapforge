import { map, geojsonData, layers, mapProperties } from 'maplibre/map'
import * as f from 'helpers/functions'
import * as dom from 'helpers/dom'
import { marked } from 'marked'
import { featureColor, defaultLineWidth, styles, labelFont } from 'maplibre/styles'
import { showElevationChart } from 'maplibre/feature/elevation'

window.marked = marked

export let highlightedFeatureId
export let highlightedFeatureSource
export let stickyFeatureHighlight = false
let isDragging = false
let dragStartY, dragStartModalHeight
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
  const turf = window.turf
  let meta = ''
  if (feature.geometry.type === 'LineString' && feature.geometry.coordinates.length > 1) {
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

function featureVertexes(feature) {
  let vertexes = ''
  if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString' ||
    feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
    const coords = feature.geometry.coordinates.flat()
    vertexes = ', ' + coords.length + ' points'
  }
 return vertexes
}

export async function showFeatureDetails (feature) {
  dom.hideElements(['#feature-edit-raw', '#feature-edit-ui'])
  f.e('#edit-buttons button', (e) => { e.classList.remove('active') })
  // allow edit in rw mode for geojson features only
  if (window.gon.map_mode === 'rw' && geojsonData.features.find(f => f.id === feature.id)) {
    document.querySelector('#edit-buttons').classList.remove('hidden')
  }
  dom.showElements('#feature-details-body')
  const modal = document.querySelector('#feature-details-modal')
  modal.classList.remove('expanded')
  modal.classList.add('show')
  modal.scrollTo(0, 0)
  modal.setAttribute('data-feature--modal-feature-id-value', feature.id)
  modal.setAttribute('data-feature--edit-feature-id-value', feature.id)

  if (elevationChart) { elevationChart.destroy() }
  elevationChart = await showElevationChart(feature)

  f.addEventListeners(modal, ['mousedown', 'touchstart', 'dragstart'], (event) => {
    if (!f.isTouchDevice()) return
    if (dom.isInputElement(event.target)) return
    // only enable bottom sheet behavior on small screens
    if (window.innerWidth > 574) return

    isDragging = true
    dragStartY = event.clientY || event.touches[0].clientY
    dragStartModalHeight = modal.offsetHeight
    modal.style.cursor = 'move'
  })

  // Allow to drag up/down modal on touch devices
  // Simulating an android bottom sheet behavior
  f.addEventListeners(modal, ['mousemove', 'touchmove', 'drag'], (event) => {
    if (!isDragging) { return }
    if (dom.isInputElement(event.target)) { event.preventDefault(); return }

    const dragY = event.clientY || event.touches[0].clientY
    // y < 0 -> dragging up
    const y = dragY - dragStartY

    // When dragging down, at first scroll up, then lower modal
    if (y < 0 || modal.scrollTop === 0) {
      modal.style.height = (dragStartModalHeight - y) + 'px'
    } else {
      dragStartY = dragY
    }

    // disable scrolling until modal is fully dragged up (#feature-details-modal class)
    const max_height = parseInt(window.getComputedStyle(document.querySelector('.map')).height, 10) - 20
    if (y < 0 && parseInt(modal.style.height, 10) < max_height) {
      event.preventDefault()
    }
  })

  f.addEventListeners(modal, ['mouseout', 'mouseup', 'touchend', 'mouseleave'], (_event) => {
    if (!isDragging) return
    isDragging = false
    modal.style.cursor = 'default'
    const sheetHeight = parseInt(modal.style.height) / window.innerHeight * 100
    if (sheetHeight < 25) {
      modal.classList.remove('show')
      modal.style.removeProperty('height')
    } else if (sheetHeight > 75) {
      modal.style.height = 'calc(100vh - 1rem)'
    }
  })

  f.e('.feature-symbol', e => { e.innerHTML = featureIcon(feature) })
  f.e('.feature-image', e => { e.innerHTML = featureImage(feature) })
  document.querySelector('#feature-title').innerHTML = featureTitle(feature)
  document.querySelector('#feature-size').innerHTML = featureMeta(feature)
  document.querySelector('#feature-vertexes').innerHTML = featureVertexes(feature)
  if (feature.geometry.type === 'Point') {
    dom.hideElements('#feature-export')
  } else {
    dom.showElements('#feature-export')
    // set feature id in export link
    const link = document.querySelector('#feature-export a')
    link.href = link.href.replace(/feature\/.*/, 'feature/' + feature.id)
    if (feature.properties.title) { link.href += '/' + encodeURIComponent(feature.properties.title.replace(/\s+/g, "_")) }
  }
  const desc = marked(feature?.properties?.desc || '')
  document.querySelector('#feature-details-body p').innerHTML = desc
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
  } else if (feature.properties['stroke-image-url']) {
    image = "<img class='feature-details-icon' src='" + feature.properties['stroke-image-url'] + "'>"
  } else if (feature.properties?.route?.profile === "cycling-mountain" || feature.properties?.route?.profile === "bike") {
    image = "<i class='bi bi-bicycle me-2 fs-3'>"
  } else if (feature.properties?.route?.profile === "driving-car" || feature.properties?.route?.profile === "car") {
    image = "<i class='bi bi-car-front me-2 fs-3'>"
  } else if (feature.properties?.route?.profile === "foot") {
    image = "<i class='bi bi-person-walking me-2 fs-3'>"
  } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
    image = "<i class='bi bi-signpost me-2 fs-3'>"
  } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    image = "<i class='bi bi-bounding-box-circles me-2 fs-3'>"
  } else if (feature.geometry.type === "Point") {
    image = "<i class='bi bi-record-circle me-2 fs-3'>"
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

export function highlightFeature (feature, sticky = false, source = 'geojson-source') {
  if (highlightedFeatureId !== feature.id) { resetHighlightedFeature() }
  if (feature.id) {
    // console.log('highlight', feature)
    stickyFeatureHighlight = sticky
    highlightedFeatureId = feature.id
    highlightedFeatureSource = source
    // load feature from source, the style only returns the dimensions on screen
    const sourceFeature = layers
      .filter(l => Array.isArray(l.geojson?.features))
      .flatMap(layer => layer.geojson.features)
      .find(f => f.id === feature.id)

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
      console.error('Feature #' + feature.id + ' not found!')
    }
  }
}

function makePointsLayer(divisor, minzoom, maxzoom = 24) {
  const base = { ...styles()['points-layer'] }
  return {
    ...base,
    id: `km-marker-points-${divisor}`,
    source: 'km-marker-source',
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom
  }
}

function makeNumbersLayer(divisor, minzoom, maxzoom=24) {
  return {
    id: `km-marker-numbers-${divisor}`,
    type: 'symbol',
    source: 'km-marker-source',
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom,
    layout: {
      'text-allow-overlap': true,
      'text-field': ['get', 'km'],
      'text-size': 11,
      'text-font': labelFont,
      'text-justify': 'center',
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ffffff'
    }
  }
}

export function kmMarkerStyles () {
  let layers = []

  // start + end 
  const base = { ...styles()['points-layer'] }
  layers.push( {
    ...base,
    id: `km-marker-points-end`,
      source: 'km-marker-source',
        filter: ["==", ["get", "km-marker-numbers-end"], 1]
  })
  layers.push({
      id: `km-marker-numbers-end`,
      type: 'symbol',
      source: 'km-marker-source',
      filter: ["==", ["get", "km-marker-numbers-end"], 1],
      layout: {
        'text-allow-overlap': true,
        'text-field': ['get', 'km'],
        'text-size': 12,
        'text-font': labelFont,
        'text-justify': 'center',
        'text-anchor': 'center'
      },
      paint: {
        'text-color': '#ffffff'
      }
    })

  layers.push(makePointsLayer(2, 11))
  layers.push(makeNumbersLayer(2, 11))

  layers.push(makePointsLayer(5, 10, 11))
  layers.push(makeNumbersLayer(5, 10, 11))

  layers.push(makePointsLayer(10, 9, 10))
  layers.push(makeNumbersLayer(10, 9, 10))

  layers.push(makePointsLayer(25, 8, 9))
  layers.push(makeNumbersLayer(25, 8, 9))

  layers.push(makePointsLayer(50, 7, 8))
  layers.push(makeNumbersLayer(50, 7, 8))

  layers.push(makePointsLayer(100, 5, 7))
  layers.push(makeNumbersLayer(100, 5, 7))
  return layers
}

export function initializeKmMarkerStyles () {
  kmMarkerStyles().forEach(style => { map.addLayer(style) })
}

export function renderKmMarkers () {
  let kmMarkerFeatures = []
  geojsonData.features.filter(feature => (feature.geometry.type === 'LineString' &&
    feature.properties['show-km-markers'] &&
    feature.geometry.coordinates.length >= 2)).forEach((f) => {

    const line = turf.lineString(f.geometry.coordinates)
    const length = turf.length(line, { units: 'kilometers' })
    // Create markers at useful intervals
    let interval = 1

    for (let i = interval; i < Math.ceil(length) + interval; i += interval) {
      // Get point at current kilometer
      const point = turf.along(line, i, { units: 'kilometers' })
      point.properties['marker-color'] = f.properties['stroke'] || featureColor
      point.properties['marker-size'] = 11
      point.properties['marker-opacity'] = 1

      if (i >= Math.ceil(length)) {
        point.properties['marker-size'] = 14
        point.properties['km'] = Math.round(length)
        point.properties['km-marker-numbers-end'] = 1
        if (Math.ceil(length) < 100) {
          point.properties['km'] = Math.round(length * 10) / 10
        }
      } else {
        point.properties['km'] = i
      }
      kmMarkerFeatures.push(point)
    }
  })

  let markerFeatures = {
        type: 'FeatureCollection',
        features: kmMarkerFeatures
      }
  map.getSource('km-marker-source').setData(markerFeatures)
}

export function renderExtrusionLines () {
  // Disable extrusionlines on 3D terrain, it does not work
  if (mapProperties.terrain) { return [] }

  let extrusionLines = geojsonData.features.filter(feature => (
    feature.geometry.type === 'LineString' &&
      feature.properties['fill-extrusion-height'] &&
      feature.geometry.coordinates.length !== 1 // don't break line animation
  ))

  extrusionLines = extrusionLines.map(feature => {
    const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaultLineWidth
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


