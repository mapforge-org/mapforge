// Converts KML/KMZ/GPX into the property names of Mapforge.
import { uploadImage } from 'maplibre/feature'
import { GOOGLE_ICONS } from 'maplibre/import/google_icons'
import { gpx, kmlWithFolders } from 'togeojson'

// G**gle My Maps points every colored pin at the same white silhouette. The real color rides
// in <IconStyle><color>, so using the href as marker image would paint every marker white.
const BLANK_PIN = /-blank_maps\.png$/

// ... and the icon itself is only in the style id, '#icon-<google id>-<color>'. A line or a
// polygon style is named '#line-...' or '#poly-...', so the regex passes over those.
const GOOGLE_STYLE = /^#?icon-(\d+)-/

// Consumed by the mapping below, or deliberately dropped. Everything else (ExtendedData
// fields, timestamp, timespan, stroke, fill, sym, ...) is copied through untouched.
const CONSUMED = [
  'name', 'description', 'address', 'phoneNumber', 'cmt', 'visibility', 'open',
  'styleUrl', 'styleHash', 'styleMapHash', 'coordinateProperties', 'links', '_gpxType',
  'icon', 'icon-color', 'icon-opacity', 'icon-scale', 'icon-heading',
  'icon-offset', 'icon-offset-units', 'label-scale', 'label-opacity', '@geometry-type'
]

const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' }

// Reads a KML, KMZ or GPX file and returns everything the importer needs:
//   layers: one definition per KML <Folder>, ready for layers_controller#createLayer
//   features: placemarks outside any folder, and every GPX feature
//   map: name, description and view read from the KML <Document>
export async function importFile (file, content) {
  const name = file.name.toLowerCase()
  const isKmz = file.type === 'application/vnd.google-earth.kmz' || name.endsWith('.kmz')
  let entries = new Map()
  let text = content

  if (isKmz) {
    entries = await unzip(content)
    const docName = [...entries.keys()].find(k => k.toLowerCase().endsWith('.kml'))
    if (!docName) { throw new Error(window.__('The KMZ archive contains no .kml document')) }
    text = new TextDecoder().decode(entries.get(docName))
  }

  const xmlDoc = new DOMParser().parseFromString(text, 'application/xml')
  if (xmlDoc.querySelector('parsererror')) { throw new Error(window.__('The file is not valid XML')) }

  if (file.type === 'application/gpx+xml' || name.endsWith('.gpx')) {
    const geojson = gpx(xmlDoc)
    const gpxFeatures = expandGeometryCollections(geojson.features)
    gpxFeatures.forEach(f => { f.properties = mapforgeProperties(f.properties) })
    return { layers: [], features: gpxFeatures, map: {} }
  }

  // skipNullGeometry is required: a <Model> placemark otherwise yields geometry: null,
  // which every caller reading feature.geometry.type trips over.
  const tree = kmlWithFolders(xmlDoc, { skipNullGeometry: true })
  const layers = []
  let features = []
  collect(tree, layers, features)
  features = expandGeometryCollections(features)
  layers.forEach(l => { l.geojson.features = expandGeometryCollections(l.geojson.features) })

  const all = features.concat(...layers.map(l => l.geojson.features))
  all.forEach(f => { f.properties = mapforgeProperties(f.properties) })
  if (isKmz) { await uploadPackedIcons(all, entries) }

  return { layers, features, map: documentProperties(xmlDoc) }
}

// Each <Folder> becomes one layer. Nested folders flatten into a layer of their own,
// placemarks outside any folder stay loose so they land in the default layer.
function collect (node, layers, loose) {
  for (const child of node.children) {
    if (child.type !== 'folder') { loose.push(child); continue }
    const layer = {
      type: 'geojson',
      name: child.meta?.name || 'KML folder',
      show: child.meta?.visibility !== '0',
      geojson: { type: 'FeatureCollection', features: [] }
    }
    layers.push(layer)
    collect(child, layers, layer.geojson.features)
  }
}

// togeojson turns every <MultiGeometry> placemark into a GeometryCollection, which has no
// geometry.coordinates: MapLibre draws nothing and the server rejects the feature, so the
// whole import silently loses it. Members of one type merge into the Multi* equivalent,
// a mixed collection splits into one feature per member.
function expandGeometryCollections (features) {
  return features.flatMap(feature => {
    if (feature.geometry?.type !== 'GeometryCollection') { return [ feature ] }
    const parts = feature.geometry.geometries || []
    if (parts.length === 0) { return [] }
    const types = [ ...new Set(parts.map(g => g.type)) ]
    if (types.length === 1) {
      return [ { ...feature, geometry: { type: `Multi${types[0]}`, coordinates: parts.map(g => g.coordinates) } } ]
    }
    return parts.map(geometry => ({ ...feature, geometry }))
  })
}

export function mapforgeProperties (props = {}) {
  const out = {}
  for (const [key, value] of Object.entries(props)) {
    if (!CONSUMED.includes(key)) { out[key] = value }
  }

  const isOverlay = props['@geometry-type'] === 'groundoverlay'
  const icon = props.icon
  const scale = props['icon-scale']
  const labelScale = props['label-scale']

  if (props.name) {
    out.title = props.name
    // KML hides a label with <LabelStyle><scale>0</scale>, everything else shows the name.
    if (labelScale === undefined || labelScale > 0) { out.label = props.name }
  }
  if (labelScale > 0 && labelScale !== 1) { out['label-size'] = Math.round(16 * labelScale) }

  const symbol = googleIconSymbol(props.styleUrl)
  // a pinhead icon is white, so it needs a white border to stand out from the marker color
  if (symbol) { out['marker-symbol'] = symbol; out.stroke = '#fff' }

  if (props['icon-color']) { out['marker-color'] = props['icon-color'] }
  if (props['icon-opacity'] !== undefined && props['icon-opacity'] !== 1) { out['marker-opacity'] = props['icon-opacity'] }
  if (props['icon-heading']) { out['marker-rotate'] = props['icon-heading'] }
  if (icon && !isOverlay && !BLANK_PIN.test(icon)) { out['marker-image-url'] = icon }
  // A KML icon is a small pictogram, so the mapforge default of 20 for an image marker
  // blows it up. A pinhead icon keeps a base of 16, smaller than the mapforge default
  // of 18 for an emoji. Plain markers keep the mapforge base of 6.
  const base = out['marker-image-url'] ? 10 : symbol ? 16 : 6
  if (out['marker-image-url'] || symbol || (scale !== undefined && scale !== 1)) {
    out['marker-size'] = Math.max(1, Math.round(base * (scale ?? 1)))
  }

  const desc = []
  if (props.desc) { desc.push(props.desc) }
  const description = typeof props.description === 'object' ? props.description?.value : props.description
  // KML descriptions are HTML. marked() renders it as is, but a plain newline edits better.
  if (description) { desc.push(description.replace(/<br\s*\/?>/gi, '\n')) }
  if (props.cmt && props.cmt !== props.desc) { desc.push(props.cmt) }
  if (props.address) { desc.push(props.address) }
  if (props.phoneNumber) { desc.push(props.phoneNumber) }
  // Mapforge has no image overlay layer, so a GroundOverlay keeps its box and shows the image.
  if (icon && isOverlay) { desc.push(`[![overlay](${icon})](${icon})`) }
  if (desc.length) { out.desc = desc.join('\n\n') }

  return out
}

function googleIconSymbol (styleUrl) {
  const match = GOOGLE_STYLE.exec(styleUrl || '')
  const icon = match && GOOGLE_ICONS[match[1]]
  return icon ? `/icon-sets/${icon}.png` : undefined
}

// <Document> name, description and view. Read straight off the DOM: the converter only
// returns features, and <Folder> meta would not carry the document level fields anyway.
function documentProperties (xmlDoc) {
  const doc = childOf(xmlDoc.documentElement, 'Document') || xmlDoc.documentElement
  const map = {}
  const name = childText(doc, 'name')
  const description = childText(doc, 'description')
  if (name) { map.name = name }
  if (description) { map.description = description.replace(/<br\s*\/?>/gi, '\n') }

  const view = childOf(doc, 'LookAt') || childOf(doc, 'Camera')
  const lng = num(childText(view, 'longitude'))
  const lat = num(childText(view, 'latitude'))
  if (lng !== undefined && lat !== undefined) {
    map.center = [lng, lat]
    map.bearing = num(childText(view, 'heading')) || 0
    map.pitch = num(childText(view, 'tilt')) || 0
    const range = num(childText(view, 'range')) ?? num(childText(view, 'altitude'))
    // assumes a ~800px viewport. Close enough to frame the import.
    if (range > 0) { map.zoom = Math.min(22, Math.max(0, 26.5 - Math.log2(range))) }
  }
  return map
}

const childOf = (node, tag) => Array.from(node?.children || []).find(c => c.tagName === tag)
const childText = (node, tag) => childOf(node, tag)?.textContent?.trim() || ''
const num = (text) => {
  const value = Number.parseFloat(text)
  return Number.isNaN(value) ? undefined : value
}

// A KMZ packs its icons next to doc.kml. Upload each one once and point the feature at
// the Mapforge copy, so the icon survives a reload.
async function uploadPackedIcons (features, entries) {
  const uploads = new Map()
  for (const feature of features) {
    const href = feature.properties['marker-image-url']
    if (!href || !entries.has(href)) { continue }
    if (!uploads.has(href)) {
      const name = href.split('/').pop()
      const type = IMAGE_TYPES[name.split('.').pop().toLowerCase()] || 'application/octet-stream'
      uploads.set(href, uploadImage(new File([entries.get(href)], name, { type })).then(data => data.icon))
    }
    feature.properties['marker-image-url'] = await uploads.get(href)
    feature.properties['marker-color'] = 'transparent'
    feature.properties.stroke = 'transparent'
  }
}

// central directory only, no zip64 and no encryption.
// Swap in fflate if a KMZ over 4GB or a split archive ever turns up.
async function unzip (buffer) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(window.__('This browser cannot read KMZ archives. Please unzip it and import the .kml'))
  }
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  // The End Of Central Directory record sits last, behind up to 65535 bytes of comment.
  let eocd = -1
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) { throw new Error(window.__('The file is not a zip archive')) }

  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const entries = new Map()

  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) { break }
    const method = view.getUint16(p + 10, true)
    const size = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen

    // The local header repeats name and extra field with its own lengths.
    const start = localOffset + 30 +
      view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true)
    const data = bytes.subarray(start, start + size)
    entries.set(name, method === 0 ? data : await inflateRaw(data))
  }
  return entries
}

async function inflateRaw (data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}
