import { map } from 'maplibre/map'

// A marker that maplibre draws as one icon: the circle, and the emoji on it, go to a canvas,
// and the canvas becomes a map image. A circle style layer below a symbol style layer would
// instead let the circle of one feature cover the emoji of another.

// The name of an image starts with the prefix of its owner, so that the prune of one owner
// never drops the images of another.
const imageName = (prefix, color, symbol) => `${prefix}-${color.replace('#', '')}${symbol}`

// A retina display needs more pixels than the style layer asks for
const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2)

// The emoji arrives after the image is on the map, so it gets painted in later
function drawSymbol (name, ctx, size, symbol, imageData) {
  const image = new Image()
  image.onload = () => {
    const width = size * 0.62
    ctx.drawImage(image, (size - width) / 2, (size - width) / 2, width, width)
    // a prune between the two can have dropped the image again
    if (map.hasImage(name)) { map.updateImage(name, imageData()) }
  }
  image.src = `/emojis/noto/${symbol}.png`
}

// Draws a circle in the given color, with a border and an optional emoji in the middle, and
// returns the name of the map image. The size is in css pixels, the style layer scales the
// image from there.
export function circleImage (prefix, color, { size = 36, symbol = '', border = '#CCC' } = {}) {
  const name = imageName(prefix, color, symbol)
  if (map.hasImage(name)) { return name }

  const ratio = pixelRatio()
  const canvas = document.createElement('canvas')
  canvas.width = size * ratio
  canvas.height = size * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)

  const center = size / 2
  const radius = center - size / 12
  const borderWidth = size / 18

  ctx.strokeStyle = border
  ctx.lineWidth = borderWidth
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(center, center, radius - borderWidth / 2, 0, Math.PI * 2)
  ctx.fill()

  const imageData = () => ctx.getImageData(0, 0, canvas.width, canvas.height)
  map.addImage(name, imageData(), { pixelRatio: ratio })
  if (symbol) { drawSymbol(name, ctx, size, symbol, imageData) }
  return name
}

// Every distinct color and every distinct emoji adds an image, and one drag on the color
// picker walks through dozens of them, so the images that the owner stopped using are
// dropped after a render.
export function pruneCircleImages (prefix, keep = new Set()) {
  map.listImages().forEach(name => {
    if (name.startsWith(`${prefix}-`) && !keep.has(name)) { map.removeImage(name) }
  })
}
