import { along } from "@turf/along"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import { map, removeStyleLayers } from 'maplibre/map'
import { featureColor, labelFont, setSource } from 'maplibre/styles/styles'

function createKmMarkerImage (color) {
  const imageName = `km-marker-circle-${color.replace('#', '')}`

  if (!map.hasImage(imageName)) {
    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 3

    // Draw gray border
    ctx.strokeStyle = '#CCC'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.stroke()

    // Draw filled circle
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - 1, 0, Math.PI * 2)
    ctx.fill()

    map.addImage(imageName, ctx.getImageData(0, 0, size, size))
  }

  return imageName
}

export function renderKmMarkers (features, sourceId) {
  let kmMarkerFeatures = []
  features.filter(feature => (feature.geometry.type === 'LineString' &&
    feature.properties['show-km-markers'] &&
    feature.geometry.coordinates.length >= 2)).forEach((f, index) => {

    const line = lineString(f.geometry.coordinates)
    const distance = length(line, { units: 'kilometers' })
    const markerColor = f.properties['stroke'] || featureColor
    const markerImageName = createKmMarkerImage(markerColor)

    let interval = 1
    for (let i = 0; i < Math.ceil(distance) + interval; i += interval) {
      const point = along(line, i, { units: 'kilometers' })
      point.properties['marker-color'] = markerColor
      point.properties['marker-image'] = markerImageName
      point.properties['marker-size'] = 11
      point.properties['marker-opacity'] = 1
      point.properties['km'] = i

      if (i >= Math.ceil(distance)) {
        point.properties['marker-size'] = 15
        if (distance < 0.1) {
          point.properties['km'] = Math.round(distance * 1000)
          point.properties['km-unit'] = 'm'
        } else if (Math.ceil(distance) < 100) {
          point.properties['km'] = Math.round(distance * 10) / 10
          point.properties['km-unit'] = 'km'
        } else {
          point.properties['km'] = Math.round(distance)
          point.properties['km-unit'] = 'km'
        }
        point.properties['km-marker-numbers-end'] = 1
        point.properties['sort-key'] = 2 + index
      }
      kmMarkerFeatures.push(point)
    }
  })

  const markerFeatures = { type: 'FeatureCollection', features: kmMarkerFeatures }
  map.getSource(sourceId).setData(markerFeatures)
}

export function initializeKmMarkerStyles (sourceId) {
  removeStyleLayers(sourceId)

  kmMarkerStyles().forEach(style => {
    style = setSource(style, sourceId)
    map.addLayer(style)
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
      'text-font': labelFont,
      'text-justify': 'center',
      'text-anchor': 'center',
      'text-line-height': 1.0,
      'text-offset': [0, 0.3],
      'symbol-sort-key': 20
    },
    paint: {
      'text-color': '#ffffff'
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
      'text-font': labelFont,
      'text-justify': 'center',
      'text-anchor': 'center',
      'symbol-sort-key': 10
    },
    paint: {
      'text-color': '#ffffff'
    }
  }
}
