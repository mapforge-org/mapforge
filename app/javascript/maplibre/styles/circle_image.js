import { symbolUrl } from 'helpers/functions'
import { map } from 'maplibre/map'
import { defaultPointSize, defaults } from 'maplibre/styles/defaults'

// A marker that maplibre draws as one icon: the shape, and the emoji on it, go to a canvas,
// and the canvas becomes a map image. A circle style layer below a symbol style layer would
// instead let the circle of one feature cover the emoji of another.

// The name of an image starts with the prefix of its owner, so that the prune of one owner
// never drops the images of another.
const imageName = (prefix, color, symbol) => `${prefix}-${color.replace('#', '')}${symbol}`

// Inset of the shape in its canvas, and the width of its border, as a fraction of the canvas.
// The same margin for every shape, so a circle, a pin and a square read as one size.
const MARGIN = 1 / 12
const BORDER = 1 / 18

// The filled part of a shape, as a fraction of its canvas.
const FILL = 1 - 2 * MARGIN - BORDER

// css pixel size of the canvas of a shape whose filled part is as wide as a plain circle of the
// given 'marker-size'. A marker keeps its size whether it carries a symbol or not, and the map
// draws the image at icon-size 1: a scaled bitmap blurs above 1 and aliases below 0.5.
export const shapeCanvasSize = markerSize => 2 * markerSize / FILL

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

// Draws a shape in the given color, with a border, an optional emoji on it and an optional halo
// around it, and adds it as a map image under the given name. The size is in css pixels, the
// style layer scales the image from there.
export function markerImage (name, { shape = 'circle', color, border = '#CCC', symbol = '', size = 36, halo = false } = {}) {
  if (map.hasImage(name)) { return name }

  const ratio = pixelRatio()
  const canvas = document.createElement('canvas')
  canvas.width = size * ratio
  canvas.height = canvasHeight(shape, size) * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)

  const borderWidth = size * BORDER
  const margin = size * MARGIN

  // ponytail: the halo fills the margin outside the border, which is thinner than haloWidth for
  // a marker below size 20. A wider canvas would move the anchor and pointEdge() in styles.js.
  if (halo) {
    const haloWidth = Math.min(defaults.haloWidth, margin - borderWidth / 2)
    ctx.strokeStyle = defaults.haloColor
    ctx.lineWidth = haloWidth
    shapePath(ctx, shape, size, margin - borderWidth / 2 - haloWidth / 2)
    ctx.stroke()
  }

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
    properties['marker-image-url'] || properties['marker-symbol'] || '',
    Number(properties['marker-size']) || defaultPointSize({ properties }),
    '0' ].join('|')
}

// The name of the halo ring of a shaped marker. KEEP IN SYNC with shapeHaloImage() in styles.js.
const shapeHaloImageName = properties => [ 'shape-' + (properties['marker-shape'] || 'circle'),
  'transparent', 'transparent', '',
  Number(properties['marker-size']) || defaultPointSize({ properties }), '1' ].join('|')

// Which points the map draws as one image. KEEP IN SYNC with shapedPoint() in styles.js.
const isShapedPoint = feature => feature.geometry?.type === 'Point' &&
  ((feature.properties?.['marker-shape'] || 'circle') !== 'circle' || (!!feature.properties?.['marker-symbol'] && !feature.properties?.['marker-image-url']))

// Drops the shape images that no feature uses any more. A missing image is drawn again by the
// resolver of maplibre (see loadImage), so a prune that goes too far repairs itself.
export function pruneShapeImages (features) {
  const keep = new Set(features.filter(isShapedPoint)
    .flatMap(feature => [shapeImageName(feature.properties), shapeHaloImageName(feature.properties)]))
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

// The background of a label: a rounded box with a soft shadow, which maplibre stretches to the
// text (see 'icon-text-fit'). Only the middle row and column stretch, so the corners keep their
// radius. 'content' leaves the shadow out, so the box ends where the fit padding ends.
const LABEL_MARGIN = 5
// the outline of the map title and the mode toggle, see map.css
const LABEL_BORDER = 1.5
const LABEL_BORDER_COLOR = '#BBB'

// MapLibre draws an image inside a label text at the size of the image, so the pixel ratio
// scales the icon to the label text.
const INLINE_ICON_SIZE = 14

// Loads the icon of an 'inline-icon|<url>' name, for use in a 'format' text-field. A transparent
// placeholder stands in until it loads, so that MapLibre does not ask for it again.
export function inlineIconImage (name) {
  if (map.hasImage(name)) { return }
  map.addImage(name, { width: 1, height: 1, data: new Uint8Array(4) })
  map.loadImage(name.slice('inline-icon|'.length)).then(({ data }) => {
    if (!map.hasImage(name)) { return }
    map.removeImage(name)
    map.addImage(name, data, { pixelRatio: data.width / INLINE_ICON_SIZE })
  }).catch(error => console.error(`Failed to load image ${name}: ` + error))
}

// Draws the image of a 'label-<color>|<radius>' name and adds it as a map image.
export function labelImage (name) {
  const [ color, radius ] = name.slice('label-'.length).split('|')
  const ratio = pixelRatio()
  const edge = LABEL_MARGIN + Number(radius)
  const size = 2 * edge + 2
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size * ratio
  const ctx = canvas.getContext('2d')
  ctx.scale(ratio, ratio)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(LABEL_MARGIN, LABEL_MARGIN, size - 2 * LABEL_MARGIN, size - 2 * LABEL_MARGIN, Number(radius))
  ctx.fill()

  // like a box-shadow ring, the border lies outside of the box
  const outset = LABEL_BORDER / 2
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = LABEL_BORDER_COLOR
  ctx.lineWidth = LABEL_BORDER
  ctx.beginPath()
  ctx.roundRect(LABEL_MARGIN - outset, LABEL_MARGIN - outset,
    size - 2 * (LABEL_MARGIN - outset), size - 2 * (LABEL_MARGIN - outset), Number(radius) + outset)
  ctx.stroke()

  const px = value => value * ratio
  map.addImage(name, ctx.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: ratio,
    stretchX: [[px(edge), px(size - edge)]],
    stretchY: [[px(edge), px(size - edge)]],
    content: [px(LABEL_MARGIN), px(LABEL_MARGIN), px(size - LABEL_MARGIN), px(size - LABEL_MARGIN)]
  })
}

// Draws the image of a 'halo|<marker-size>|<url>' name: a ring around the outline of the image,
// so a rounded icon (see ImagesController#icon) and a transparent png get a halo of their shape.
// The silhouette of the image, moved around in a circle, covers the outline, and the image itself
// gets cut out of it. The canvas grows by the halo, so the image on top keeps its size. The map
// draws an image at 'marker-size' / 60, so the halo gets that much wider in image pixels.
export async function haloImage (name) {
  const [, size, ...url] = name.split('|')
  // MapLibre checks for the image right after the resolver, see the placeholder in loadImage
  map.addImage(name, { width: 1, height: 1, data: new Uint8Array(4) })
  let image
  try {
    image = (await map.loadImage(url.join('|'))).data
  } catch (error) {
    console.error(`Failed to load image ${url.join('|')}: ` + error)
    return
  }
  const pad = Math.ceil(defaults.haloWidth * 60 / Number(size))
  const canvas = document.createElement('canvas')
  canvas.width = image.width + 2 * pad
  canvas.height = image.height + 2 * pad
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8
    ctx.drawImage(image, pad + pad * Math.cos(angle), pad + pad * Math.sin(angle))
  }
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = defaults.haloColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(image, pad, pad)
  // the image can be gone after a style change, and the placeholder has another size
  if (map.hasImage(name)) { map.removeImage(name) }
  map.addImage(name, ctx.getImageData(0, 0, canvas.width, canvas.height))
}
