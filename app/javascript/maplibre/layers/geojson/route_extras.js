import { buffer } from "@turf/buffer"
import { map } from 'maplibre/map'

// ORS route extras color configurations
// Each type maps values to colors for data-driven styling
const EXTRAS_COLOR_CONFIGS = {
  steepness: {
    // -5 steep downhill .. 0 flat .. 5 steep uphill
    colors: [[-5, '#0055ff'], [-4, '#0077ff'], [-3, '#0099ff'], [-2, '#00bbff'], [-1, '#00ddff'],
             [0, '#aaddaa'], [1, '#ffee00'], [2, '#ffbb00'], [3, '#ff8800'], [4, '#ff4400'], [5, '#ff0000']]
  },
  green: {
    // 0 no green .. 10 very green
    colors: [[0, '#cccccc'], [1, '#b8d8a8'], [2, '#a0cc90'], [3, '#88c078'], [4, '#70b460'],
             [5, '#58a848'], [6, '#409c30'], [7, '#309020'], [8, '#208410'], [9, '#107800'], [10, '#006c00']]
  },
  surface: {
    // 0 unknown, 1 paved, 2 unpaved, 3 asphalt, 4 concrete, 5 cobblestone,
    // 6 metal, 7 wood, 8 compacted gravel, 9 fine gravel, 10 gravel,
    // 11 dirt, 12 ground, 13 ice, 14 paving stones, 15 sand, 16 woodchips, 17 grass, 18 grass paver
    colors: [[0, '#888888'], [1, '#555555'], [2, '#aa8844'], [3, '#444444'], [4, '#666666'],
             [5, '#997755'], [6, '#777777'], [7, '#8B6914'], [8, '#bb9955'], [9, '#ccaa66'],
             [10, '#ddbb77'], [11, '#aa7733'], [12, '#996622'], [13, '#aaddff'], [14, '#888866'],
             [15, '#eedd88'], [16, '#bb9944'], [17, '#66aa44'], [18, '#88bb66']]
  },
  noise: {
    // 0 quiet .. 10 noisy
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

export function renderRouteExtras (features, sourceId) {
  const extrasFeatures = []
  features.filter(feature => (
    feature.geometry.type === 'LineString' &&
    feature.properties['show-route-extras'] &&
    feature.properties.route?.extras
  )).forEach(feature => {
    const extrasType = feature.properties['show-route-extras']
    const extrasData = feature.properties.route.extras[extrasType]
    if (!extrasData?.values) return

    const coords = feature.geometry.coordinates
    extrasData.values.forEach(([startIdx, endIdx, value]) => {
      if (endIdx <= startIdx || startIdx >= coords.length) return
      const segment = coords.slice(startIdx, Math.min(endIdx + 1, coords.length))
      if (segment.length < 2) return
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
  })

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
