import * as functions from 'helpers/functions'
import { flyToFeature } from 'maplibre/animations'
import { draw } from 'maplibre/edit'
import {
  highlightFeature,
  highlightedFeatureId,
  highlightedFeatureSource,
  resetHighlightedFeature,
  stickyFeatureHighlight
} from 'maplibre/feature'
import { getFeature } from 'maplibre/layers/layers'
import { frontFeature, map, removeStyleLayers } from 'maplibre/map'

export const viewStyleNames = [
  'polygon-layer',
  'polygon-layer-outline',
  'line-layer-outline', // line outline below line, because it's a wider line
  'line-layer',
  'line-label-symbol',
  'line-layer-hit',
  'line-labels',
  'points-layer-flat',
  'points-layer',
  'points-hit-layer',
  'symbols-layer-flat',
  'symbols-layer',
  'text-layer-flat',
  'text-layer',
  'polygon-layer-extruded-shadow',
  'polygon-layer-extrusion'
]

export function setStyleDefaultFont (font) { labelFont = [font] }

export function initializeViewStyles (sourceName, heatmap=false) {
  console.log('Initializing view styles for source ' + sourceName)
  removeStyleLayers(sourceName)
  viewStyleNames.forEach(styleName => {
    map.addLayer(setSource(styles()[styleName], sourceName))
  })
  if (heatmap) { map.addLayer(setSource(styles()['heatmap-layer'], sourceName)) }
  // console.log('View styles added for source ' + sourceName)

  // click is needed to select on mobile and for sticky highlight
  map.on('click', styleNames(sourceName), function (e) {
    if (draw && draw.getMode() !== 'simple_select') { return }
    if (window.gon.map_mode === 'static') { return }

    // console.log('Features clicked', e.features)
    let feature = e.features.find(f => !f.properties?.cluster)
    if (!feature) { return }

    if (window.gon.map_mode === 'ro' || e.originalEvent.shiftKey) {
      feature = e.features.find(f => f.properties?.onclick !== false)
      if (!feature) { return }

      if (feature.properties?.onclick === 'link' && feature.properties?.['onclick-target']) {
        window.location.href = feature.properties?.['onclick-target']
        return
      }
      if (feature.properties?.onclick === 'feature' && feature.properties?.['onclick-target']) {
        const targetId = feature.properties?.['onclick-target']
        const targetFeature = getFeature(targetId)
        if (targetFeature) {
          flyToFeature(targetFeature)
        } else {
          console.error('Target feature with id ' + targetId + ' not found')
        }
        return
      }
    }
    frontFeature(feature)
    highlightFeature(feature, true, sourceName)
  })

  // highlight features on hover (only in ro mode)
  if (window.gon.map_mode === 'ro' && !functions.isTouchDevice()) {
    map.on('mousemove', (e) => {
      if (stickyFeatureHighlight && highlightedFeatureId) { return }
      if (document.querySelector('.show > .map-modal')) { return }
      if (!map.getSource(sourceName)) { return } // can happen when source is removed

      const features = map.queryRenderedFeatures(e.point, { layers: styleNames(sourceName) })
      // console.log('Features hovered', features)
      let feature = features.find(f => !f.properties?.cluster && f.properties?.onclick !== false)

      if (feature?.id) {
        if (feature.id === highlightedFeatureId) { return }
        frontFeature(feature)
        highlightFeature(feature, false, sourceName)
      } else if (highlightedFeatureSource === sourceName) {
        resetHighlightedFeature()
      }
    })
  }

  map.on('contextmenu', (e) => {
    e.preventDefault()
    // console.log(styleNames(sourceName))
    // const features = map.queryRenderedFeatures(e.point)
    //console.log('ro context:', features)
  })
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
// avoid loading the same image by each web worker
const imageState = {} // 'loading' | 'loaded' | 'error'
export async function loadImage (e) {
  // Skip if already loading, loaded, or failed
  if (imageState[e.id]) {
    // console.log(`Skipped loading image '${e.id}'`, imageState[e.id])
    return
  }

  const imageUrl = e.id

  if (imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
    try {
      imageState[e.id] = 'loading'
      let response = await map.loadImage(imageUrl)
      if (response && map) {
        if (!map.hasImage(imageUrl)) {
          // console.log('Adding ' + imageUrl + ' to map')
          map.addImage(imageUrl, response.data)
          imageState[e.id] = 'loaded'
        }
      } else {
        console.warn(imageUrl + ' not found')
      }
    } catch (error) {
      // Handle errors here
      console.error(`Failed to load image ${imageUrl}: ` + error)
      imageState[e.id] = 'error'
    }
  }
}

// Layer properties: https://maplibre.org/maplibre-style-spec/layers/
// Expressions: https://maplibre.org/maplibre-style-spec/expressions/
// layout is fixed, paint flexible

// shared styles
// Mapbox.Draw layers prefix user properties with 'user_'

export const featureColor = '#0A870A' // green
export const featureOutlineColor = '#cfcfcf'

// Shorthand for MapLibre coalesce expressions: styleProp(['a', 'b'], x) → ['coalesce', ['get', 'a'], ['get', 'b'], x]
const styleProp = (keys, defaultVal) => {
  const gets = keys.map(k => ['get', k])
  return defaultVal !== undefined ? ['coalesce', ...gets, defaultVal] : ['coalesce', ...gets]
}
const sortKey = ['to-number', styleProp(['user_sort-key', 'sort-key'], 1)]
const labelColor = styleProp(['user_label-color', 'label-color'], '#000')
const labelShadow = styleProp(['user_label-shadow', 'label-shadow'], '#fff')

const fillColor = styleProp(['fill', 'user_fill'], featureColor)
const fillOpacity = ['to-number', styleProp(['fill-opacity', 'user_fill-opacity'], 0.7)]

const lineColor = styleProp(['stroke', 'user_stroke'], featureColor)
const polygonOutlineColor = styleProp(['stroke', 'user_stroke'], featureOutlineColor)
const lineOutlineColor = featureOutlineColor

export const defaultLineWidth = 3
const strokeWidth = styleProp(['user_stroke-width', 'stroke-width'], defaultLineWidth)
const lineWidthMin = ['ceil', ['/', ['to-number', strokeWidth], 2]]
const lineWidthMax = ['*', ['to-number', strokeWidth], 2]
const outlineWidthPolygon = ['to-number', styleProp(['user_stroke-width', 'stroke-width'], 2)]
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

const lineOpacity = ['to-number', styleProp(['stroke-opacity', 'user_stroke-opacity'], 0.8)]
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

const shouldScale = ['boolean', styleProp(['user_marker-scaling', 'marker-scaling']), false]
const pointColor = styleProp(['user_marker-color', 'marker-color'], featureColor)
const markerSize = styleProp(['user_marker-size', 'marker-size'])
const minZoomFilter = [">=", ["zoom"], ["coalesce", ["to-number", ["get", "min-zoom"]], 0]]

const pointSizeMin = ['to-number', ['coalesce',
  ...markerSize.slice(1), 3]]

export const pointSizeMax = ['to-number', ['coalesce',
  ...markerSize.slice(1),
  // set default size of point depending on if there is an emoji
  [
    'case',
    ['has', 'marker-symbol'],
    18,
    8
  ]]]

export const pointSize = [
  'interpolate',
  ['linear'],
  ['zoom'],
  5, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, pointSizeMin],
    pointSizeMin
  ],
  17, [
    'case',
    ['boolean', ['feature-state', 'active'], false],
    ['+', 1, pointSizeMax],
    pointSizeMax
  ]
]

export const pointOutlineSize = ['to-number', styleProp(['user_stroke-width', 'stroke-width'], 2)]
export const pointOutlineSizeActive = ['+', 1, pointOutlineSize]
const pointOutlineColor = styleProp(['user_stroke', 'stroke'], featureOutlineColor)
const pointOpacity = ['to-number', styleProp(['marker-opacity'], 0.9)]
const pointOpacityActive = ['to-number', ['coalesce', ['min', ['+', ['get', 'marker-opacity'], 0.2], 1], 0.9]]

// factor of the original icon size (200x200)
// in case of external icon url, we don't know the size
// This is the default size for zoom=16. With each zoom level the size doubles when marker-scaling=true
export const iconSizeDefault = ['*', 1 / 60, ['to-number', styleProp(['user_marker-size', 'marker-size'], 20)]]
export const iconSizeMin = ['case', shouldScale,
  0, iconSizeDefault]
export const iconSizeMax = ['case', shouldScale,
  ['*', 32, iconSizeDefault], iconSizeDefault]

const iconSize = [
      'interpolate',
      ["exponential", 2],
      ['zoom'],
      0, iconSizeMin,
      21, iconSizeMax
    ]

// const iconSizeActive = ['*', 1.1, iconSize] // icon-size is not a paint property
// This is the default size for zoom=16. With each zoom level the size doubles when marker-scaling=true
const userLabelSize = styleProp(['user_label-size', 'label-size'])
const scaledLabelSize = ['coalesce', ...userLabelSize.slice(1), ['*', 2, pointSizeMax]] // fallback to 2*pointSizeMax
const staticLabelSize = ['coalesce', ...userLabelSize.slice(1), 16] // fallback to 16
const labelOffset =
  ["interpolate", ["linear"],
    ['to-number', pointSizeMax],
    0, ["literal", [0, 0]],
    10, ["literal", [0, 1]],
    300, ["literal", [0, 20]]]

export const labelFontSize = [
  'case', shouldScale,
  ['to-number', scaledLabelSize],
  ['to-number', staticLabelSize]]

export const labelFontSizeMin = [
  'case', shouldScale,
  0, labelFontSize ]

export const labelFontSizeMax = [
  "min",
  ['case', shouldScale,
    ['*', 32, labelFontSize], labelFontSize],
  254 // max map font size
]

// Cannot move 'shouldScale' condition above 'interpolate' due to maplibre style restriction
const labelSize = [
  'interpolate',
  ["exponential", 2],
  ['zoom'],
  0, labelFontSizeMin, // At zoom 0
  19, labelFontSizeMax
]

// default font is set in basemap def basemaps[backgroundMapLayer]['font']
export let labelFont // array

// Shared configuration for symbols layers
function symbolsLayerStyles(mode) {
  const flatMode = mode === 'flat'
  const layerId = flatMode ? 'symbols-layer-flat' : 'symbols-layer'

  // Shared layout properties
  const sharedLayout = {
    'symbol-sort-key': sortKey,
    'icon-image': ['coalesce',
      ['get', 'marker-image-url'],
      // replacing marker-symbol value with path to emoji png
      ['case',
        ['!=', ['get', 'marker-symbol'], ''],
        ['concat', '/emojis/noto/', ['get', 'marker-symbol'], '.png'],
        '']
    ],
    'icon-size': iconSize,
    'icon-overlap': 'always', // https://maplibre.org/maplibre-style-spec/layers/#icon-overlap
    'icon-rotate': ['get', 'marker-rotate'],
    'icon-ignore-placement': true // other symbols can be visible even if they collide with the icon
  }

  // Mode-specific layout properties
  const modeSpecificLayout = flatMode ? {
    'icon-pitch-alignment': 'map', // same pitch angle as map
    // If icons/text are projected on map surface ('map') or not ('viewport', default)
    // Cannot get changed with data expressions
    'icon-rotation-alignment': 'map',
    'icon-ignore-placement': true,
    'icon-allow-overlap': true,
  } : {
    'icon-pitch-alignment': 'viewport'
  }

  // Shared paint properties
  const sharedPaint = {
    'icon-opacity': ['case',
      ['boolean', ['feature-state', 'active'], false],
      pointOpacityActive,
      pointOpacity
    ]
  }

  return {
    [layerId]: {
      id: layerId,
      type: 'symbol',
      filter: ['all',
        ['any', ['has', 'marker-image-url'], ['has', 'marker-symbol']],
        flatMode ? ['==', ['get', 'flat'], true] : ['!=', ['get', 'flat'], true],
        minZoomFilter
      ],
      layout: {
        ...sharedLayout,
        ...modeSpecificLayout
      },
      paint: sharedPaint
    }
  }
}

// Shared configuration for text layers
function textLayerStyles(mode) {
  const flatMode = mode === 'flat'
  const layerId = flatMode ? 'text-layer-flat' : 'text-layer'

  // Shared layout properties
  const sharedLayout = {
    'text-field': [
      'format',
      ['coalesce', ['get', 'label'], ['get', 'room']],
      {
        'text-font': [
          'case',
          ['has', 'label-font'],
          ['get', 'label-font'],
          ['literal', labelFont]
        ]
      }
    ],
    'text-size': labelSize,
    'text-font': labelFont,
    'text-letter-spacing': ['get', 'label-letter-spacing'],
    'text-anchor': 'top', // text under point
    // TODO: set this to 0 for polygons, needs 'geometry-type' implementation: https://github.com/maplibre/maplibre-style-spec/discussions/536
    'text-offset': labelOffset,
    'text-justify': ['get', 'label-justify'],
    'text-max-width': ['get', 'label-max-width'],
    'text-line-height': 1.6, // no dynamic value possible
    // TODO: sort keys on text are ascending, on symbols descending???
    'symbol-sort-key': ['-', 1000, sortKey]
  }

  // Mode-specific layout properties
  const modeSpecificLayout = flatMode ? {
    // make sure 'flat' text is always shown
    'text-ignore-placement': true, // show on collision
    'text-allow-overlap': true,
    'text-rotation-alignment': 'map'
  } : {
    'text-ignore-placement': false, // hide on collision
    'text-rotation-alignment': 'viewport',
    'symbol-placement': 'point' // TODO: cannot set proper value for polygons and lines here?
  }

  // Shared paint properties
  const sharedPaint = {
    'text-color': labelColor,
    'text-halo-color': labelShadow,
    'text-halo-width': 2
  }

  return {
    [layerId]: {
      id: layerId,
      type: 'symbol',
      filter: ['all',
        ['!=', ['geometry-type'], 'LineString'], // line labels are in 'line-labels'
        ['has', 'label'],
        flatMode ? ['==', ['get', 'flat'], true] : ['!=', ['get', 'flat'], true],
        minZoomFilter
      ],
      layout: {
        ...sharedLayout,
        ...modeSpecificLayout
      },
      paint: sharedPaint
    }
  }
}

export function styles () {
  return {
    // make ground of extruded polygon darker when selected
    'polygon-layer-extruded-shadow': {
      id: 'polygon-layer-extruded-shadow',
        type: 'fill',
          filter: ['all',
            ["==", ["geometry-type"], "Polygon"],
            ['>', ['get', 'fill-extrusion-height'], 0],
            minZoomFilter],
            paint: {
              'fill-color': 'gray',
              'fill-opacity': [
                "case",
                ['boolean', ['feature-state', 'active'], false], 0.4, 0.7]
      }
    },
    'polygon-layer': {
      id: 'polygon-layer',
      type: 'fill',
      filter: ['all',
        ["==", ["geometry-type"], "Polygon"],
        ['any', ['==', ['get', 'fill-extrusion-height'], 0],
        ['!', ['has', 'fill-extrusion-height']]],
        minZoomFilter],
      paint: {
        'fill-color': fillColor,
        'fill-opacity': fillOpacity
      }
    },
    'polygon-layer-extrusion': {
      id: 'polygon-layer-extrusion',
      type: 'fill-extrusion',
      filter: ['all',
        ['==', ['geometry-type'], 'Polygon'],
        ['>', ['get', 'fill-extrusion-height'], 0],
        minZoomFilter],
      paint: {
        'fill-extrusion-color': styleProp(['fill-extrusion-color', 'user_fill-extrusion-color', 'fill', 'user_fill'], featureColor),
        'fill-extrusion-height': ['to-number', styleProp(['fill-extrusion-height', 'user_fill-extrusion-height'])],
        'fill-extrusion-base': ['to-number', styleProp(['fill-extrusion-base', 'user_fill-extrusion-base'])],
        // opacity does not support data expressions, it's a constant per layer
        'fill-extrusion-opacity': 0.9
      }
    },
    // polygon outlines
    'polygon-layer-outline': {
      id: 'polygon-layer-outline',
      type: 'line',
      filter: ['all',
        ["==", ["geometry-type"], "Polygon"],
        minZoomFilter],
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
          ['+', outlineWidthPolygon, 1], outlineWidthPolygon
        ],
        'line-opacity': lineOpacity
      }
    },
    // line outlines
    'line-layer-outline': {
      id: 'line-layer-outline',
      type: 'line',
      filter: ['all',
        ['==', ['geometry-type'], 'LineString'],
        ['!', ['has', 'stroke-dasharray']], // Only solid lines
        minZoomFilter],
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
        ['==', ['geometry-type'], 'LineString'],
        minZoomFilter],
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
        'line-sort-key': ['to-number', ['get', 'sort-key']]
      },
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': [
          'case', ['boolean', ['feature-state', 'active'], false],
          lineOpacityActive, lineOpacity
        ],
        'line-dasharray': [
          "case",
          ["==", ["get", "stroke-dasharray"], true], ["literal", [1, 1.5]],
          ["literal", [1 , 0]]
        ]
      }
    },
    'line-layer-hit': {
      id: 'line-layer-hit',
      type: 'line',
      filter: ['all',
        ['==', ['geometry-type'], 'LineString'],
        minZoomFilter],
      paint: {
        'line-width': ['+', 10, outlineWidthMax],
        'line-opacity': 0 // cannot use visibility:none here
      }
    },
    'points-layer-flat': {
      id: 'points-layer-flat',
      type: 'circle',
      filter: [
        "all",
        ["==", ["geometry-type"], "Point"],
        ["!=", ["get", "meta"], "midpoint"],
        ["!=", ["get", "meta"], "vertex"],
        ['==', ['get', 'flat'], true],
        ["!", ["has", "point_count"]],
        ["!", ["has", "marker-image-url"]],
        minZoomFilter],
      paint: {
        "circle-pitch-alignment": "map",
        'circle-pitch-scale': 'map', // points get bigger when camera is closer
        'circle-radius': pointSize,
        // force white background for selected point with transparent background
        'circle-color': ["case",
          ["all",
            ['boolean', ['feature-state', 'active'], false],
            ["==", pointColor, "transparent"]
          ],
          "white",
          pointColor
        ],
        // force visibility for selected point with transparent background
        'circle-opacity': ["case",
          ["all",
            ['boolean', ['feature-state', 'active'], false],
            ["==", ['get', 'marker-color'], "transparent"]
          ],
          1,
          ['case',
            ['boolean', ['feature-state', 'active'], false],
            pointOpacityActive,
            pointOpacity
          ]
        ],
        'circle-blur': 0.05,
        'circle-stroke-color': pointOutlineColor,
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'active'], false],
          pointOutlineSizeActive,
          pointOutlineSize
        ],
        'circle-stroke-opacity': ['to-number', ["min", 1, ['+', pointOpacity, 0.2]]]
      },
      layout: {
        'circle-sort-key': sortKey
      }
    },
    'points-layer': {
      id: 'points-layer',
      type: 'circle',
      filter: [
        "all",
        ["==", ["geometry-type"], "Point"],
        ["!=", ["get", "meta"], "midpoint"],
        ["!=", ["get", "meta"], "vertex"],
        ['!=', ['get', 'flat'], true],
        ["!", ["has", "point_count"]],
        ["!", ["has", "marker-image-url"]],
        minZoomFilter
      ],
      paint: {
        'circle-pitch-scale': 'map', // points get bigger when camera is closer
        'circle-radius': pointSize,
        // force white background for selected point with transparent background
        'circle-color': ["case",
          ["all",
            ['boolean', ['feature-state', 'active'], false],
            ["==", pointColor, "transparent"]
          ],
          "white",
          pointColor
        ],
        // force visibility for selected point with transparent background
        'circle-opacity': ["case",
          ["all",
            ['boolean', ['feature-state', 'active'], false],
            ["==", ['get', 'marker-color'], "transparent"]
          ],
          0.7,
          ['case',
            ['boolean', ['feature-state', 'active'], false],
            pointOpacityActive,
            pointOpacity
          ]
        ],
        'circle-blur': 0.05,
        'circle-stroke-color': pointOutlineColor,
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'active'], false],
          pointOutlineSizeActive,
          pointOutlineSize
        ],
        'circle-stroke-opacity': ["min", 1, ['+', pointOpacity, 0.2]]
      },
      layout: {
        // sort-key is only effective within same layer
        'circle-sort-key': sortKey
      }
    },
    'points-hit-layer': {
      id: 'points-hit-layer',
      type: 'circle',
      filter: [
        "all",
        ["==", ["geometry-type"], "Point"],
        minZoomFilter
      ],
      paint: {
        'circle-radius': ['+', 5, pointSizeMax],
        // 'circle-opacity': 0.3 // debug click area
        'circle-opacity': 0
      },
      layout: {
        // sort-key is only effective within same layer
        'circle-sort-key': sortKey
      }
    },
    'heatmap-layer': {
      id: 'heatmap-layer',
      type: 'heatmap',
      filter: [
        "all",
        ["==", ["geometry-type"], "Point"],
        minZoomFilter
      ],
      paint: {
        'heatmap-opacity': 0.7,
        'heatmap-intensity': 1.3,
        'heatmap-radius': 17
      }
    },
    // support symbols on all feature types (projected on map surface or viewport)
    ...symbolsLayerStyles('flat'),
    ...symbolsLayerStyles('viewport'),
    // Line labels sometimes get rendered wrong when line is extruded
    'line-labels': {
      id: 'line-labels',
      type: 'symbol',
      filter: ['all',
        ['==', ['geometry-type'], 'LineString'],
        ['has', 'label'], minZoomFilter],
      layout: {
        'symbol-placement': 'line',
        'text-field': styleProp(['user_label', 'label']),
        'text-font': labelFont,
        'text-size': 14,
        'text-max-angle': 30,
        'symbol-spacing': 200
      },
      paint: {
        'text-color': labelColor,
        'text-halo-color': labelShadow,
        'text-halo-width': 2
      }
    },
    'line-label-symbol': {
      id: "line-label-symbol",
      type: "symbol",
      filter: ['all',
        ['==', ['geometry-type'], 'LineString'],
        // Line symbols don't work in combination with extrusion
        ['==', ['coalesce', ['get', 'fill-extrusion-height'], 0], 0],
        ['any',
          ["has", "stroke-image-url"],
          ["has", "stroke-symbol"]
        ], minZoomFilter],
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
        "icon-rotation-alignment": "viewport",
        "icon-size": ['case', ['has', 'stroke-symbol'], 0.35, 1]
      },
      paint: {
        "icon-opacity": 1
      }
    },
    ...textLayerStyles('flat'),
    ...textLayerStyles('viewport')
  }
}

export function clusterStyles(icon) {
  let icon_image = '/emojis/noto/' + icon + '.png'
  if (icon?.includes('/')) { icon_image = icon } // full url / path

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
        'circle-stroke-opacity': ["min", 1, ['+', pointOpacity, 0.2]]
      }
    }

  const clusterCircles = {
      id: 'cluster_circles',
      type: 'symbol',
      filter: ['has', 'point_count'],
      layout: {
        'icon-image': (icon ? icon_image : ''),
        'icon-size': ['min', ['+', 0.5, ['*', 0.01, ['get', 'point_count']]], 0.75],
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

// Adding sourceName suffix to style names because style layer ids must be unique on map
function styleNames (sourceName) {
  return viewStyleNames.map(styleName => styleName + '_' + sourceName)
}
