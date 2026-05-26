import { map } from 'maplibre/map'

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
  '#f2d9a8'
]

/**
 * Adds indoor map style layers for a given source
 * Only level plans right now, no POI points
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
      'fill-extrusion-height': ['+', ['*', ['to-number', ['get', 'level']], 5], 5],
      'fill-extrusion-base': ['*', ['to-number', ['get', 'level']], 5],
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
    `indoor-transportation_${sourceId}`
  ]
}
