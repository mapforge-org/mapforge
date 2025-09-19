import { map, frontFeature, removeStyleLayers } from 'maplibre/map'
import {
  highlightedFeatureId, stickyFeatureHighlight, highlightedFeatureSource,
  resetHighlightedFeature, highlightFeature
} from 'maplibre/feature'

export const viewStyleNames = [
  'polygon-layer',
  'polygon-layer-outline',
  'line-layer-outline', // line outline below line, because it's a wider line
  'line-layer',
  'line-label-symbol',
  'line-layer-hit',
  'line-labels',
  'points-layer',
  'points-hit-layer',
  'heatmap-layer',
  'symbols-border-layer',
  'symbols-layer',
  'text-layer',
  'polygon-layer-extrusion'
]

export function setStyleDefaultFont (font) { labelFont = [font] }

export function initializeViewStyles (sourceName) {
  removeStyleLayers(sourceName)
  viewStyleNames.forEach(styleName => {
    map.addLayer(setSource(styles()[styleName], sourceName))
  })
  // console.log('View styles added for source ' + sourceName)

  // click is needed to select on mobile and for sticky highlight
  map.on('click', styleNames(sourceName), function (e) {
    if (!e.features?.length || window.gon.map_mode === 'static') { return }
    if (e.features[0].properties.cluster) { return } 
    frontFeature(e.features[0])
    highlightFeature(e.features[0], true, sourceName)
  })

  // highlight features on hover
  if (window.gon.map_mode !== 'rw') { 
    map.on('mousemove', (e) => {
      if (window.gon.map_mode === 'static') { return }
      if (stickyFeatureHighlight && highlightedFeatureId) { return }
      // This avoids hover highlight in edit mode
      if (document.querySelector('.maplibregl-ctrl button.active')) { return }

      const features = map.queryRenderedFeatures(e.point).filter(f => f.source === sourceName)
      if (features[0]) {
        if (features[0].properties.cluster) { return } 
        if (features[0].id === highlightedFeatureId) { return }
        frontFeature(features[0])
        highlightFeature(features[0], false, sourceName)
      } else if (highlightedFeatureSource === sourceName) {
        resetHighlightedFeature()
      }
    })
  }

  map.on('styleimagemissing', loadImage)
}

export function initializeClusterStyles(sourceName, icon) {
  clusterStyles(icon).forEach(style => {
    map.addLayer(setSource(style, sourceName))
  })

  // zoom into cluster on click
  map.on('click', ['cluster_circles_' + sourceName, 'cluster_labels_' + sourceName], async function (e) {
    if (!e.features?.length || window.gon.map_mode === 'static') { return }
    const center = e.features[0].geometry.coordinates
    const clusterId = e.features[0].properties.cluster_id
    const zoom = await map.getSource(sourceName).getClusterExpansionZoom(clusterId)
    map.easeTo({ center: center, zoom: zoom })
  })
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
export const featureOutlineColor = '#cfcfcf'

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
// This is the default size for zoom=16. With each zoom level the size doubles when marker-scaling=true
export const iconSizeDefault = ['*', 1 / 60, pointSizeMax]
export const iconSizeMin = ['case',
  ['boolean', ['coalesce', ['get', 'user_marker-scaling'], ['get', 'marker-scaling']], false],
  0, iconSizeDefault]
export const iconSizeMax = ['case',
  ['boolean', ['coalesce', ['get', 'user_marker-scaling'], ['get', 'marker-scaling']], false],
  ['*', 16, iconSizeDefault], iconSizeDefault]

const iconSize = [
      'interpolate',
      ["exponential", 2],
      ['zoom'],
      0, iconSizeMin,
      16, iconSizeDefault,
      21, iconSizeMax
    ]

// const iconSizeActive = ['*', 1.1, iconSize] // icon-size is not a paint property
// This is the default size for zoom=16. With each zoom level the size doubles when marker-scaling=true
const labelFontSize = ['to-number', ['coalesce', ['get', 'user_label-size'], ['get', 'label-size'], 16]]
export const labelFontSizeMin = ['case',
  ['boolean', ['coalesce', ['get', 'user_marker-scaling'], ['get', 'marker-scaling']], false],
  0, labelFontSize]
export const labelFontSizeMax = ['case',
  ['boolean', ['coalesce', ['get', 'user_marker-scaling'], ['get', 'marker-scaling']], false],
  ['*', 16, labelFontSize], labelFontSize]

const labelSize = [
  'interpolate',
  ["exponential", 2],
  ['zoom'],
  0, labelFontSizeMin, // At zoom 0
  16, labelFontSize,
  21, labelFontSizeMax
]

// default font is set in basemap def basemaps[backgroundMapLayer]['font']
export let labelFont

export function styles () {
  return {
    'polygon-layer': {
      id: 'polygon-layer',
      type: 'fill',
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
        'fill-extrusion-opacity': 0.9
      }
    },
    // polygon outlines
    'polygon-layer-outline': {
      id: 'polygon-layer-outline',
      type: 'line',
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
      filter: ['all',
        ['in', '$type', 'LineString']],
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
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
      filter: ['all',
        ['in', '$type', 'LineString']],
      paint: {
        'line-width': ['+', 10, outlineWidthMax],
        'line-opacity': 0 // cannot use visibility:none here
      }
    },
    'points-layer': {
      id: 'points-layer',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['!=', 'meta', 'midpoint'],
        ['!=', 'meta', 'vertex'],
        ['none', ['has', 'user_marker-image-url'], ['has', 'marker-image-url'],
          ['has', 'user_marker-symbol'], ['has', 'marker-symbol'], ['has', 'point_count']]
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
        'circle-blur': 0.05,
        'circle-stroke-color': pointOutlineColor,
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'active'], false],
          pointOutlineSizeActive,
          pointOutlineSize
        ],
        'circle-stroke-opacity': pointOpacity + 0.2
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
    'heatmap-layer': {
      id: 'heatmap-layer',
      type: 'heatmap',
      filter: ['any',
        ["has", "heatmap"],
        ["has", "user_heatmap"]],
      paint: {
        'heatmap-opacity': 0.7,
        'heatmap-intensity': 1.3,
        'heatmap-radius': 17
      }
    },
    // background + border for symbols
    'symbols-border-layer': {
      id: 'symbols-border-layer',
      type: 'circle',
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
        'icon-size': iconSize,
        'icon-overlap': 'always', // https://maplibre.org/maplibre-style-spec/layers/#icon-overlap
        "icon-rotation-alignment": "viewport", // TODO: data expressions not allowed here :-(
        // 'icon-ignore-placement': true // other symbols can be visible even if they collide with the icon
      },
      paint: {
        // circle-pitch-scale: 'map' // seems default and cannot get changed
        // cannot set circle-pitch-scale, circle-stroke-* in the symbol layer :-(
      }
    },
    // Line labels sometimes get rendered wrong when line is extruded
    'line-labels': {
      id: 'line-labels',
      type: 'symbol',
      filter: ['all',
        ['in', '$type', 'LineString'],
        ['has', 'label']],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['coalesce', ['get', 'user_label'], ['get', 'label']],
        'text-font': labelFont,
        'text-size': 14,
        'text-max-angle': 30,
        'symbol-spacing': 200
      },
      paint: {
        'text-color': ['coalesce', ['get', 'user_label-color'], ['get', 'label-color'], '#000'],
        'text-halo-color': ['coalesce', ['get', 'user_label-shadow'], ['get', 'label-shadow'], '#fff'],
        'text-halo-width': 2
      }
    },
    'line-label-symbol': {
      id: "line-label-symbol",
      type: "symbol",
      filter: ['all',
        ['==', '$type', 'LineString'],
        // Line symbols don't work in combination with extrusion
        ['none', ['>', 'fill-extrusion-height', 0], ['>', 'user_fill-extrusion-height', 0]],
        ['any',
          ["has", "stroke-image-url"],
          ["has", "stroke-symbol"]
        ]],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 100, // distance in pixels, only works with 'line'
        'icon-image': ['coalesce',
          ['get', 'stroke-image-url'],
          // replacing stroke-symbol value with path to emoji png
          ['case',
            ['has', 'stroke-symbol'],
            ['concat', '/emojis/noto/', ['get', 'stroke-symbol'], '.png'],
            '']],
        "icon-size": ["interpolate", ["exponential", 1.5], ["zoom"], 12, 0.85, 18, 1.4],
        "icon-rotation-alignment": "viewport", // TODO: data expressions not allowed here :-(
        "icon-size": ['case', ['has', 'stroke-symbol'], 0.35, 1]
      },
      paint: {
        "icon-opacity": 1
      }
    },
    'text-layer': {
      id: 'text-layer',
      type: 'symbol',
      filter: ['all',
        ['!=', '$type', 'LineString'],
        ['has', 'label']],
      layout: {
        'icon-overlap': 'never',
        'text-field': ['coalesce', ['get', 'label'], ['get', 'room']],
        'text-size': labelSize,
        'text-font': labelFont,
        // arrange text to avoid collision
        'text-variable-anchor': ['top'], // text under point
        // distance of the text in 'em'
        // TODO: set this to 0 for polygons, needs 'geometry-type' implementation: https://github.com/maplibre/maplibre-style-spec/discussions/536
        "text-radial-offset": ['+', ['/', pointSizeMax, 14], 0.4],
        'text-justify': 'auto',
        'text-ignore-placement': false, // hide on collision
        "icon-rotation-alignment": "viewport", // TODO: data expressions not allowed here :-(
        // TODO: sort keys on text are ascending, on symbols descending???
        'symbol-sort-key': ['-', 1000, ['to-number', ['coalesce', ['get', 'user_sort-key'], ['get', 'sort-key'], 1]]]
      },
      paint: {
        'text-color': ['coalesce', ['get', 'user_label-color'], ['get', 'label-color'], '#000'],
        'text-halo-color': ['coalesce', ['get', 'user_label-shadow'], ['get', 'label-shadow'], '#fff'],
        'text-halo-width': 2
      }
    }
  }
}

export function clusterStyles(icon) {
  let icon_image = '/emojis/noto/' + icon + '.png'
  if (icon?.includes('/')) { icon_image = icon }

  // background when no cluster icon is provided
  const clusterPoints = {
      id: 'cluster_points',
      type: 'circle',
      filter: ['has', 'point_count'],
      paint: {
        'circle-pitch-scale': 'map', // points get bigger when camera is closer
        'circle-radius': 12,
        'circle-color': pointColor,
        'circle-blur': 0.05,
        'circle-stroke-color': pointOutlineColor,
        'circle-stroke-width': pointOutlineSize,
        'circle-stroke-opacity': pointOpacity + 0.2
      }
    }
    
  const clusterCircles = {
      id: 'cluster_circles',
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': (icon ? icon_image : ''),
        'icon-size': 0.5,
        'icon-overlap': 'always'
      }
    }

  const clusterLabels = {
      'id': 'cluster_labels',
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': labelFont,
        'text-size': 15
      },
      paint: {
        'text-color': '#000',
        'text-halo-color': '#fff',
        'text-halo-width': 2
      }
    }

  return [...(!icon ? [clusterPoints] : []), ...(icon ? [clusterCircles] : []), clusterLabels ]
}

export function setSource (style, sourceName) {
  return { ...style, source: sourceName, id: style.id + '_' + sourceName }
}

function styleNames (sourceName) {
  return viewStyleNames.map(styleName => styleName + '_' + sourceName)
}
