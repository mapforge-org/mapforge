import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import { bbox } from '@turf/bbox'
import { animateElement } from 'helpers/dom'
import * as functions from 'helpers/functions'
import { featureIcon, featureTitle, getFeatureTypeName, highlightFeature, highlightedFeatureId } from 'maplibre/feature'
import { getFeature, getFeatureSource, getLayer, layers } from 'maplibre/layers/layers'
import { MARKER_LABEL_OFFSET, MARKER_OPACITY, MARKER_SIZE, resetSearchLayer, resultMarkerImage, searchLayer } from 'maplibre/layers/search'
import { map } from 'maplibre/map'

const PHOTON_LANGS = ['de', 'en', 'fr', 'it']
const PHOTON_LIMIT = 12
const RESULT_ZOOM = 14

// Noto emoji per photon osm_value, the most specific hint photon gives.
// A value that two osm keys share with a different meaning stays out of here, for
// example 'residential', a district under landuse but a street under highway.
const VALUES = {
  restaurant: '🍽', fast_food: '🍔', cafe: '☕', bar: '🍸', pub: '🍺',
  biergarten: '🍺', ice_cream: '🍦', food_court: '🍽',

  supermarket: '🛒', convenience: '🛒', bakery: '🥖', deli: '🥖', butcher: '🥩',
  greengrocer: '🥬', confectionery: '🍫', alcohol: '🍷', wine: '🍷', kiosk: '🏪',

  mall: '🏬', department_store: '🏬', clothes: '👕', shoes: '👟', jewelry: '💍',
  optician: '👓', beauty: '💄', hairdresser: '💇', florist: '💐', books: '📚',
  toys: '🧸', furniture: '🪑', doityourself: '🛠', hardware: '🛠',
  electronics: '📱', mobile_phone: '📱', computer: '💻', gift: '🎁',
  laundry: '🧺', pet: '🐕', sports: '⚽', car: '🚗', car_repair: '🔧', bicycle: '🚲',

  hotel: '🏨', motel: '🏨', apartment: '🏨', guest_house: '🛏', hostel: '🛏',
  camp_site: '🏕', caravan_site: '🚐',

  hospital: '🏥', clinic: '🏥', doctors: '🩺', dentist: '🦷', pharmacy: '💊',
  chemist: '💊', veterinary: '🐕',

  bank: '🏦', atm: '🏧', post_office: '📮', police: '🚓', fire_station: '🚒',
  townhall: '🏛', community_centre: '🏛', library: '📚', toilets: '🚻',
  drinking_water: '🚰',

  school: '🏫', kindergarten: '🧸', university: '🎓', college: '🎓',

  fuel: '⛽', charging_station: '⚡', parking: '🅿', car_wash: '🚿',
  car_rental: '🚗', bicycle_rental: '🚲', taxi: '🚕', bus_station: '🚌',
  bus_stop: '🚏', tram_stop: '🚊', subway_entrance: '🚇', station: '🚉',
  train_station: '🚉', railway: '🚆', ferry_terminal: '⛴', aerodrome: '✈',
  terminal: '✈', marina: '⛵',

  park: '🌳', garden: '🌳', dog_park: '🐕', playground: '🛝', pitch: '⚽',
  sports_centre: '🏋', fitness_centre: '🏋', swimming_pool: '🏊', water_park: '🏊',
  stadium: '🏟', golf_course: '⛳', bowling_alley: '🎳', climbing: '🧗',
  casino: '🎰', nature_reserve: '🏞',

  museum: '🏛', gallery: '🖼', artwork: '🗿', theatre: '🎭', cinema: '🎬',
  zoo: '🦁', theme_park: '🎡', attraction: '🎡', viewpoint: '🌄',
  picnic_site: '🧺', castle: '🏰', ruins: '🏚', monument: '🗿', memorial: '🗿',
  archaeological_site: '⛏',

  place_of_worship: '⛪', church: '⛪', mosque: '🕌', synagogue: '🕍',
  temple: '🛕', cemetery: '🪦',

  peak: '⛰', volcano: '🌋', glacier: '🏔', cave_entrance: '🕳', spring: '💧',
  water: '💧', waterfall: '💧', wood: '🌲', forest: '🌲', beach: '🏖',
  beach_resort: '🏖', island: '🏝', farmland: '🌾',

  retail: '🏬', industrial: '🏭', commercial: '💼', tower: '🗼', bridge: '🌉',

  town: '🏙', village: '🏘', suburb: '🏘'
}

// Fallback for a value that VALUES does not list. Places and boundaries are told
// apart by their type, everything else by its osm key.
const CATEGORIES = {
  aeroway: '✈',
  amenity: '☕',
  barrier: '🚧',
  building: '🏠',
  city: '🏙',
  country: '🌍',
  county: '🗺',
  craft: '🔧',
  district: '🏘',
  emergency: '🚑',
  healthcare: '🏥',
  highway: '🛣',
  historic: '🏛',
  house: '🏠',
  landuse: '🏞',
  leisure: '🌳',
  locality: '🏘',
  man_made: '🏗',
  military: '🪖',
  natural: '🌳',
  office: '💼',
  power: '⚡',
  public_transport: '🚉',
  railway: '🚆',
  shop: '🛍',
  sport: '⚽',
  state: '🗺',
  street: '🛣',
  tourism: '📷',
  waterway: '💧'
}
const DEFAULT_CATEGORY = '📍'

function categorySymbol (p) {
  const key = (p.osm_key === 'place' || p.osm_key === 'boundary') ? p.type : p.osm_key
  return VALUES[p.osm_value] || CATEGORIES[key] || CATEGORIES[p.type] || DEFAULT_CATEGORY
}

// photon matches the query against the name, so 'cafe' only finds places that carry
// the word in their name. The osm_values of VALUES are the vocabulary of categories,
// a query out of it goes to the reverse endpoint instead, which filters by osm_tag.
function categoryValue (query) {
  const term = query.trim().toLowerCase().replace(/\s+/g, '_')
  if (VALUES[term]) { return term }
  const singular = term.replace(/s$/, '')
  return VALUES[singular] ? singular : null
}

// Place names come from OSM, so they can carry markup
function escapeHtml (text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Photon returns the address in parts, nominatim returned one preformatted display_name
function placeName (p) {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  const city = [p.postcode, p.city].filter(Boolean).join(' ')
  return [...new Set([p.name, street, city, p.state, p.country].filter(Boolean))].join(', ')
}

function renderResult (item) {
  if (item.mapFeatureId) { return renderFeatureResult(item) }
  const [title, ...address] = item.place_name.split(',')
  return `<div class="geocoder-result">` +
    `<img class="geocoder-result-icon" src="/emojis/noto/${categorySymbol(item.properties)}.png" alt="">` +
    `<div class="geocoder-result-text">` +
    `<div class="geocoder-result-title">${escapeHtml(title)}</div>` +
    `<div class="geocoder-result-address">${escapeHtml(address.join(',').trim())}</div>` +
    `</div></div>`
}

// Features of the open map, the icon is the one the layers modal shows for them
function renderFeatureResult (item) {
  const feature = getFeature(item.mapFeatureId)
  return `<div class="geocoder-result">` +
    `<span class="geocoder-result-icon flex-center">${feature ? featureIcon(feature, { link: false }) : ''}</span>` +
    `<div class="geocoder-result-text">` +
    `<div class="geocoder-result-title">${escapeHtml(item.place_name)}</div>` +
    `<div class="geocoder-result-address">${escapeHtml(featureSubtitle(item.mapFeatureId, feature))}</div>` +
    `</div></div>`
}

// the default layer of a map carries no name, then the type of the feature says more
function featureSubtitle (id, feature) {
  return getLayer(id)?.name || (feature ? getFeatureTypeName(feature) : '')
}

const MAX_FEATURE_RESULTS = 3

// Hit list of the open map, the geocoder puts it in front of the photon results.
// Hidden layers are left out, a hit there would not be drawn after the fly to it.
function mapFeatures (query) {
  const term = query.trim().toLowerCase()
  if (!term) { return [] }
  const items = []
  for (const layer of (layers || []).filter(l => l.show !== false)) {
    for (const feature of (layer.geojson?.features || [])) {
      const title = featureTitle(feature)
      if (!title.toLowerCase().includes(term)) { continue }
      items.push(toResultItem(feature, title))
      if (items.length === MAX_FEATURE_RESULTS) { return items }
    }
  }
  return items
}

// The geocoder needs a geometry, and takes the camera from bbox and center. A point
// geometry keeps the item small, the feature itself stays behind its id.
function toResultItem (feature, title) {
  const box = bbox(feature)
  const center = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: center },
    properties: feature.properties,
    place_name: title,
    text: title,
    place_type: ['feature'],
    bbox: box,
    center: center,
    mapFeatureId: feature.id
  }
}

// the circle and the emoji of a result are one image, so that the circle of the next result
// cannot cover the emoji of this one. marker-symbol stays for the icon of the details panel,
// and for a copy of the result to a layer of the map.
function toMapFeature (item) {
  const [title] = item.place_name.split(',')
  const symbol = categorySymbol(item.properties)
  return {
    type: 'Feature',
    id: functions.featureId(),
    geometry: item.geometry,
    properties: {
      ...item.properties,
      title: title,
      label: title,
      desc: item.place_name,
      'marker-symbol': symbol,
      'marker-image-url': resultMarkerImage(symbol),
      'marker-size': MARKER_SIZE,
      // one image has one size, so the hovered result answers with its opacity
      'marker-opacity': MARKER_OPACITY,
      'label-offset': MARKER_LABEL_OFFSET
    }
  }
}

// kept here as well as on the layer, so the source only gets built once there is
// something to show, and so it survives the basemap change that drops it
let results = []
// features of the open map, they keep the first rows of the list
let featureResults = []
// the items of the geocoder, in the order of the rows, a picked one arrives as the same object
let resultItems = []
let activeFeature = null

function showResults (items) {
  setActiveFeature(null)
  resultItems = items
  featureResults = items.filter(i => i.mapFeatureId).map(i => getFeature(i.mapFeatureId)).filter(Boolean)
  // a feature of the map is drawn by its own layer already, a copy would double the marker
  results = items.filter(i => !i.mapFeatureId).map(toMapFeature)
  searchLayer().setResults(results)
}

function setFeatureState (feature, active) {
  const source = getFeatureSource(feature.id)
  if (source) { map.setFeatureState({ source: source, id: feature.id }, { active: active }) }
}

function setActiveFeature (feature) {
  // a picked feature keeps the sticky highlight of showFeatureDetails
  if (activeFeature && activeFeature.id !== highlightedFeatureId) { setFeatureState(activeFeature, false) }
  activeFeature = feature
  if (feature) { setFeatureState(feature, true) }
}

// the row index counts the features of the map first, the search layer holds the rest
function setActiveResult (index) {
  const feature = index < 0 ? null : featureResults[index]
  setActiveFeature(feature)
  searchLayer().setActive(feature ? -1 : index - featureResults.length)
}

// the newest request and its url, the older requests answer with its result
let latest = null
let latestUrl = null

// https://photon.komoot.io/
function photonUrl (query) {
  // fixed, the geocoder limit also counts the rows that the features of the map take
  const params = new URLSearchParams({ limit: PHOTON_LIMIT })
  const lang = document.documentElement.lang.split('-')[0]
  if (PHOTON_LANGS.includes(lang)) { params.set('lang', lang) }
  // photon prefers results around this point and scales that preference with the zoom.
  // taken from the map, the geocoder drops its own proximity below zoom 9.
  const center = map.getCenter()
  params.set('lon', center.lng.toFixed(5))
  params.set('lat', center.lat.toFixed(5))
  const category = categoryValue(query)
  if (category) {
    params.set('osm_tag', `:${category}`)
    // reverse sorts by distance, so a wide radius only appends the far away places.
    // the view sets it, with a floor, so that a deep zoom still fills the list.
    const km = center.distanceTo(map.getBounds().getNorthEast()) / 1000
    params.set('radius', Math.max(10, km).toFixed(0))
  } else {
    params.set('q', query)
    params.set('zoom', Math.round(map.getZoom()))
  }
  return `https://photon.komoot.io/${category ? 'reverse' : 'api/'}?${params}`
}

async function photonFeatures (url) {
  try {
    const response = await fetch(url)
    const geojson = await response.json()
    return {
      features: geojson.features.map(feature => {
        const name = placeName(feature.properties)
        const extent = feature.properties.extent
        return {
          type: 'Feature',
          geometry: feature.geometry,
          properties: feature.properties,
          place_name: name,
          text: name,
          place_type: ['place'],
          // photon extent is [west, north, east, south], a geojson bbox is [west, south, east, north]
          bbox: extent && [extent[0], extent[3], extent[2], extent[1]],
          center: feature.geometry.coordinates
        }
      })
    }
  } catch (e) {
    console.error(`Failed to forward Geocode with error: ${e}`)
    // the empty answer must not become the cached one, a return has to retry the url
    latestUrl = null
    return { features: [] }
  }
}

// https://maplibre.org/maplibre-gl-geocoder/types/MaplibreGeocoderOptions.html
export const geocoderConfig = {
  forwardGeocode: async (config) => {
    const url = photonUrl(config.query)
    // the same url means that neither the query nor the view changed, for example a
    // return right after typing. the answer of the request before it still holds.
    if (url !== latestUrl) {
      latestUrl = url
      latest = photonFeatures(url)
    }
    let request = latest
    let result = await request
    // the geocoder renders every answer, and the two endpoints of photon do not answer
    // at the same speed, so an older request can arrive last. it repeats the newest
    // result instead of putting a stale list in front of the user.
    while (latest !== request) {
      request = latest
      result = await request
    }
    return result
  }
}

export function initializeSearchControl () {
  // runs once per map, so this is also where the results of the previous map are dropped
  resetSearchLayer()
  results = []
  featureResults = []
  resultItems = []
  activeFeature = null
  latestUrl = null

  // https://maplibre.org/maplibre-gl-geocoder/
  const geocoder = new MaplibreGeocoder(geocoderConfig, {
    maplibregl,
    zoom: RESULT_ZOOM,
    flyTo: { maxZoom: RESULT_ZOOM },
    clearAndBlurOnEsc: true,
    // photon is built for typeahead, and the control debounces the requests
    showResultsWhileTyping: true,
    debounceSearch: 400,
    // the built-in markers only appear together with a fit of the map bounds
    marker: false,
    showResultMarkers: false,
    // the features of the open map, the geocoder puts them in front of the photon results
    localGeocoder: mapFeatures,
    // the photon results plus the features of the map, the list cuts off at this number
    limit: PHOTON_LIMIT + MAX_FEATURE_RESULTS,
    render: renderResult,
    // the default writes the name of the picked result into the field, keep the typed text
    getItemValue: () => document.querySelector('.maplibregl-ctrl-geocoder--input').value
  })
  map.addControl(geocoder, 'top-right')

  // a pick zooms in to RESULT_ZOOM, a view that is closer already keeps its zoom. the
  // geocoder reads both options at the moment it flies, so they follow the map.
  function followZoom () {
    geocoder.options.zoom = Math.max(RESULT_ZOOM, map.getZoom())
    geocoder.options.flyTo.maxZoom = geocoder.options.zoom
  }
  followZoom()
  map.on('zoomend', followZoom)

  // row of the picked result, it stays highlighted, a listed one only while the pointer is on it
  let picked = -1
  geocoder.on('results', e => {
    picked = -1
    showResults(e.features)
  })
  geocoder.on('result', e => {
    // the other results stay on the map, only the picked one gets the highlight
    picked = resultItems.indexOf(e.result)
    setActiveResult(picked)
    const feature = featureResults[picked] || results[picked - featureResults.length]
    if (!feature) { return }
    // the search layer is no member of layers, so getFeatureSource does not know it
    const source = getFeatureSource(feature.id) || searchLayer().sourceId
    // the geocoder fits the map to the bbox of the feature, the details open after that
    map.once('moveend', () => { highlightFeature(feature, true, source) })
  })
  geocoder.on('clear', () => {
    picked = -1
    results = []
    setActiveFeature(null)
    featureResults = []
    resultItems = []
    searchLayer().clearResults()
  })

  // a basemap change drops every source and every image, so the visible results need a
  // re-render, and their marker image a re-draw in the color of the new basemap
  map.on('style.load', () => {
    if (!results.length) { return }
    results.forEach(f => { f.properties['marker-image-url'] = resultMarkerImage(f.properties['marker-symbol']) })
    searchLayer().setResults(results)
  })

  const geocoderButton = document.querySelector('.maplibregl-ctrl-geocoder')
  geocoderButton.classList.add('hidden')
  geocoderButton.setAttribute('title', window.__('Search location'))
  geocoderButton.setAttribute('data-toggle', 'tooltip')
  geocoderButton.setAttribute('data-bs-trigger', 'hover')

  function setExpanded (expanded) {
    geocoderButton.classList.toggle('expanded', expanded)
    // the tooltip belongs to the collapsed button, expanded it would cover the result list
    const tooltip = window.bootstrap?.Tooltip.getInstance(geocoderButton)
    if (!tooltip) { return }
    if (expanded) {
      tooltip.hide()
      tooltip.disable()
    } else {
      tooltip.enable()
    }
  }

  // the whole button opens the field, inside the open field only the icon closes it again
  geocoderButton.addEventListener('click', (e) => {
    const expanded = geocoderButton.classList.contains('expanded')
    if (expanded && !e.target.closest('.maplibregl-ctrl-geocoder--icon-search')) { return }
    setExpanded(!expanded)
  })

  // photon ranks by the map view, so return runs the same query again after a move.
  // the typeahead stops the event when return picks a row of the list, that one is no search.
  geocoderButton.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') { geocoder.setInput(e.target.value) }
  })

  // the result list keeps the order of the markers
  geocoderButton.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.suggestions > li')
    if (item) { setActiveResult([...item.parentNode.children].indexOf(item)) }
  })
  geocoderButton.addEventListener('mouseleave', (_e) => { setActiveResult(picked) })

  map.once('load', function (_e) {
    // delayed via timeout, the geocoders !important transition overrides data-aos-delay
    setTimeout(() => { animateElement('.maplibregl-ctrl-geocoder', 'fade-left') }, 500)
  })
}
