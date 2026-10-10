import { bearing } from "@turf/bearing"
import { destination } from "@turf/destination"
import { distance as segmentDistance } from "@turf/distance"
import { point as turfPoint } from "@turf/helpers"
import { withLevelFilter } from 'maplibre/controls/levels'
import { addLayer, map, noValidate, removeStyleLayers } from 'maplibre/map'
import { circleImage, pruneCircleImages } from 'maplibre/styles/circle_image'
import { defaults } from 'maplibre/styles/defaults'
import { setSource } from 'maplibre/styles/styles'

// The source id is part of the image name so that one layer's render never evicts another's
const imagePrefix = (sourceId) => `km-marker-circle-${sourceId}`

// Label color with contrast to the line color
function kmMarkerTextColor (color) {
  const hex = /^#(\w\w)(\w\w)(\w\w)$/.exec(color)
  if (!hex) { return '#ffffff' }
  const [ r, g, b ] = hex.slice(1).map(c => parseInt(c, 16))
  return r * 0.299 + g * 0.587 + b * 0.114 > 140 ? '#000000' : '#ffffff'
}

// The total distance on the end marker: meters below 100 m, one decimal below 100 km
function endDistance (distance) {
  if (distance < 0.1) { return { km: Math.round(distance * 1000), unit: 'm' } }
  if (Math.ceil(distance) < 100) { return { km: Math.round(distance * 10) / 10, unit: 'km' } }
  return { km: Math.round(distance), unit: 'km' }
}

// An animation moves the end of its line on every update. As a map label, the end marker would
// count as a new label each time, and maplibre places new labels only every fadeDuration, so it
// blinked. An html marker stands in for it until the animation ends.
const movingEnds = new Map()

export function showMovingEndMarker (feature, lngLat, distance) {
  let marker = movingEnds.get(feature.id)
  if (!marker) {
    const color = feature.properties['stroke'] || defaults.featureColor
    const el = document.createElement('div')
    el.className = 'km-marker-moving-end'
    el.style.backgroundColor = color
    el.style.color = kmMarkerTextColor(color)
    el.append(document.createElement('span'), document.createElement('small'))
    marker = new window.maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map)
    movingEnds.set(feature.id, marker)
  }
  const { km, unit } = endDistance(distance)
  const [value, unitLabel] = marker.getElement().children
  value.textContent = km
  unitLabel.textContent = unit
  marker.setLngLat(lngLat)
}

// The end marker label shows up only once maplibre placed it, so the html marker covers the
// gap until the map is idle
export function removeMovingEndMarker (feature) {
  const marker = movingEnds.get(feature.id)
  movingEnds.delete(feature.id)
  if (marker) { map.once('idle', () => marker.remove()) }
}

// A removed layer renders no km markers again, so its images go with it.
export function cleanupKmMarkerImages (sourceId) {
  pruneCircleImages(imagePrefix(sourceId))
}

// Whether a feature currently contributes km markers, i.e. needs renderKmMarkers to run.
export function hasKmMarkers (feature) {
  return feature.geometry.type === 'LineString' &&
    !!feature.properties['show-km-markers'] &&
    feature.geometry.coordinates.length >= 2
}

// One pass over the line. turf along() per km walks the line from its start each time, which
// blocked the main thread for seconds (and dropped the websocket) on long GPS tracks.
function walkKilometers (coords) {
  const kmPoints = []
  let travelled = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const segment = segmentDistance(coords[i], coords[i + 1], { units: 'kilometers' })
    while (kmPoints.length <= travelled + segment) {
      const direction = bearing(coords[i], coords[i + 1])
      kmPoints.push(destination(coords[i], kmPoints.length - travelled, direction, { units: 'kilometers' }))
    }
    travelled += segment
  }
  return { distance: travelled, kmPoints }
}

export function renderKmMarkers (features, sourceId) {
  let kmMarkerFeatures = []
  const imageNames = new Set()
  features.filter(hasKmMarkers).forEach((f, index) => {

    const coords = f.geometry.coordinates
    const { distance, kmPoints } = walkKilometers(coords)
    const markerColor = f.properties['stroke'] || defaults.featureColor
    const markerImageName = circleImage(imagePrefix(sourceId), markerColor)
    imageNames.add(markerImageName)

    // a moving end has its html marker instead
    const last = movingEnds.has(f.id) ? Math.ceil(distance) - 1 : Math.ceil(distance)
    for (let i = 0; i <= last; i++) {
      const point = i < Math.ceil(distance) ? kmPoints[i] : turfPoint(coords[coords.length - 1])
      point.properties['marker-color'] = markerColor
      point.properties['marker-image'] = markerImageName
      point.properties['km-text-color'] = kmMarkerTextColor(markerColor)
      point.properties['marker-size'] = 11
      point.properties['marker-opacity'] = 1
      point.properties['km'] = i
      point.properties['feature-order'] = index
      if ('level' in f.properties) point.properties.level = f.properties.level

      if (i >= Math.ceil(distance)) {
        const { km, unit } = endDistance(distance)
        point.properties['marker-size'] = 15
        point.properties['km'] = km
        point.properties['km-unit'] = unit
        point.properties['km-marker-numbers-end'] = 1
      }
      kmMarkerFeatures.push(point)
    }
  })

  const markerFeatures = { type: 'FeatureCollection', features: kmMarkerFeatures }
  map.getSource(sourceId).setData(markerFeatures)
  pruneCircleImages(imagePrefix(sourceId), imageNames)
}

export function initializeKmMarkerStyles (sourceId) {
  removeStyleLayers(sourceId)

  kmMarkerStyles().forEach(style => {
    style = setSource({ ...style, filter: withLevelFilter(style.filter) }, sourceId)
    addLayer(style)
  })
}

// Re-applies the current level filter to already-added km-marker style layers, without
// rebuilding the companion source (see GeoJSONLayer.applyLevelFilter).
export function applyLevelFilter (sourceId) {
  kmMarkerStyles().forEach(style => {
    const layerId = `${style.id}_${sourceId}`
    if (map.getLayer(layerId)) { map.setFilter(layerId, withLevelFilter(style.filter), noValidate) }
  })
}

function kmMarkerStyles () {
  let styleLayers = []

  // Combined marker layers (icon + text in one symbol layer)
  styleLayers.push(makeKmMarkerLayer(1, 14))
  styleLayers.push(makeKmMarkerLayer(2, 12, 14))
  styleLayers.push(makeKmMarkerLayer(5, 10, 12))
  styleLayers.push(makeKmMarkerLayer(10, 9, 10))
  styleLayers.push(makeKmMarkerLayer(25, 8, 9))
  styleLayers.push(makeKmMarkerLayer(50, 7, 8))
  styleLayers.push(makeKmMarkerLayer(100, 5, 7))

  // End marker (total distance) - combined icon + text
  styleLayers.push({
    id: `km-marker-end`,
    type: 'symbol',
    filter: ["==", ["get", "km-marker-numbers-end"], 1],
    layout: {
      'icon-image': ['get', 'marker-image'],
      'icon-size': ['/', ['get', 'marker-size'], 14],
      'icon-allow-overlap': false,
      'icon-padding': 0,
      'text-allow-overlap': false,
      'text-padding': 0,
      'text-field': ['format',
        ['get', 'km'], { 'font-scale': 1.0 },
        ['concat', '\n', ['get', 'km-unit']], { 'font-scale': 0.7 }
      ],
      'text-size': 12,
      'text-font': [defaults.font],
      'text-justify': 'center',
      'text-anchor': 'center',
      'text-line-height': 1.0,
      'text-offset': [0, 0.3],
      // Negate feature-order so selected feature (higher index) gets lower sort-key and renders on top
      'symbol-sort-key': ['-', 0, ['*', ['get', 'feature-order'], 100]]
    },
    paint: {
      'text-color': ['coalesce', ['get', 'km-text-color'], '#ffffff']
    }
  })

  return styleLayers
}

function makeKmMarkerLayer (divisor, minzoom, maxzoom = 24) {
  return {
    id: `km-marker-${divisor}`,
    type: 'symbol',
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom,
    layout: {
      'icon-image': ['get', 'marker-image'],
      'icon-size': ['/', ['get', 'marker-size'], 14],
      'icon-allow-overlap': false,
      'icon-padding': 0,
      'text-allow-overlap': false,
      'text-padding': 0,
      'text-field': ['get', 'km'],
      'text-size': 11,
      'text-font': [defaults.font],
      'text-justify': 'center',
      'text-anchor': 'center',
      // Negate feature-order so selected feature (higher index) gets lower sort-key and renders on top
      'symbol-sort-key': ['-', 10, ['*', ['get', 'feature-order'], 100]]
    },
    paint: {
      'text-color': ['coalesce', ['get', 'km-text-color'], '#ffffff']
    }
  }
}
