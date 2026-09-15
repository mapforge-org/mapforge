import { map } from 'maplibre/map'
import { pruneCircleImages } from 'maplibre/styles/circle_image'
import { defaults } from 'maplibre/styles/defaults'

// A pattern is drawn here instead of shipped as a file, so that it takes the border color of
// its polygon. Between its marks the tile stays transparent, so the fill layer below the
// pattern layer keeps showing the fill color (see sortLayers).

// The side of one tile in css pixels. Every drawing below repeats seamlessly at this size.
const TILE = 16

export const patternKeys = [ 'hatch', 'cross', 'lines', 'lines-bold', 'grid', 'dots',
  'dots-big', 'checker' ]

// A retina display needs more pixels than the style layer asks for
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2)

const line = (ctx, x1, y1, x2, y2) => { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2) }

// The three diagonals that cross one tile, drawn past its edges so that each one meets the
// diagonal of the next tile. 'down' turns them by 90 degrees.
function diagonals (ctx, down) {
  for (const offset of [ -TILE, 0, TILE ]) {
    if (down) {
      line(ctx, -4, offset - 4, TILE + 4, offset + TILE + 4)
    } else {
      line(ctx, -4, offset + TILE + 4, TILE + 4, offset - 4)
    }
  }
}

function drawPattern (ctx, key, color) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = key === 'lines-bold' ? 5 : 2
  if (key === 'dots' || key === 'dots-big') {
    for (const [ x, y ] of [ [ 4, 4 ], [ 12, 12 ] ]) {
      ctx.beginPath()
      ctx.arc(x, y, key === 'dots-big' ? 4 : 2, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  if (key === 'checker') {
    ctx.fillRect(0, 0, TILE / 2, TILE / 2)
    ctx.fillRect(TILE / 2, TILE / 2, TILE / 2, TILE / 2)
    return
  }
  ctx.beginPath()
  if (key === 'lines' || key === 'lines-bold' || key === 'grid') { line(ctx, -1, TILE / 2, TILE + 1, TILE / 2) }
  if (key === 'grid') { line(ctx, TILE / 2, -1, TILE / 2, TILE + 1) }
  if (key === 'hatch' || key === 'cross') { diagonals(ctx, false) }
  if (key === 'cross') { diagonals(ctx, true) }
  ctx.stroke()
}

function tile (key, color, ratio) {
  const canvas = document.createElement('canvas')
  canvas.width = TILE * ratio
  canvas.height = TILE * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)
  // a transparent border would draw a tile that shows nothing, so the pattern keeps the default
  const ink = (!color || color === 'transparent') ? defaults.featureOutlineColor : color
  if (patternKeys.includes(key)) { drawPattern(ctx, key, ink) }
  return { canvas, ctx }
}

// The name of the map image of a pattern. It carries every style that goes into the image, so
// that two polygons share one image only while they look the same.
// KEEP IN SYNC with patternImage() in styles.js, which is what the map renders.
export function patternImageName (properties) {
  return `pattern-${properties['fill-pattern']}|${properties.stroke || defaults.featureOutlineColor}`
}

// Draws the tile of a 'pattern-<key>|<color>' image name and adds it as a map image.
export function patternImage (name) {
  if (map.hasImage(name)) { return name }
  const [ key, color ] = name.slice('pattern-'.length).split('|')
  const ratio = pixelRatio()
  const { canvas, ctx } = tile(key, color, ratio)
  map.addImage(name, ctx.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: ratio })
  return name
}

// The tile as a css background image, for the swatch of the edit modal.
export function patternDataUrl (key, color) {
  return tile(key, color, 2).canvas.toDataURL()
}

// Drops the pattern images that no feature uses any more. A missing image is drawn again by the
// resolver of maplibre (see loadImage), so a prune that goes too far repairs itself.
export function prunePatternImages (features) {
  const keep = new Set(features.filter(feature => feature.properties?.['fill-pattern'])
    .map(feature => patternImageName(feature.properties)))
  pruneCircleImages('pattern', keep)
}
