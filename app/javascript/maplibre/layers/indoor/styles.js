import { map } from 'maplibre/map'

/**
 * Adds indoor map style layers for a given source
 * Only level plans right now, no POI points
 * @param {string} sourceId - The source ID to use for the layers
 * @param {string} levelFilter - MapLibre filter expression for the current level
 */
export function addIndoorLayers(sourceId, levelFilter) {
  map.addLayer({
    id: `indoor-area-fill_${sourceId}`,
    type: 'fill',
    source: sourceId,
    'source-layer': 'area',
    minzoom: 17,
    filter: levelFilter,
    paint: {
      'fill-color': [
        'match',
        ['get', 'class'],
        'room', '#fdfcfa',
        'corridor', '#fefefe',
        'platform', '#e8edff',
        'wall', '#d5d5d5',
        '#f0f0f0'
      ],
      'fill-opacity': 0.9
    }
  })

  map.addLayer({
    id: `indoor-area-line_${sourceId}`,
    type: 'line',
    source: sourceId,
    'source-layer': 'area',
    minzoom: 17,
    filter: levelFilter,
    paint: {
      'line-color': '#000',
      'line-width': [
        'match',
        ['get', 'class'],
        'wall', 3,
        2
      ]
    }
  })

  map.addLayer({
    id: `indoor-transportation_${sourceId}`,
    type: 'line',
    source: sourceId,
    'source-layer': 'transportation',
    minzoom: 17,
    filter: levelFilter,
    paint: {
      'line-color': '#999',
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  })

  map.addLayer({
    id: `indoor-area-label_${sourceId}`,
    type: 'symbol',
    source: sourceId,
    'source-layer': 'area_name',
    minzoom: 18,
    filter: levelFilter,
    layout: {
      'text-field': ['coalesce', ['get', 'name'], ['get', 'ref']],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-max-width': 10
    },
    paint: {
      'text-color': '#666',
      'text-halo-color': '#fff',
      'text-halo-width': 1
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
    `indoor-area-line_${sourceId}`,
    `indoor-transportation_${sourceId}`,
    `indoor-area-label_${sourceId}`
  ]
}
