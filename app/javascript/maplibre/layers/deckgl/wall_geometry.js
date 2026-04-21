/**
 * Generates 3D wall geometry from LineStrings with fill-extrusion-height.
 *
 * Each LineString segment becomes a vertical rectangular quad (4 vertices):
 * - Bottom vertices at terrain elevation (Z coordinate)
 * - Top vertices at terrain + fill-extrusion-height
 *
 * This allows deck.gl to render terrain-following 3D walls without Turf.js buffering.
 */
export function generateWallGeometry(features) {
  const wallFeatures = []

  const lineFeatures = features.filter(f =>
    f.geometry.type === 'LineString' &&
    f.properties['fill-extrusion-height'] &&
    f.geometry.coordinates.length >= 2
  )

  lineFeatures.forEach(feature => {
    const coords = feature.geometry.coordinates
    const height = feature.properties['fill-extrusion-height']

    for (let i = 0; i < coords.length - 1; i++) {
      const [lng1, lat1, z1 = 0] = coords[i]
      const [lng2, lat2, z2 = 0] = coords[i + 1]

      const wallQuad = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lng1, lat1, z1],              // bottom-left
            [lng2, lat2, z2],              // bottom-right
            [lng2, lat2, z2 + height],     // top-right
            [lng1, lat1, z1 + height],     // top-left
            [lng1, lat1, z1]               // close the ring
          ]]
        },
        properties: {
          id: `${feature.id || feature.properties.id}-wall-${i}`,
          'wall-segment': true,
          'fill-extrusion-color': feature.properties['fill-extrusion-color'] || feature.properties.stroke || '#888',
          'stroke': feature.properties.stroke,
          'stroke-opacity': feature.properties['stroke-opacity'] || 1
        }
      }

      wallFeatures.push(wallQuad)
    }
  })

  return wallFeatures
}
