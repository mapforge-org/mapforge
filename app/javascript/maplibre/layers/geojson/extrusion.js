import { mapProperties } from 'maplibre/map'
import { defaultLineWidth, defaults } from 'maplibre/styles/defaults'

// With terrain, MapLibre lifts every extrusion polygon by the elevation at its centroid,
// so one long polygon floats over a slope. Short pieces follow the ground in small steps.
// Without terrain every polygon sits at 0, so each segment stays one piece.
const minPieceLength = 0.5
const maxPieces = 5000
const metersPerDegree = 111320

// Turn a LineString into a wall polygon for MapLibre's fill-extrusion layer, which has no line support.
// Returns null for geometry that can't be extruded (non-line, <2 coords, or degenerate).
export function buildLineExtrusion(feature) {
  if (feature.geometry?.type !== 'LineString' || feature.geometry.coordinates.length < 2) {
    return null
  }
  const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaultLineWidth(feature)
  const pieces = wallPieces(feature.geometry.coordinates, width / 2)
  if (!pieces.length) { return null }
  const extrusionLine = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: pieces } }
  // Route-extras segments are anonymous slices of a route, so they stay id-less.
  if (feature.id) {
    extrusionLine.id = `${feature.id}-extrusion`
    extrusionLine.properties = { ...feature.properties, id: extrusionLine.id }
  } else {
    extrusionLine.properties = { ...feature.properties }
  }
  if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
    extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
  }
  extrusionLine.properties['stroke-width'] = 0
  extrusionLine.properties['stroke-opacity'] = 0
  setExtrusionMinZoom(extrusionLine.properties)
  // The label stays on the line ('line-labels'). On the polygon the point-placed
  // 'text-layer' would draw a horizontal duplicate beside the line.
  delete extrusionLine.properties.label
  delete extrusionLine.properties['label-title']
  return extrusionLine
}

// One quad per piece, in local metres around each segment, plus a disc on every vertex.
// The discs round the joins on the outside of a bend and the caps at both ends.
function wallPieces(coords, halfWidth) {
  const segments = []
  for (let i = 1; i < coords.length; i++) {
    const [lng0, lat0] = coords[i - 1]
    const [lng1, lat1] = coords[i]
    const mx = metersPerDegree * Math.cos(lat0 * Math.PI / 180)
    const dx = (lng1 - lng0) * mx
    const dy = (lat1 - lat0) * metersPerDegree
    const length = Math.hypot(dx, dy)
    if (length > 0) { segments.push({ lng0, lat0, lng1, lat1, mx, ux: dx / length, uy: dy / length, length }) }
  }
  if (!segments.length) { return [] }
  const total = segments.reduce((sum, s) => sum + s.length, 0)
  // Math.ceil adds at most one piece per segment and every vertex adds a disc, so those are
  // kept out of the budget. A line with too many segments still gets one piece per segment.
  const pieceLength = mapProperties.terrain
    ? Math.max(minPieceLength, total / Math.max(1, maxPieces - 2 * segments.length - 1))
    : Infinity
  const pieces = []
  for (const { lng0, lat0, mx, ux, uy, length } of segments) {
    const toLngLat = (along, side) => [
      lng0 + (ux * along - uy * side) / mx,
      lat0 + (uy * along + ux * side) / metersPerDegree
    ]
    const n = Math.max(1, Math.ceil(length / pieceLength))
    for (let p = 0; p < n; p++) {
      const from = length * p / n
      const to = length * (p + 1) / n
      const right = toLngLat(from, -halfWidth)
      pieces.push([[right, toLngLat(to, -halfWidth), toLngLat(to, halfWidth), toLngLat(from, halfWidth), right]])
    }
    pieces.push(disc(lng0, lat0, mx, halfWidth))
  }
  const last = segments.at(-1)
  pieces.push(disc(last.lng1, last.lat1, last.mx, halfWidth))
  return pieces
}

const discSides = 12

function disc(lng, lat, mx, radius) {
  const ring = []
  for (let i = 0; i <= discSides; i++) {
    const angle = 2 * Math.PI * (i % discSides) / discSides
    ring.push([lng + radius * Math.cos(angle) / mx, lat + radius * Math.sin(angle) / metersPerDegree])
  }
  return [ring]
}

// A wall below one pixel is not worth drawing, and the taller it is, the further out that point sits.
// The extrusion layers already filter on 'min-zoom', so writing the threshold onto the polygon hides
// it per feature. The polygon itself stays in the source at every zoom level: dropping it would move
// all the polygon building into the single frame that crosses the threshold and freeze the zoom gesture.
function setExtrusionMinZoom(properties) {
  // A wall with a base starts above the ground, so only the difference is drawn.
  const height = Number(properties['fill-extrusion-height']) - (Number(properties['fill-extrusion-base']) || 0)
  if (!(height > 0)) { return }
  const heightMinZoom = defaults.extrusionPixelZoom - Math.log2(height)
  // A min-zoom set by the author stays in force when it is the stricter of the two.
  const authorMinZoom = Number(properties['min-zoom']) || defaults.minZoom
  properties['min-zoom'] = Math.max(authorMinZoom, heightMinZoom)
}
