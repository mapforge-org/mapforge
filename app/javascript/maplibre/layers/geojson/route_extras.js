import { buffer } from "@turf/buffer"
import { distance } from "@turf/distance"
import { point } from "@turf/helpers"
import { map } from 'maplibre/map'

// Steepness value to percentage range mapping for labels
const STEEPNESS_RANGES = {
  3: '7-11%',
  4: '12-15%',
  5: '>16%'
}

// ORS route extras color configurations
// Each type maps values to colors and labels for data-driven styling
export const EXTRAS_COLOR_CONFIGS = {
  steepness: {
    title: 'Steepness',
    gradient: true,
    legendLabels: { '-5': 'Downhill', '0': 'Flat', '5': 'Uphill' },
    labels: { '-5': 'Steep downhill (>16%)', '-4': 'Downhill (12-15%)', '-3': 'Moderate downhill (7-11%)', '-2': 'Gentle downhill (4-6%)', '-1': 'Slight downhill (1-3%)',
              '0': 'Flat (0%)', '1': 'Slight uphill (1-3%)', '2': 'Gentle uphill (4-6%)', '3': 'Moderate uphill (7-11%)', '4': 'Uphill (12-15%)', '5': 'Steep uphill (>16%)' },
    colors: [[-5, '#1a6a1a'], [-4, '#2d8a2d'], [-3, '#4eaa4e'], [-2, '#7bc47a'], [-1, '#a8d5a0'],
             [0, '#c0e8c0'], [1, '#E6AA68'], [2, '#D97A2E'], [3, '#B85E1E'], [4, '#CA3C25'], [5, '#8B1A1A']]
  },
  green: {
    title: 'Green areas',
    gradient: true,
    labels: { '0': 'No green', '10': 'Very green' },
    colors: [[0, '#cccccc'], [1, '#b8d8a8'], [2, '#a0cc90'], [3, '#88c078'], [4, '#70b460'],
             [5, '#58a848'], [6, '#409c30'], [7, '#309020'], [8, '#208410'], [9, '#107800'], [10, '#006c00']]
  },
  surface: {
    title: 'Surface',
    gradient: false,
    labels: { '0': 'Unknown', '1': 'Paved', '2': 'Unpaved', '3': 'Asphalt', '4': 'Concrete', '5': 'Cobblestone',
              '6': 'Metal', '7': 'Wood', '8': 'Compacted gravel', '9': 'Fine gravel', '10': 'Gravel',
              '11': 'Dirt', '12': 'Ground', '13': 'Ice', '14': 'Paving stones', '15': 'Sand',
              '16': 'Woodchips', '17': 'Grass', '18': 'Grass paver' },
    colors: [[0, '#888888'], [1, '#555555'], [2, '#aa8844'], [3, '#444444'], [4, '#666666'],
             [5, '#997755'], [6, '#777777'], [7, '#8B6914'], [8, '#bb9955'], [9, '#ccaa66'],
             [10, '#ddbb77'], [11, '#aa7733'], [12, '#996622'], [13, '#aaddff'], [14, '#888866'],
             [15, '#eedd88'], [16, '#bb9944'], [17, '#66aa44'], [18, '#88bb66']]
  },
  noise: {
    title: 'Noise level',
    gradient: true,
    labels: { '0': 'Quiet', '10': 'Noisy' },
    colors: [[0, '#00aa44'], [1, '#33aa33'], [2, '#66aa22'], [3, '#99aa11'], [4, '#ccaa00'],
             [5, '#ffaa00'], [6, '#ff8800'], [7, '#ff6600'], [8, '#ff4400'], [9, '#ff2200'], [10, '#ff0000']]
  }
}

function resolveExtrasColor (type, value) {
  const config = EXTRAS_COLOR_CONFIGS[type]
  if (!config) return '#888888'
  const entry = config.colors.find(([v]) => v === value)
  return entry ? entry[1] : '#888888'
}

// Compute distance-based totals for a given extras type
export function computeExtrasTotals (feature, extrasType) {
  const extrasData = feature.properties.route?.extras?.[extrasType]
  if (!extrasData?.values) return null

  const config = EXTRAS_COLOR_CONFIGS[extrasType]
  if (!config) return null

  const coords = feature.geometry.coordinates
  const totals = {}
  let totalDistance = 0

  extrasData.values.forEach(([startIdx, endIdx, value]) => {
    if (endIdx <= startIdx || startIdx >= coords.length) return
    const end = Math.min(endIdx, coords.length - 1)
    let segDist = 0
    for (let i = startIdx; i < end; i++) {
      segDist += distance(point(coords[i]), point(coords[i + 1]), { units: 'meters' })
    }
    totals[value] = (totals[value] || 0) + segDist
    totalDistance += segDist
  })

  return { type: extrasType, config, totals, totalDistance }
}

// Create point features with steepness labels for steep segments
function createSteepnessLabelFeatures (coords, extrasValues) {
  const labelFeatures = []

  extrasValues.forEach(([startIdx, endIdx, value]) => {
    if (Math.abs(value) < 3) return
    if (endIdx <= startIdx || startIdx >= coords.length) return

    const end = Math.min(endIdx, coords.length - 1)
    const firstCoord = coords[startIdx]
    const lastCoord = coords[end]

    // Calculate segment length by summing consecutive point distances
    let segmentLength = 0
    for (let i = startIdx; i < end; i++) {
      segmentLength += distance(point(coords[i]), point(coords[i + 1]), { units: 'meters' })
    }

    // Skip very short segments
    if (segmentLength < 50) return

    // Compute midpoint by averaging first and last coordinates
    const midpoint = [
      (firstCoord[0] + lastCoord[0]) / 2,
      (firstCoord[1] + lastCoord[1]) / 2
    ]

    // Format distance label
    let distanceLabel
    if (segmentLength >= 1000) {
      distanceLabel = `${(segmentLength / 1000).toFixed(1)} km`
    } else {
      distanceLabel = `${Math.round(segmentLength)} m`
    }

    // Format label with direction arrow, range, and length on second line
    const rangeLabel = STEEPNESS_RANGES[Math.abs(value)]
    const arrow = value > 0 ? '▲' : '▼'
    const label = `${arrow} ${rangeLabel}\n${distanceLabel}`

    labelFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: midpoint },
      properties: {
        'steepness-label': label,
        'steepness-color': resolveExtrasColor('steepness', value),
        'steepness-priority': Math.abs(value)
      }
    })
  })

  return labelFeatures
}

// Show/hide the map legend for route extras
export function showExtrasLegend (extrasType, activeValues) {
  let container = document.getElementById('route-extras-legend')

  if (!extrasType) {
    if (container) container.classList.add('hidden')
    return
  }

  const config = EXTRAS_COLOR_CONFIGS[extrasType]
  if (!config) return

  if (!container) {
    container = document.createElement('div')
    container.id = 'route-extras-legend'
    container.className = 'route-extras-legend'
    map.getContainer().appendChild(container)
  }

  container.innerHTML = ''
  container.classList.remove('hidden')

  const title = document.createElement('div')
  title.className = 'route-extras-legend-title'
  title.textContent = config.title
  container.appendChild(title)

  if (config.gradient) {
    const bar = document.createElement('div')
    bar.className = 'route-extras-legend-gradient'
    bar.style.background = `linear-gradient(to right, ${config.colors.map(([, c]) => c).join(', ')})`
    container.appendChild(bar)

    const labelRow = document.createElement('div')
    labelRow.className = 'route-extras-legend-labels'
    const first = config.colors[0]
    const last = config.colors[config.colors.length - 1]
    const legendLabels = config.legendLabels || config.labels
    const leftLabel = document.createElement('span')
    leftLabel.textContent = legendLabels[String(first[0])] || String(first[0])
    const rightLabel = document.createElement('span')
    rightLabel.textContent = legendLabels[String(last[0])] || String(last[0])
    labelRow.appendChild(leftLabel)
    labelRow.appendChild(rightLabel)
    container.appendChild(labelRow)
  } else {
    // Discrete legend (surface) — show only used colors with swatches
    const list = document.createElement('div')
    list.className = 'route-extras-legend-discrete'
    config.colors.forEach(([value, color]) => {
      if (!activeValues.has(value)) return
      const label = config.labels[String(value)]
      if (!label) return
      const item = document.createElement('div')
      item.className = 'route-extras-legend-item'
      const swatch = document.createElement('span')
      swatch.className = 'route-extras-legend-swatch'
      swatch.style.backgroundColor = color
      item.appendChild(swatch)
      const text = document.createElement('span')
      text.textContent = label
      item.appendChild(text)
      list.appendChild(item)
    })
    container.appendChild(list)
  }
}

export function renderRouteExtras (features, sourceId) {
  const extrasFeatures = []
  let activeExtrasType = null
  const activeValues = new Set()

  features.filter(feature => (
    feature.geometry.type === 'LineString' &&
    feature.properties['show-route-extras'] &&
    feature.properties.route?.extras
  )).forEach(feature => {
    const extrasType = feature.properties['show-route-extras']
    activeExtrasType = extrasType
    const extrasData = feature.properties.route.extras[extrasType]
    if (!extrasData?.values) return

    const coords = feature.geometry.coordinates
    extrasData.values.forEach(([startIdx, endIdx, value]) => {
      if (endIdx <= startIdx || startIdx >= coords.length) return
      const segment = coords.slice(startIdx, Math.min(endIdx + 1, coords.length))
      if (segment.length < 2) return
      activeValues.add(value)
      extrasFeatures.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: segment },
        properties: {
          'stroke': resolveExtrasColor(extrasType, value),
          'stroke-width': feature.properties['stroke-width'] || 5,
          'fill-extrusion-height': feature.properties['fill-extrusion-height'],
          'fill-extrusion-base': feature.properties['fill-extrusion-base'],
          "fill-extrusion-width": feature.properties['fill-extrusion-width'],
        }
      })
    })

    // Add steepness labels for steep segments
    if (extrasType === 'steepness') {
      const labelFeatures = createSteepnessLabelFeatures(coords, extrasData.values)
      extrasFeatures.push(...labelFeatures)
    }
  })

  // Filter activeValues for discrete legends: remove values < 0.5% of total distance
  const config = EXTRAS_COLOR_CONFIGS[activeExtrasType]
  if (config && !config.gradient && activeValues.size > 0) {
    const mergedTotals = {}
    let mergedTotal = 0
    features.filter(f =>
      f.geometry.type === 'LineString' &&
      f.properties['show-route-extras'] === activeExtrasType &&
      f.properties.route?.extras
    ).forEach(f => {
      const result = computeExtrasTotals(f, activeExtrasType)
      if (!result) return
      for (const [v, d] of Object.entries(result.totals)) {
        mergedTotals[v] = (mergedTotals[v] || 0) + d
      }
      mergedTotal += result.totalDistance
    })
    if (mergedTotal > 0) {
      for (const value of activeValues) {
        const pct = ((mergedTotals[value] || 0) / mergedTotal) * 100
        if (pct < 0.5) activeValues.delete(value)
      }
    }
  }

  showExtrasLegend(activeExtrasType, activeValues)

  // Buffer LineString segments into polygons for 3D extrusion
  const extrusionFeatures = extrasFeatures
    .filter(f => f.properties['fill-extrusion-height'])
    .map(feature => {
      const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || 5
      const extrusionLine = buffer(feature, width, { units: 'meters' })
      extrusionLine.properties = { ...feature.properties }
      extrusionLine.properties['fill-extrusion-color'] = feature.properties['stroke']
      extrusionLine.properties['stroke-width'] = 0
      extrusionLine.properties['stroke-opacity'] = 0
      extrusionLine.properties['fill-opacity'] = 0
      return extrusionLine
    })

  map.getSource(sourceId).setData({
    type: 'FeatureCollection',
    features: extrasFeatures.concat(extrusionFeatures)
  })
}

export function initializeSteepnessLabelStyles (sourceId) {
  const layerId = `steepness-labels_${sourceId}`
  if (map.getLayer(layerId)) return

  map.addLayer({
    id: layerId,
    source: sourceId,
    type: 'symbol',
    filter: ['has', 'steepness-label'],
    layout: {
      'text-field': ['get', 'steepness-label'],
      'text-font': ['noto_sans_bold'],
      'text-size': 11,
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-anchor': 'center',
      'text-justify': 'center',
      'text-padding': 0,
      // on collission, show the strongest steepness
      'symbol-sort-key': ['-', 10, ['get', 'steepness-priority']]
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': ['get', 'steepness-color'],
      'text-halo-width': 2
    }
  })
}
