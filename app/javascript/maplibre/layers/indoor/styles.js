import { map } from 'maplibre/map'
import { labelFont } from 'maplibre/styles/styles'

export const indoorFillColor = [
  'match',
  ['get', 'class'],
  'room', '#fdbe87',
  'corridor', '#f4c97f',
  'wall', '#c89968',
  'platform', '#f7d794',
  'column', '#b8875e',
  'area', '#f2d9a8',
  'level', '#e5c88d',
  '#c0c0c0'
]

/**
 * Adds indoor map style layers for a given source
 * Only level plans right now, no POI points
 * Schema of indoor layers: https://indoorequal.com/doc/schema
 * OSM indoor tagging guideline: https://wiki.openstreetmap.org/wiki/OpenIndoor +
 *                               https://wiki.openstreetmap.org/wiki/Simple_Indoor_Tagging
 * @param {string} sourceId - The source ID to use for the layers
 * @param {Array} levelFilter - MapLibre filter expression array for the current level
 */
export function addIndoorLayers(sourceId, levelFilter) {
  map.addLayer({
    id: `indoor-area-fill_${sourceId}`,
    type: 'fill',
    source: sourceId,
    'source-layer': 'area',
    minzoom: 16,
    filter: levelFilter,
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['feature-state', 'active'], false], '#b3d9ff',
        indoorFillColor
      ],
      'fill-opacity': 0.9
    }
  })

  map.addLayer({
    id: `indoor-area-extrusion_${sourceId}`,
    type: 'fill-extrusion',
    source: sourceId,
    'source-layer': 'area',
    minzoom: 16,
    filter: levelFilter,
    paint: {
      'fill-extrusion-color': [
        'case',
        ['boolean', ['feature-state', 'active'], false], '#b3d9ff',
        indoorFillColor
      ],
      'fill-extrusion-height': ['+', ['*', ['to-number', ['get', 'level']], 4], 4],
      'fill-extrusion-base': ['*', ['to-number', ['get', 'level']], 4],
      'fill-extrusion-opacity': 0.8
    }
  })

  map.addLayer({
    id: `indoor-area-line_${sourceId}`,
    type: 'line',
    source: sourceId,
    'source-layer': 'area',
    minzoom: 16,
    filter: levelFilter,
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'active'], false], '#000',
        '#888'
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'active'], false], 3,
        1
      ]
    }
  })

  map.addLayer({
    id: `indoor-transportation_${sourceId}`,
    type: 'line',
    source: sourceId,
    'source-layer': 'transportation',
    minzoom: 16,
    filter: levelFilter,
    paint: {
      'line-color': '#999',
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  })

  map.addLayer({
    id: `indoor-poi-circle_${sourceId}`,
    type: 'circle',
    source: sourceId,
    'source-layer': 'poi',
    minzoom: 17,
    filter: [
      'all',
      levelFilter,
      [
        '!',
        [
          'any',
          ['in', ['get', 'subclass'], ['literal', ['toilet', 'toilets', 'elevator']]]
        ]
      ]
    ],
    paint: {
      'circle-radius': [
        'case',
        ['boolean', ['feature-state', 'active'], false], 6,
        4
      ],
      'circle-color': [
        'case',
        ['boolean', ['feature-state', 'active'], false], '#b3d9ff',
        [
          'match',
          ['get', 'class'],
          'stairs', '#FF9800',
          'escalator', '#2196F3',
          'information', '#00BCD4',
          '#757575'
        ]
      ],
      'circle-stroke-width': [
        'case',
        ['boolean', ['feature-state', 'active'], false], 2,
        1
      ],
      'circle-stroke-color': '#fff'
    }
  })

  map.addLayer({
    id: `indoor-poi-icon_${sourceId}`,
    type: 'symbol',
    source: sourceId,
    'source-layer': 'poi',
    minzoom: 17,
    filter: [
      'all',
      levelFilter,
      [
        'any',
        ['in', ['get', 'subclass'], ['literal', ['toilet', 'toilets', 'elevator']]]
      ]
    ],
    layout: {
      'icon-image': [
        'case',
        ['in', ['get', 'subclass'], ['literal', ['toilet', 'toilets']]], '/emojis/noto/🚻.png',
        ['==', ['get', 'subclass'], 'elevator'], '/emojis/noto/🛗.png',
        ''
      ],
      'icon-size': 0.3,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true
    },
    paint: {
      'icon-opacity': [
        'case',
        ['boolean', ['feature-state', 'active'], false], 1,
        0.85
      ]
    }
  })

  map.addLayer({
    id: `indoor-poi-label_${sourceId}`,
    type: 'symbol',
    source: sourceId,
    'source-layer': 'poi',
    minzoom: 18,
    filter: levelFilter,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 13,
      'text-font': labelFont,
      'text-anchor': 'top',
      'text-offset': [0, 0.8],
      'text-optional': true
    },
    paint: {
      'text-color': '#333',
      'text-halo-color': '#fff',
      'text-halo-width': 1
    }
  })

  map.addLayer({
    id: `indoor-area-name_${sourceId}`,
    type: 'symbol',
    source: sourceId,
    'source-layer': 'area_name',
    minzoom: 18,
    filter: levelFilter,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 15,
      'text-font': labelFont,
      'text-optional': true
    },
    paint: {
      'text-color': '#555',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5
    }
  })
}

/**
 * Returns the list of indoor layer IDs for a given source
 * @param {string} sourceId - The source ID
 * @returns {string[]} Array of layer IDs
 */
export function getIndoorLayerIds(sourceId) {
  return [
    `indoor-area-fill_${sourceId}`,
    `indoor-area-extrusion_${sourceId}`,
    `indoor-area-line_${sourceId}`,
    `indoor-transportation_${sourceId}`,
    `indoor-poi-circle_${sourceId}`,
    `indoor-poi-icon_${sourceId}`,
    `indoor-poi-label_${sourceId}`,
    `indoor-area-name_${sourceId}`
  ]
}
