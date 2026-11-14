import { map } from 'maplibre/map'
import { defaultPointSize } from 'maplibre/styles/defaults'

// Half the side of the query box around the center of an image, in px. Something that only touches
// the rim of an image leaves it undimmed, so a small overlap does not flicker while zooming.
// ponytail: a fixed box, use the rendered size of the image if large images look wrong
const QUERY_RADIUS = 12
// One query per image, see dimCoveredImages. hideCoveredLabels compares this many points pairwise.
const MAX_IMAGES = 200

let covered = new Map()

const stateKey = feature => `${feature.source}|${feature.id}`

// A style cannot see a collision, so image points below an icon or a label get the feature state
// 'covered', which the symbols layer dims. It runs on idle, because placement is only final then.
// A change of the state renders again, so it must not write when nothing changed.
export function dimCoveredImages () {
  const layerIds = map.getLayersOrder()
  const imageLayers = layerIds.filter(id => id.startsWith('symbols-layer_'))
  const coverLayers = layerIds.filter(id => /^(points-layer|shapes-layer|text-layer)_/.test(id))
  const images = imageLayers.length ? map.queryRenderedFeatures({ layers: imageLayers }).slice(0, MAX_IMAGES) : []

  const now = new Map()
  images.forEach(image => {
    const { x, y } = map.project(image.geometry.coordinates)
    const box = [[x - QUERY_RADIUS, y - QUERY_RADIUS], [x + QUERY_RADIUS, y + QUERY_RADIUS]]
    const isCovered = map.queryRenderedFeatures(box, { layers: coverLayers }).some(f => f.id !== image.id)
    if (isCovered) { now.set(stateKey(image), { source: image.source, id: image.id }) }
  })

  covered.forEach((target, key) => {
    if (!now.has(key) && map.getSource(target.source)) { map.setFeatureState(target, { covered: false }) }
  })
  now.forEach((target, key) => {
    if (!covered.has(key)) { map.setFeatureState(target, { covered: true }) }
  })
  covered = now
}

// The rebuild after a change of 'coveredLabels' shows the labels at once instead of fading them.
// A fade of 0 means a restore is still pending.
// ponytail: '_fadeDuration' is private MapLibre state, if it gets renamed the labels just fade again
function skipNextFade () {
  const fadeDuration = map._fadeDuration
  if (!fadeDuration) { return }
  map._fadeDuration = 0
  map.once('idle', () => { map._fadeDuration = fadeDuration })
}

// MapLibre draws all labels above all points, so it cannot draw a label between its own point and
// a point on top of it. The label of a point with another point above it near its center hides.
// The ids go into global state, because a label with opacity 0 still takes its place from other
// labels, and only a filter frees it. A change of the global state rebuilds the tiles, so it must
// not write when nothing changed. Points take no part in collision, so unlike the images this
// can run on moveend.
// ponytail: the radius is 'marker-size', which ignores the smaller radius below zoom 17 and
// 'marker-scaling', and the order of two points in different tiles can be wrong
export function hideCoveredLabels () {
  const pointLayers = map.getLayersOrder().filter(id => /^(points-layer|shapes-layer|symbols-layer)_/.test(id))
  // top-most first
  const points = pointLayers.length ? map.queryRenderedFeatures({ layers: pointLayers }).slice(0, MAX_IMAGES) : []

  const above = []
  const seen = new Set()
  const ids = new Set()
  points.forEach(point => {
    // a point near a tile edge comes back once per tile, and would cover itself
    const key = stateKey(point)
    if (seen.has(key)) { return }
    seen.add(key)
    const { x, y } = map.project(point.geometry.coordinates)
    if (point.properties.label && above.some(a => Math.hypot(a.x - x, a.y - y) < a.radius + QUERY_RADIUS)) {
      ids.add(point.properties.id)
    }
    above.push({ x, y, radius: Number(point.properties['marker-size'] || defaultPointSize(point)) })
  })

  const now = [...ids].sort().map(id => `|${id}|`).join('')
  if (now === (map.getGlobalState().coveredLabels ?? '')) { return }
  skipNextFade()
  map.setGlobalStateProperty('coveredLabels', now)
}
