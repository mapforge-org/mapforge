// Converts the style attributes of other apps into the simplestyle attributes of Mapforge.
// A conversion never replaces an attribute that the feature already has.
import { hexColor } from 'helpers/functions'

// The Leaflet path options. uMap draws with Leaflet, so its _umap_options use them as well.
const LEAFLET_KEYS = ['color', 'weight', 'opacity', 'fillColor', 'fillOpacity', 'dashArray']
// Garmin names that mean another color in CSS, or that CSS does not know
const GARMIN_COLORS = { Green: 'lime', DarkYellow: 'olive' }
const OSMAND_WIDTHS = { thin: 2, medium: 4, bold: 6 }

// hexColor() cannot report an invalid color, so a valid but improbable fallback marks one
const INVALID = '#010203'
// a large file repeats a few colors, and each hexColor() call parses through a canvas
const hexCache = new Map()
function hex (color) {
  if (typeof color !== 'string') { return undefined }
  if (!hexCache.has(color)) {
    const value = hexColor(color, INVALID)
    hexCache.set(color, value === INVALID ? undefined : value)
  }
  return hexCache.get(color)
}

const isPoint = (type) => type === 'Point' || type === 'MultiPoint'
const isPolygon = (type) => type === 'Polygon' || type === 'MultiPolygon'
const colorKey = (type) => isPoint(type) ? 'marker-color' : 'stroke'
const opacityKey = (type) => isPoint(type) ? 'marker-opacity' : 'stroke-opacity'
const assignMissing = (target, values) => {
  for (const [key, value] of Object.entries(values)) { target[key] ??= value }
}

// GeoJSON allows a feature without geometry, but every caller that reads feature.geometry.type
// trips over it, and the server rejects it anyway. For KML, skipNullGeometry in kml.js drops them already.
export const compatFeatures = (features, umapDefaults) => features.filter(f => f.geometry).map(f =>
  ({ ...f, properties: compatProperties(f.properties, f.geometry.type, umapDefaults) }))

// umapDefaults: the _umap_options of the uMap layer and map, which the feature options override
export function compatProperties (props = {}, geometryType, umapDefaults) {
  const out = { ...props }
  if (umapDefaults || out._umap_options) {
    umap(out, { ...umapDefaults, ...out._umap_options }, geometryType)
  } else if (['color', 'weight', 'fillColor'].some(key => out[key] !== undefined)) {
    const style = leafletStyle(out, geometryType)
    LEAFLET_KEYS.forEach(key => delete out[key])
    // Leaflet switches stroke and fill off with false, simplestyle names a color there
    if (typeof out.stroke === 'boolean') { delete out.stroke }
    if (typeof out.fill === 'boolean') { delete out.fill }
    assignMissing(out, style)
  }
  osmand(out, geometryType)
  garmin(out, geometryType)
  return out
}

function leafletStyle (options, geometryType) {
  const style = {}
  const point = isPoint(geometryType)
  const polygon = isPolygon(geometryType)
  const color = hex(options.color)
  if (color) { style[colorKey(geometryType)] = color }
  if (options.opacity != null) { style[opacityKey(geometryType)] = Number(options.opacity) }
  if (!point && options.weight != null) { style['stroke-width'] = Number(options.weight) }
  if (!point && options.dashArray) { style['stroke-dasharray'] = true }
  if (options.stroke === false) { style.stroke = 'transparent' }
  if (polygon) {
    // Leaflet fills with the line color and an opacity of 0.2, Mapforge with blue at 0.9
    const fill = hex(options.fillColor) || color
    if (fill) {
      style.fill = fill
      style['fill-opacity'] = Number(options.fillOpacity ?? 0.2)
    }
    if (options.fill === false) { style.fill = 'transparent' }
  }
  return style
}

function umap (out, options, geometryType) {
  const style = leafletStyle(options, geometryType)
  if (isPoint(geometryType)) {
    const icon = options.iconUrl
    // An uMap icon is an image URL or a character. A relative URL points to the uMap server.
    if (/^(https?:|data:image\/)/.test(icon || '')) {
      style['marker-image-url'] = icon
    } else if (icon && !icon.includes('/')) {
      style['marker-symbol'] = icon
    }
    // the default uMap marker is a drop shaped pin
    if (!style['marker-image-url'] && !['Circle', 'Ball'].includes(options.iconClass)) { style['marker-shape'] = 'pin' }
  }
  if (out.name) {
    style.title = out.name
    if (options.showLabel) { style.label = out.name }
    delete out.name
  }
  if (typeof out.description === 'string') { out.description = umapMarkdown(out.description) }
  delete out._umap_options
  assignMissing(out, style)
}

// uMap has its own syntax for links, images and iframes. Bold, italic and headings are markdown already.
function umapMarkdown (text) {
  return text
    // Mapforge shows no iframes, so the iframe becomes a link
    .replace(/\{\{\{([^|}]+)(?:\|[^}]*)?\}\}\}/g, '[$1]($1)')
    .replace(/\{\{([^|}]+)(?:\|[^}]*)?\}\}/g, '![]($1)')
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '[$2]($1)')
    .replace(/\[\[([^\]]+)\]\]/g, '<$1>')
}

// A uMap backup (.umap) has the map properties, the view and one FeatureCollection per layer.
// It returns the same shape as importFile() in kml.js.
export function importUmap (json) {
  const props = json.properties || {}
  const map = {}
  if (props.name) { map.name = props.name }
  if (props.description) { map.description = umapMarkdown(props.description) }
  if (json.geometry?.coordinates) { map.center = json.geometry.coordinates }
  if (props.zoom != null) { map.zoom = Number(props.zoom) }

  const layers = (json.layers || []).map(layer => {
    const options = layer._umap_options || {}
    return {
      type: 'geojson',
      name: options.name || 'uMap layer',
      show: options.displayOnLoad !== false,
      heatmap: options.type === 'Heat',
      cluster: options.type === 'Cluster',
      // the map properties hold the style defaults of all layers
      geojson: { type: 'FeatureCollection', features: compatFeatures(layer.features || [], { ...props, ...options }) }
    }
  })
  return { layers, features: [], map }
}

// togeojson flattens the GPX extension <osmand:color> to 'osmand_color'
function osmand (out, geometryType) {
  if (out.osmand_color) {
    // OsmAnd writes #AARRGGBB, CSS reads #RRGGBBAA
    const argb = /^#([0-9a-f]{2})([0-9a-f]{6})$/i.exec(out.osmand_color)
    const color = argb ? `#${argb[2].toLowerCase()}` : hex(out.osmand_color)
    if (color) { out[colorKey(geometryType)] ??= color }
    if (argb && argb[1].toLowerCase() !== 'ff') {
      out[opacityKey(geometryType)] ??= Math.round(parseInt(argb[1], 16) / 2.55) / 100
    }
    delete out.osmand_color
  }
  if (out.osmand_width) {
    const width = OSMAND_WIDTHS[out.osmand_width] ?? Number(out.osmand_width)
    if (!Number.isNaN(width)) { out['stroke-width'] ??= width }
    delete out.osmand_width
  }
}

// <gpxx:TrackExtension><gpxx:DisplayColor>, togeojson keeps the text of both elements
function garmin (out, geometryType) {
  const name = out.gpxx_DisplayColor
  if (!name) { return }
  const color = hex(GARMIN_COLORS[name] || name)
  if (color) { out[colorKey(geometryType)] ??= color }
  delete out.gpxx_DisplayColor
  delete out.gpxx_TrackExtension
  delete out.gpxx_RouteExtension
}

// uMap exports GPX with this library and no creator of its own. The export keeps only
// name and description, in uMap syntax, and no style.
export function compatGpx (xmlDoc, features) {
  if (xmlDoc.documentElement.getAttribute('creator') !== '@dwayneparton/geojson-to-gpx') { return features }
  features.forEach(f => {
    if (f.properties.description) { f.properties.description = umapMarkdown(f.properties.description) }
  })
  return features
}
