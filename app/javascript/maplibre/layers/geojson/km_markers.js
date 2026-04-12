import { along } from "@turf/along"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import { map, removeStyleLayers } from 'maplibre/map'
import { featureColor, labelFont, setSource, styles } from 'maplibre/styles/styles'

export function renderKmMarkers (features, sourceId) {
  let kmMarkerFeatures = []
  features.filter(feature => (feature.geometry.type === 'LineString' &&
    feature.properties['show-km-markers'] &&
    feature.geometry.coordinates.length >= 2)).forEach((f, index) => {

    const line = lineString(f.geometry.coordinates)
    const distance = length(line, { units: 'kilometers' })
    let interval = 1
    for (let i = 0; i < Math.ceil(distance) + interval; i += interval) {
      const point = along(line, i, { units: 'kilometers' })
      point.properties['marker-color'] = f.properties['stroke'] || featureColor
      point.properties['marker-size'] = 11
      point.properties['marker-opacity'] = 1
      point.properties['km'] = i

      if (i >= Math.ceil(distance)) {
        point.properties['marker-size'] = 15
        point.properties['km'] = Math.round(distance)
        if (Math.ceil(distance) < 100) {
          point.properties['km'] = Math.round(distance * 10) / 10
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

  styleLayers.push(makePointsLayer(1, 14))
  styleLayers.push(makeNumbersLayer(1, 14))
  styleLayers.push(makePointsLayer(2, 11, 14))
  styleLayers.push(makeNumbersLayer(2, 11, 14))
  styleLayers.push(makePointsLayer(5, 10, 11))
  styleLayers.push(makeNumbersLayer(5, 10, 11))
  styleLayers.push(makePointsLayer(10, 9, 10))
  styleLayers.push(makeNumbersLayer(10, 9, 10))
  styleLayers.push(makePointsLayer(25, 8, 9))
  styleLayers.push(makeNumbersLayer(25, 8, 9))
  styleLayers.push(makePointsLayer(50, 7, 8))
  styleLayers.push(makeNumbersLayer(50, 7, 8))
  styleLayers.push(makePointsLayer(100, 5, 7))
  styleLayers.push(makeNumbersLayer(100, 5, 7))

  const base = { ...styles()['points-layer'] }
  styleLayers.push({
    ...base,
    id: `km-marker-points-end`,
    filter: ["==", ["get", "km-marker-numbers-end"], 1]
  })
  styleLayers.push({
    id: `km-marker-numbers-end`,
    type: 'symbol',
    filter: ["==", ["get", "km-marker-numbers-end"], 1],
    layout: {
      'text-allow-overlap': true,
      'text-field': ['format',
        ['get', 'km'], { 'font-scale': 1.0 },
        '\nkm', { 'font-scale': 0.7 }
      ],
      'text-size': 12,
      'text-font': ['noto_sans_bold'],
      'text-justify': 'center',
      'text-anchor': 'center',
      'text-line-height': 1.0,
      'text-offset': [0, 0.3]
    },
    paint: {
      'text-color': '#ffffff'
    }
  })

  return styleLayers
}

function makePointsLayer (divisor, minzoom, maxzoom = 24) {
  const base = { ...styles()['points-layer'] }
  return {
    ...base,
    id: `km-marker-points-${divisor}`,
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom
  }
}

function makeNumbersLayer (divisor, minzoom, maxzoom = 24) {
  return {
    id: `km-marker-numbers-${divisor}`,
    type: 'symbol',
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom,
    layout: {
      'text-allow-overlap': false,
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
