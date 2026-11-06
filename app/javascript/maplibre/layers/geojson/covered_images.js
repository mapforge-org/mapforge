import { map } from 'maplibre/map'

// Half the side of the query box around the center of an image, in px. Something that only touches
// the rim of an image leaves it undimmed, so a small overlap does not flicker while zooming.
// ponytail: a fixed box, use the rendered size of the image if large images look wrong
const QUERY_RADIUS = 12
// One query per image, see dimCoveredImages
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
