import { buffer } from "@turf/buffer"
import { defaults } from 'maplibre/styles/defaults'

// Buffer a LineString into a polygon for MapLibre's fill-extrusion layer, which has no line support.
// Returns null for geometry that can't be buffered (non-line, <2 coords, or degenerate).
// @turf/buffer (JSTS) is expensive, so callers should only invoke this for features that changed.
export function buildLineExtrusion(feature) {
  if (feature.geometry?.type !== 'LineString' || feature.geometry.coordinates.length < 2) {
    return null
  }
  const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaults.lineWidth
  const extrusionLine = buffer(feature, width / 2, { units: 'meters' })
  if (!extrusionLine) { return null }
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
  // The label stays on the line ('line-labels'). On the buffered polygon the point-placed
  // 'text-layer' would draw a horizontal duplicate beside the line.
  delete extrusionLine.properties.label
  delete extrusionLine.properties['label-title']
  return extrusionLine
}

// A wall below one pixel is not worth drawing, and the taller it is, the further out that point sits.
// The extrusion layers already filter on 'min-zoom', so writing the threshold onto the polygon hides
// it per feature. The polygon itself stays in the source at every zoom level: dropping it would move
// all the buffering into the single frame that crosses the threshold and freeze the zoom gesture.
function setExtrusionMinZoom(properties) {
  // A wall with a base starts above the ground, so only the difference is drawn.
  const height = Number(properties['fill-extrusion-height']) - (Number(properties['fill-extrusion-base']) || 0)
  if (!(height > 0)) { return }
  const heightMinZoom = defaults.extrusionPixelZoom - Math.log2(height)
  // A min-zoom set by the author stays in force when it is the stricter of the two.
  const authorMinZoom = Number(properties['min-zoom']) || defaults.minZoom
  properties['min-zoom'] = Math.max(authorMinZoom, heightMinZoom)
}
