import { symbolUrl } from 'helpers/functions'
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'

// A marker that maplibre draws as one icon: the shape, and the emoji on it, go to a canvas,
// and the canvas becomes a map image. A circle style layer below a symbol style layer would
// instead let the circle of one feature cover the emoji of another.

// The name of an image starts with the prefix of its owner, so that the prune of one owner
// never drops the images of another.
const imageName = (prefix, color, symbol) => `${prefix}-${color.replace('#', '')}${symbol}`

// css pixel size of a 'shape' image. The style layer scales the image from there.
export const SHAPE_BASE = 48

// Inset of the shape in its canvas, and the width of its border, as a fraction of the canvas.
// The same margin for every shape, so a circle, a pin and a square read as one size.
const MARGIN = 1 / 12
const BORDER = 1 / 18

// The filled part of a shape, in css pixels. A plain circle of the same 'marker-size' covers
// exactly this much, so the style layer scales a shape to it (see shapeScale in styles.js) and
// a marker keeps its size whether it carries a symbol or not.
export const SHAPE_FILL = SHAPE_BASE * (1 - 2 * MARGIN - BORDER)

// A retina display needs more pixels than the style layer asks for
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2)

// The emoji arrives after the image is on the map, so it gets painted in later. The head of a
// pin sits where the circle of a circle marker sits, so one box works for every shape.
function drawSymbol (name, ctx, size, symbol, imageData) {
  const image = new Image()
  image.onload = () => {
    const width = size * 0.62
    ctx.drawImage(image, (size - width) / 2, (size - width) / 2, width, width)
    // a prune between the two can have dropped the image again
    if (map.hasImage(name)) { map.updateImage(name, imageData()) }
  }
  image.src = symbolUrl(symbol)
}

// A pin is taller than it is wide: the head takes the top square of the canvas, the tip goes
// below it. A square canvas would cut the top of the head off.
const PIN_ASPECT = 1.35
const canvasHeight = (shape, size) => (shape === 'pin' ? size * PIN_ASPECT : size)

// The tip of a pin sits at the bottom center of the canvas, so that 'icon-anchor': 'bottom'
// puts it on the coordinate of the feature. The head is the circle of a circle marker.
function pinPath (ctx, size, inset) {
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - inset
  const tip = size * PIN_ASPECT - inset
  // the curve leaves the head where the head stops facing the tip, so the outline stays smooth
  const angle = Math.acos(radius / (tip - cy))
  ctx.beginPath()
  ctx.arc(cx, cy, radius, Math.PI / 2 - angle, Math.PI / 2 + angle, true)
  ctx.lineTo(cx, tip)
  ctx.closePath()
}

function shapePath (ctx, shape, size, inset) {
  if (shape === 'pin') { return pinPath(ctx, size, inset) }
  ctx.beginPath()
  if (shape === 'square') {
    ctx.roundRect(inset, inset, size - 2 * inset, size - 2 * inset, size / 8)
  } else {
    ctx.arc(size / 2, size / 2, size / 2 - inset, 0, Math.PI * 2)
  }
}

// Draws a shape in the given color, with a border and an optional emoji on it, and adds it as
// a map image under the given name. The size is in css pixels, the style layer scales the
// image from there.
export function markerImage (name, { shape = 'circle', color, border = '#CCC', symbol = '', size = 36 } = {}) {
  if (map.hasImage(name)) { return name }

  const ratio = pixelRatio()
  const canvas = document.createElement('canvas')
  canvas.width = size * ratio
  canvas.height = canvasHeight(shape, size) * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)

  const borderWidth = size * BORDER
  const margin = size * MARGIN

  if (border !== 'transparent') {
    ctx.strokeStyle = border
    ctx.lineWidth = borderWidth
    shapePath(ctx, shape, size, margin)
    ctx.stroke()
  }
  if (color !== 'transparent') {
    ctx.fillStyle = color
    shapePath(ctx, shape, size, margin + borderWidth / 2)
    ctx.fill()
  }

  const imageData = () => ctx.getImageData(0, 0, canvas.width, canvas.height)
  map.addImage(name, imageData(), { pixelRatio: ratio })
  if (symbol) { drawSymbol(name, ctx, size, symbol, imageData) }
  return name
}

// Draws a circle, and returns the name of the map image.
export function circleImage (prefix, color, { size = 36, symbol = '', border = '#CCC' } = {}) {
  return markerImage(imageName(prefix, color, symbol), { color, size, symbol, border })
}

// The name of the image of a shaped marker. It carries every style that goes into the image,
// so that two markers share one image only while they look the same.
// KEEP IN SYNC with shapeImage() in styles.js, which is what the map renders.
export function shapeImageName (properties) {
  return [ 'shape-' + (properties['marker-shape'] || 'circle'),
    properties['marker-color'] || defaults.featureColor,
    properties.stroke || defaults.featureOutlineColor,
    properties['marker-image-url'] || properties['marker-symbol'] || '' ].join('|')
}

// Which points the map draws as one image. KEEP IN SYNC with shapedPoint() in styles.js.
const isShapedPoint = feature => feature.geometry?.type === 'Point' &&
  ((feature.properties?.['marker-shape'] || 'circle') !== 'circle' || !!feature.properties?.['marker-symbol'])

// Drops the shape images that no feature uses any more. A missing image is drawn again by the
// resolver of maplibre (see loadImage), so a prune that goes too far repairs itself.
export function pruneShapeImages (features) {
  const keep = new Set(features.filter(isShapedPoint).map(feature => shapeImageName(feature.properties)))
  pruneCircleImages('shape', keep)
}

// Every distinct color and every distinct emoji adds an image, and one drag on the color
// picker walks through dozens of them, so the images that the owner stopped using are
// dropped after a render.
export function pruneCircleImages (prefix, keep = new Set()) {
  map.listImages().forEach(name => {
    if (name.startsWith(`${prefix}-`) && !keep.has(name)) { map.removeImage(name) }
  })
}
