import { map, sortLayers } from 'maplibre/map'
import {
  highlightedFeatureId, stickyFeatureHighlight,
  resetHighlightedFeature, highlightFeature
} from 'maplibre/feature'

export const viewStyleNames = [
  'polygon-layer',
  'polygon-layer-outline',
  'line-layer-outline', // line outline below line, because it's a wider line
  'line-layer',
  'line-layer-route-direction',
  'line-layer-hit',
  'points-border-layer',
  'points-layer',
  'points-hit-layer',
  'symbols-border-layer',
  'symbols-layer',
  'text-layer',
  'polygon-layer-extrusion'
]

export function setStyleDefaultFont (font) { labelFont = [font] }

export function initializeViewStyles () {
  viewStyleNames.forEach(styleName => {
    map.addLayer(styles()[styleName])
  })
  sortLayers()
  console.log('View styles added')

  // click is needed to select on mobile and for sticky highlight
  map.on('click', viewStyleNames, function (e) {
    if (!e.features?.length || window.gon.map_mode === 'static') { return }
    highlightFeature(e.features[0], true)
  })

  // highlight features on hover
  map.on('mousemove', (e) => {
    if (window.gon.map_mode === 'static') { return }
    if (stickyFeatureHighlight && highlightedFeatureId) { return }
    if (document.querySelector('.maplibregl-ctrl button.active')) { return }

    const features = map.queryRenderedFeatures(e.point).filter(f => f.source === 'geojson-source')

    if (!features?.length) { resetHighlightedFeature(); return }
    if (features[0].id === highlightedFeatureId) { return }

    highlightFeature(features[0])
  })

  map.on('styleimagemissing', loadImage)
}

// loading images from 'marker-image-url' attributes
export async function loadImage (e) {
  const imageUrl = e.id
  const response = await map.loadImage(imageUrl)
  if (response) {
    if (!map.hasImage(imageUrl)) {
      // console.log('adding ' + imageUrl + ' to map')
      map.addImage(imageUrl, response.data)
    }
  } else {
    console.warn(imageUrl + ' not found')
  }
}

// https://maplibre.org/maplibre-style-spec/layers/
// Expressions: https://maplibre.org/maplibre-style-spec/expressions/
// layout is fixed, paint flexible

// shared styles
// Mapbox.Draw layers prefix user properties with 'user_'

export const featureColor = '#0A870A' // green
export const featureOutlineColor = '#ffffff'

const fillColor = ['coalesce',
  ['get', 'fill'], ['get', 'user_fill'], featureColor]
const fillOpacity = ['to-number', ['coalesce',
  ['get', 'fill-opacity'], ['get', 'user_fill-opacity'], 0.7]]

const lineColor = ['coalesce', ['get', 'stroke'], ['get', 'user_stroke'], featureColor]
const polygonOutlineColor = ['coalesce', ['get', 'stroke'], ['get', 'user_stroke'], featureOutlineColor]
const lineOutlineColor = featureOutlineColor

export const defaultLineWidth = 3
const lineWidthMin = ['ceil', ['/', ['to-number', ['coalesce',
  ['get', 'user_stroke-width'], ['get', 'stroke-width'], defaultLineWidth]], 2]]
const lineWidthMax = ['*', ['to-number', ['coalesce',
  ['get', 'user_stroke-width'], ['get', 'stroke-width'], defaultLineWidth]], 2]
const outlineWidthPolygon = ['to-number', ['coalesce',
  ['get', 'user_stroke-width'], ['get', 'stroke-width'], 2]]
const lineWidth = [
  'interpolate',
  ['linear'],
  ['zoom'],
  8, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, lineWidthMin],
    lineWidthMin
  ], // At zoom level 8, the line width is min
  17, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, lineWidthMax],
    lineWidthMax
  ] // At zoom level 13, the line width is max
]

const lineOpacity = ['to-number', ['coalesce',
  ['get', 'stroke-opacity'], ['get', 'user_stroke-opacity'], 0.8]]
const lineOpacityActive = 1

const outlineWidthMin = ['+', 2, lineWidthMin]
const outlineWidthMax = ['+', 4, lineWidthMax]
const outlineWidth = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, outlineWidthMin],
    outlineWidthMin
  ], // At zoom level 8, the outline width is min
  17, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, outlineWidthMax],
    outlineWidthMax
  ] // At zoom level 13, the outline width is max
]

const pointColor = ['coalesce', ['get', 'user_marker-color'], ['get', 'marker-color'],
  ['case',
    ['any', ['has', 'user_marker-symbol'], ['has', 'marker-symbol']],
    'white', featureColor]]
const pointSizeMin = ['to-number', ['coalesce',
  ['get', 'user_marker-size'], ['get', 'marker-size'],
  ['case',
    ['any', ['has', 'user_marker-symbol'], ['has', 'marker-symbol']],
    10, 3]]]
export const pointSizeMax = ['to-number', ['coalesce',
  ['get', 'user_marker-size'], ['get', 'marker-size'],
  ['case',
    ['any', ['has', 'user_marker-symbol'], ['has', 'marker-symbol']],
    24, 8]]]
export const pointSize = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, pointSizeMin],
    pointSizeMin
  ], // At zoom level 8, the point size is min
  17, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, pointSizeMax],
    pointSizeMax
  ] // At zoom level 13, the point size is max
]

export const pointOutlineSize = ['to-number', ['coalesce', ['get', 'user_stroke-width'], ['get', 'stroke-width'], 2]]
export const pointOutlineSizeActive = ['+', 1, pointOutlineSize]
const pointOutlineColor = ['coalesce', ['get', 'user_stroke'], ['get', 'stroke'], featureOutlineColor]
const pointOpacity = 0.7
const pointOpacityActive = 0.9

// factor of the original icon size (200x200)
// in case of external icon url, we don't know the size
const iconSize = ['*', 1 / 70, pointSizeMax]
// const iconSizeActive = ['*', 1.1, iconSize] // icon-size is not a paint property
const labelSize = ['to-number', ['coalesce', ['get', 'user_label-size'], ['get', 'label-size'], 16]]
// default font is set in basemap def basemaps[backgroundMapLayer]['font']
let labelFont

export function styles () {
  return {
    'polygon-layer': {
      id: 'polygon-layer',
      type: 'fill',
      source: 'geojson-source',
      filter: ['all',
        ['in', '$type', 'Polygon']],
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity
      }
    },
    'polygon-layer-extrusion': {
      id: 'polygon-layer-extrusion',
      type: 'fill-extrusion',
      source: 'geojson-source',
      filter: ['all',
        ['in', '$type', 'Polygon'],
        ['>', 'fill-extrusion-height', 0]],
      paint: {
        'fill-extrusion-color': ['coalesce',
            ['get', 'fill-extrusion-color'],
            ['get', 'user_fill-extrusion-color'],
            ['get', 'fill'],
            ['get', 'user_fill'], featureColor],
        'fill-extrusion-height': ['to-number', ['coalesce',
          ['get', 'fill-extrusion-height'],
          ['get', 'user_fill-extrusion-height']]],
        'fill-extrusion-base': ['to-number', ['coalesce',
          ['get', 'fill-extrusion-base'],
          ['get', 'user_fill-extrusion-base']]],
        // opacity does not support data expressions!?!
        'fill-extrusion-opacity': 0.7
      }
    },
    // polygon outlines
    'polygon-layer-outline': {
      id: 'polygon-layer-outline',
      type: 'line',
      source: 'geojson-source',
      filter: ['all',
        ['in', '$type', 'Polygon']],
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': [
          'case', ['boolean', ['feature-state', 'active'], false],
          '#000', polygonOutlineColor
        ],
        'line-width': [
          'case', ['boolean', ['feature-state', 'active'], false],
          ['+', outlineWidthPolygon, 2], outlineWidthPolygon
        ],
        'line-opacity': lineOpacity
      }
    },
    // line outlines
    'line-layer-outline': {
      id: 'line-layer-outline',
      type: 'line',
      source: 'geojson-source',
      filter: ['all',
        ['in', '$type', 'LineString']],
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': [
          'case', ['boolean', ['feature-state', 'active'], false],
          '#000', lineOutlineColor
        ],
        'line-width': outlineWidth,
        'line-opacity': lineOpacity
      }
    },
    // lines
    'line-layer': {
      id: 'line-layer',
      type: 'line',
      source: 'geojson-source',
      filter: ['all',
        ['in', '$type', 'LineString']],
      layout: {
        'line-join': 'round',
        'line-cap': 'butt'
      },
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': [
          'case', ['boolean', ['feature-state', 'active'], false],
          lineOpacityActive, lineOpacity
        ]
      }
    },
    'line-layer-hit': {
      id: 'line-layer-hit',
      type: 'line',
      source: 'geojson-source',
      filter: ['all',
        ['in', '$type', 'LineString']],
      paint: {
        'line-width': ['+', 15, outlineWidthMax],
        'line-opacity': 0
      }
    },
    'line-layer-route-direction': {
      id: "line-layer-route-direction",
      type: "symbol",
      source: "geojson-source",
      filter: ["has", "route"],
      layout: {
        "symbol-placement": "line-center",
        "icon-image": "/icons/direction-arrow.png",
        "icon-size": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.85, 18, 1.4],
      },
      paint: {
        "icon-opacity": 0.9,
      }
    },
    'points-border-layer': {
      id: 'points-border-layer',
      type: 'circle',
      source: 'geojson-source',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['!=', 'meta', 'midpoint'],
        ['!=', 'meta', 'vertex'],
        ['none', ['has', 'user_marker-image-url'], ['has', 'marker-image-url'],
          ['has', 'user_marker-symbol'], ['has', 'marker-symbol']]
      ],
      paint: {
        'circle-pitch-scale': 'map', // points get bigger when camera is closer
        'circle-radius': pointSize,
        'circle-opacity': 0,
        'circle-stroke-color': pointOutlineColor,
        'circle-blur': 0.1,
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'active'], false],
          pointOutlineSizeActive,
          pointOutlineSize
        ],
        'circle-stroke-opacity': pointOpacity + 0.2
      }
    },
    'points-layer': {
      id: 'points-layer',
      type: 'circle',
      source: 'geojson-source',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['!=', 'meta', 'midpoint'],
        ['!=', 'meta', 'vertex'],
        ['none', ['has', 'user_marker-image-url'], ['has', 'marker-image-url'],
          ['has', 'user_marker-symbol'], ['has', 'marker-symbol']]
      ],
      paint: {
        'circle-pitch-scale': 'map', // points get bigger when camera is closer
        'circle-radius': pointSize,
        'circle-color': pointColor,
        'circle-opacity': [
          'match',
          ['coalesce', ['get', 'user_marker-color'], ['get', 'marker-color']],
          'transparent', 0, // If marker-color is 'transparent', set circle-opacity to 0
          [
            'case',
            ['boolean', ['feature-state', 'active'], false],
            pointOpacityActive,
            pointOpacity
          ]],
        'circle-blur': 0.05
      }
    },
    'points-hit-layer': {
      id: 'points-hit-layer',
      type: 'circle',
      source: 'geojson-source',
      filter: ['all',
        ['==', '$type', 'Point']
      ],
      paint: {
        'circle-radius': ['+', 5, pointSizeMax],
        'circle-opacity': 0
      }
    },
    // background + border for symbols
    'symbols-border-layer': {
      id: 'symbols-border-layer',
      type: 'circle',
      source: 'geojson-source',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['!=', 'meta', 'midpoint'],
        ['!=', 'meta', 'vertex'],
        ['any', ['has', 'user_marker-image-url'], ['has', 'marker-image-url'],
          ['has', 'user_marker-symbol'], ['has', 'marker-symbol']]
      ],
      paint: {
        'circle-pitch-scale': 'map',
        'circle-radius': pointSize,
        'circle-color': pointColor,
        'circle-opacity': [
          'match',
          ['coalesce', ['get', 'user_marker-color'], ['get', 'marker-color']],
          'transparent', 0, // If marker-color is 'transparent', set circle-radius to 0
          [
            'case',
            ['boolean', ['feature-state', 'active'], false],
            0.7,
            0.5
          ]],
        'circle-stroke-color': pointOutlineColor,
        'circle-blur': 0.05,
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'active'], false],
          pointOutlineSizeActive,
          pointOutlineSize
        ],
        'circle-stroke-opacity': pointOpacity
      }
    },
    // support symbols on all feature types
    'symbols-layer': {
      id: 'symbols-layer',
      type: 'symbol',
      source: 'geojson-source',
      filter: ['all',
        ['any', ['has', 'user_marker-image-url'], ['has', 'marker-image-url'],
          ['has', 'user_marker-symbol'], ['has', 'marker-symbol']]
      ],
      // minzoom: 15, // TODO: only static values possible right now
      layout: {
        'symbol-sort-key': ['to-number', ['coalesce', ['get', 'user_sort-key'], ['get', 'sort-key'], 1]],
        'icon-image': ['coalesce',
          ['get', 'marker-image-url'],
          // replacing marker-symbol value with path to emoji png
          ['case',
            ['has', 'marker-symbol'],
            ['concat', '/emojis/noto/', ['get', 'marker-symbol'], '.png'],
            '']
        ],
        'icon-size': iconSize, // cannot scale on hover/zoom because it's not a paint property
        'icon-overlap': 'always' // https://maplibre.org/maplibre-style-spec/layers/#icon-overlap
      // 'icon-ignore-placement': true // other symbols can be visible even if they collide with the icon
      },
      paint: {
        // circle-pitch-scale: 'map' // seems default and cannot get changed
        // cannot set circle-pitch-scale, circle-stroke-* in the symbol layer :-(
      }
    },
    'text-layer': {
      id: 'text-layer',
      type: 'symbol',
      source: 'geojson-source',
      filter: ['has', 'label'],
      layout: {
        'icon-overlap': 'never',
        'text-field': ['coalesce', ['get', 'label'], ['get', 'room']],
        'text-size': labelSize,
        'text-font': labelFont,
        // arrange text to avoid collision
        'text-variable-anchor': ['top'], // text under point
        // distance of the text in 'em'
        'text-radial-offset': ['+', ['/', pointSizeMax, 14], 0.4],
        'text-justify': 'auto',
        'text-ignore-placement': false, // hide on collision
        // TODO: sort keys on text are ascending, on symbols descending???
        'symbol-sort-key': ['-', 1000, ['to-number', ['coalesce', ['get', 'user_sort-key'], ['get', 'sort-key'], 1]]]
      },
      paint: {
        'text-color': ['coalesce', ['get', 'user_label-color'], ['get', 'label-color'], '#000'],
        'text-halo-color': ['coalesce', ['get', 'user_label-shadow'], ['get', 'label-shadow'], '#fff'],
        'text-halo-width': 1
      }
    }
  }
}
