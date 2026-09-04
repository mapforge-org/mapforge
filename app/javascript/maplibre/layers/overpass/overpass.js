import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { addCopyToLayerMenuItem } from 'maplibre/controls/context_menu'
import { Layer } from 'maplibre/layers/layer'
import { layers } from 'maplibre/layers/layers'
import { applyOverpassQueryStyle } from 'maplibre/layers/overpass/queries'
import { map } from 'maplibre/map'
import { initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

export class OverpassLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.contextMenuHandler = null
  }

  initialize() {
    if (!this.layer.query) { return Promise.resolve() }

    initializeViewStyles(this.sourceId, this.layer.heatmap)
    const clustered = !this.layer.query.includes("heatmap=true") &&
      !this.layer.query.includes("cluster=false") &&
      !this.layer.query.includes("geom") // clustering breaks lines & geometries
    if (clustered) {
      const clusterIcon = getCommentValue(this.layer.query, 'cluster-symbol') || getCommentValue(this.layer.query, 'cluster-image-url') ||
        getCommentValue(this.layer.query, 'marker-symbol') || getCommentValue(this.layer.query, 'marker-image-url')
      const clusterColor = getCommentValue(this.layer.query, 'cluster-color') || getCommentValue(this.layer.query, 'marker-color')
      initializeClusterStyles(this.sourceId, clusterIcon, clusterColor)
    }
    this.setupEventHandlers()
    return this.loadData()
  }

  setupEventHandlers() {
    super.setupEventHandlers()

    this.contextMenuHandler = (e) => {
      e.preventDefault()
      const queryLayerIds = this.getStyleLayerIds()
      const features = map.queryRenderedFeatures(e.point, { layers: queryLayerIds })

      const rendered = features.find(f => !f.properties?.cluster)
      if (rendered) {
        addCopyToLayerMenuItem(this.geojson.features.find(f => f.id === rendered.id))
      }
    }
    map.on('contextmenu', this.contextMenuHandler)
  }

  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.contextMenuHandler) {
      map.off('contextmenu', this.contextMenuHandler)
      this.contextMenuHandler = null
    }
  }

  /**
   * Built on demand, so the tags stay the only copy of the element in the feature.
   * A query template can put its own text into desc, that text opens the body.
   */
  description(feature) {
    return [feature.properties.desc, overpassDescription(feature.properties.osm)]
      .filter(Boolean).join('\n\n')
  }

  reloadAfterMapMove() {
    if (!this.layer.query) { return false }
    // Only show reload button if query uses dynamic bbox template
    // Queries with hardcoded bbox coordinates should not trigger reload
    return (this.layer.query.includes('{{bbox}}') || !this.layer.query.includes('[bbox')) ? 'ondemand' : false
  }

  loadData() {
    if (!this.layer.query) { return Promise.resolve() }
    let query = this.layer.query

    const beforeSemicolon = query.split(';')[0]
    // query already comes with a settings block
    if (/\[bbox|\[timeout|\[out/.test(beforeSemicolon)) {
      if (!query.includes("[bbox")) { query = "[bbox:{{bbox}}]" + query }
      if (!query.includes("[timeout")) { query = "[timeout:25]" + query }
      if (!query.includes("[out")) { query = "[out:json]" + query }
    } else {
      query = "[out:json][timeout:25][bbox:{{bbox}}];\n" + query
    }
    query = replaceBboxWithMapRectangle(query)
    console.log('Loading overpass layer', this.layer)

    return fetch("https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        // The body contains the query, Note: newlines (\n) break
        body: query
      })
    // overpass xml to geojson: https://github.com/tyrasd/osmtogeojson
    .then( response => {
      if (!response.ok) {
        throw new Error(`HTTP status: ${response.status}`)
      }
      return response.json()
     } )
    .then( data => {
      let geojson = osmtogeojson(data)
      geojson = applyOverpassStyle(geojson, query)
      this.layer.geojson = applyOverpassQueryStyle(geojson, this.layer.name)
      this.render()
      functions.e('#maplibre-map', e => { e.setAttribute('data-overpass-loaded', true) })
    })
    .catch(error => {
      console.error('Failed to fetch overpass for ' + this.id, this.layer.query, error.message)
      // return if layer is gone (likely page change)
      if (!layers || !layers.includes(this)) { return }
      status(window.__('Failed to load layer %{name}').replace('%{name}', this.layer.name), 'error')
      // Set empty geojson so layer can still render
      this.layer.geojson = { type: 'FeatureCollection', features: [] }
      this.render()
      return false
    })
  }
}

// Standalone utility exports

const tagCache = new Map()

/**
 * Tags of one osm element, for example ('node', 240109189). 'out tags' leaves the geometry
 * out, the caller has it already.
 * @returns {Promise<object|null>} the tags, or null when the request fails
 */
export async function fetchOverpassTags(type, id) {
  const key = `${type}/${id}`
  if (tagCache.has(key)) { return tagCache.get(key) }

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: `[out:json][timeout:25];${type}(${id});out tags;`
    })
    if (!response.ok) { throw new Error(`HTTP status: ${response.status}`) }

    const tags = (await response.json()).elements?.[0]?.tags || null
    tagCache.set(key, tags)
    return tags
  } catch (error) {
    console.warn(`Failed to fetch overpass tags for ${key}: ${error.message}`)
    return null
  }
}

// keys that carry the free text above the cards, or that the modal header shows already
const OSM_SKIP_KEYS = ['description', 'notes', 'id', 'label', 'name', 'type', 'meta', 'relations', 'tainted']
// the address cards holds these, in this order, one line per group
const OSM_ADDRESS_LINES = [['addr:street', 'addr:housenumber'],
  ['addr:postcode', 'addr:city', 'addr:state', 'addr:country']]
// the tag that says what the element is, the subtitle and the first row of the details show it
const OSM_PRIMARY_KEYS = ['amenity', 'shop', 'tourism', 'leisure', 'historic', 'natural',
  'man_made', 'office', 'craft', 'healthcare', 'building', 'highway', 'railway', 'waterway',
  'landuse', 'place', 'boundary']
// a value of these keys is a schedule, a monospace block keeps its columns readable
const OSM_CODE_KEYS = ['opening_hours', 'service_times', 'collection_times', 'happy_hours']
// taginfo has no page for a free text value, and a personal one must not leave the modal
const OSM_NO_TAGINFO_KEYS = ['wikipedia', 'wikidata', 'wikimedia_commons', 'email', 'phone', 'operator',
  'addr:housenumber', 'website', 'url']

// 'outdoor_seating' -> 'Outdoor Seating', 'contact:phone' -> 'Contact Phone'
function osmLabel(key) {
  return key.replace(/[_:]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function osmLink(key, value) {
  if (key === 'wikipedia') { return wikiLink(value) }
  if (key === 'wikidata') { return `https://www.wikidata.org/wiki/${encodeURIComponent(value)}` }
  if (key === 'wikimedia_commons') { return `https://commons.wikimedia.org/wiki/${encodeURIComponent(value)}` }
  return null
}

function osmValueHtml(key, value, primaryKey) {
  const escaped = functions.escapeHtml(value)
  if (value === 'yes') { return `<i class="bi bi-check-lg osm-yes"></i> ${escaped}` }
  if (value === 'no') { return `<i class="bi bi-x-lg osm-no"></i> ${escaped}` }
  if (key === primaryKey) { return `<span class="osm-chip">${escaped}</span>` }
  if (OSM_CODE_KEYS.includes(key)) { return `<code class="osm-code">${escaped}</code>` }

  const link = osmLink(key, value)
  if (link) { return `<a href="${link}" target="_blank">${escaped}</a>` }
  // a website tag often drops the scheme, without it the browser reads the value as a relative path
  if (/^https?:\/\//.test(value)) { return `<a href="${escaped}" target="_blank">${escaped}</a>` }
  if (/^www\./.test(value)) { return `<a href="https://${escaped}" target="_blank">${escaped}</a>` }
  return escaped
}

// the label doubles as the taginfo link, so the rows stay free of icons
function osmLabelHtml(key, value) {
  const label = functions.escapeHtml(osmLabel(key))
  if (OSM_NO_TAGINFO_KEYS.includes(key)) { return label }

  const url = `https://taginfo.openstreetmap.org/tags/${encodeURIComponent(key)}=${encodeURIComponent(value)}`
  return `<a class="osm-key-link" href="${url}" target="_blank" title="${functions.escapeHtml(key)}">${label}</a>`
}

function osmRow(label, valueHtml, extraClass = '') {
  return `<div class="osm-row ${extraClass}"><span class="osm-key">${label}</span>` +
    `<span class="osm-value">${valueHtml}</span></div>`
}

function osmCard(title, rows) {
  if (!rows.length) { return '' }
  return `<div class="feature-section-card osm-card">` +
    `<div class="feature-section-title">${functions.escapeHtml(title)}</div>${rows.join('')}</div>`
}

function osmAddressHtml(props) {
  const lines = OSM_ADDRESS_LINES
    .map(group => group.map(key => props[key]).filter(Boolean).join(' '))
    .filter(Boolean)
  if (!lines.length) { return '' }

  return lines.map(line => functions.escapeHtml(line)).join('<br>')
}

/**
 * Details modal body for an element of OpenStreetMap. Returns markdown, so the free text
 * of the element keeps its formatting, followed by one html block with the tag cards.
 */
export function overpassDescription(props) {
  let desc = ''
  if (props["description"]) { desc += props["description"] + '\n\n' }
  if (props["notes"]) { desc += props["notes"] + '\n\n' }

  const primaryKey = OSM_PRIMARY_KEYS.find(key => props[key])
  const subtitle = [primaryKey && osmLabel(props[primaryKey]), 'OpenStreetMap Data'].filter(Boolean)
  const address = osmAddressHtml(props)

  const detailRows = Object.keys(props)
    .filter(key => !OSM_SKIP_KEYS.includes(key) && !key.startsWith('addr:'))
    // the tag that names the element opens the list, the rest keeps the order of the element
    .sort((a, b) => (a === primaryKey ? -1 : 0) - (b === primaryKey ? -1 : 0))
    .map(key => osmRow(osmLabelHtml(key, props[key]), osmValueHtml(key, props[key], primaryKey),
      OSM_CODE_KEYS.includes(key) ? 'osm-row-block' : ''))

  const osmUrl = `https://www.openstreetmap.org/${props['id']}`

  desc += `<div class="osm-details">` +
    `<div class="osm-subtitle">${functions.escapeHtml(subtitle.join(' • '))}</div>` +
    osmCard(window.__('Location'), address ? [osmRow(window.__('Address'), address, 'osm-row-address')] : []) +
    osmCard(window.__('Details'), detailRows) +
    `<div class="osm-actions">` +
    `<a class="btn btn-sm btn-secondary osm-action" href="${osmUrl}" target="_blank">` +
    `<i class="bi bi-box-arrow-up-right me-1"></i>${functions.escapeHtml(window.__('Edit in OSM'))}</a>` +
    `</div></div>`

  return desc
}

// Private helpers

function getCommentValue(query, key) {
  // Match lines like: // key=value (with possible spaces)
  const regex = new RegExp(`^\\s*\\/\\/\\s*${key}\\s*=\\s*(.+)$`, "m")
  const match = query.match(regex)

  return match ? match[1].trim() : null
}

function replaceBboxWithMapRectangle(query) {
  const bounds = map.getBounds()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const bbox = [sw.lat, sw.lng, ne.lat, ne.lng]
  return query.replace(/\{\{bbox\}\}/g, bbox.join(","))
}

function applyOverpassStyle(geojson, query) {
  const markerSymbol = getCommentValue(query, 'marker-symbol')
  const markerImageUrl = getCommentValue(query, 'marker-image-url')
  const heatmap = query.includes("heatmap=true")

  geojson.features.forEach( f => {
    // osmtogeojson runs with flatProperties, so the properties are the tags of the element
    // plus its id. They move under 'osm', the top level is for the style keys of mapforge.
    const osm = f.properties
    f.properties = { osm: osm }
    f.properties["label"] = osm["name"]
    if (getCommentValue(query, 'label-property')) {
      f.properties["label"] = osm[getCommentValue(query, 'label-property')]
    }
    if (heatmap) { f.properties["heatmap"] = true }
    if (getCommentValue(query, 'marker-color')) { f.properties["marker-color"] = getCommentValue(query, 'marker-color') }
    if (markerSymbol) {
      f.properties["marker-symbol"] = markerSymbol
      f.properties["marker-size"] = "30"
      f.properties["marker-color"] = "transparent"
      f.properties["stroke"] = "transparent"
    } else if (markerImageUrl) {
      f.properties["marker-image-url"] = markerImageUrl
      f.properties["marker-size"] = "30"
      f.properties["marker-color"] = "transparent"
      f.properties["stroke"] = "transparent"
    }
    if (getCommentValue(query, 'stroke')) { f.properties["stroke"] = getCommentValue(query, 'stroke') }
    if (getCommentValue(query, 'stroke-width')) { f.properties["stroke-width"] = getCommentValue(query, 'stroke-width') }
    if (getCommentValue(query, 'fill')) { f.properties["fill"] = getCommentValue(query, 'fill') }
    if (getCommentValue(query, 'fill-opacity')) { f.properties["fill-opacity"] = getCommentValue(query, 'fill-opacity') }
    // https://wiki.openstreetmap.org/wiki/Key:osmc:symbol?uselang=en
    // osmc:symbol=waycolor:background[:foreground][:foreground2][:text:textcolor]
    if ((f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
      && osm['osmc:symbol']) {
      const parts = osm['osmc:symbol'].split(':')
      f.properties["stroke"] = parts[0]
      f.properties["stroke-width"] = "2"
      f.properties["stroke-image-url"] = "/icon/osmc/" + osm['osmc:symbol']
      // render 'ref' name as label on bike routes without osmc:symbol
    } else if (osm["route"] === 'bicycle' && osm["ref"]){
      f.properties["label"] = osm["ref"]
    }
  })
  return geojson
}

function wikiLink(str) {
  const [lang, title] = str.split(':')
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
}
