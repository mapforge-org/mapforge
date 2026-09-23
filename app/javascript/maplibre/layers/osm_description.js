import * as functions from 'helpers/functions'

const elementCache = new Map()

/**
 * Loads a single OSM element by its id, for example "way/12345".
 * @returns {Promise<object|null>} the element with its tags, or null when the request fails
 */
export async function fetchOsmElement(osmId) {
  if (elementCache.has(osmId)) { return elementCache.get(osmId) }

  try {
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/${osmId}.json`)
    if (!response.ok) {
      console.warn(`Failed to fetch OSM element ${osmId}: ${response.status}`)
      return null
    }
    const element = (await response.json()).elements?.[0] || null
    elementCache.set(osmId, element)
    return element
  } catch (error) {
    console.warn(`Failed to fetch OSM element ${osmId}: ${error.message}`)
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
  'addr:housenumber', 'website', 'url', 'image']

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

// 'File:X.jpg' of wikimedia_commons, or a commons page url, or a direct url to an image file
function osmImageUrl(key, value) {
  if (key !== 'image' && key !== 'wikimedia_commons') { return null }

  const commonsFile = value.match(/^(?:https?:\/\/commons\.wikimedia\.org\/wiki\/)?(File:.+)$/)?.[1]
  if (commonsFile) {
    // no encodeURIComponent, the name in a commons page url is percent encoded already
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${commonsFile.slice(5).replace(/ /g, '_')}?width=400`
  }
  if (/^https?:\/\/.+\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i.test(value)) {
    // img_src of the content security policy allows https only, many OSM image tags are plain http
    return value.replace(/^http:/i, 'https:')
  }
  return null
}

function osmValueHtml(key, value, primaryKey) {
  const escaped = functions.escapeHtml(value)
  if (value === 'yes') { return `<i class="bi bi-check-lg osm-yes"></i> ${escaped}` }
  if (value === 'no') { return `<i class="bi bi-x-lg osm-no"></i> ${escaped}` }
  if (key === primaryKey) { return `<span class="osm-chip">${escaped}</span>` }
  if (OSM_CODE_KEYS.includes(key)) { return `<code class="osm-code">${escaped}</code>` }

  const link = osmLink(key, value)
  const image = osmImageUrl(key, value)
  if (image) {
    return `<a href="${functions.escapeHtml(link || value)}" target="_blank">` +
      `<img class="osm-image" src="${functions.escapeHtml(image)}" alt="${escaped}" loading="lazy"></a>`
  }
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

function wikiLink(str) {
  const [lang, title] = str.split(':')
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
}
