import { animateElement } from 'helpers/dom'
import * as functions from 'helpers/functions'
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import { resetSearchLayer, searchLayer } from 'maplibre/layers/search'
import { map } from 'maplibre/map'

const PHOTON_LANGS = ['de', 'en', 'fr', 'it']

// Noto emoji per photon category, drawn both on the map marker and in the result list.
// Places and boundaries are told apart by their type, everything else by its osm key.
const CATEGORIES = {
  aeroway: '✈',
  amenity: '☕',
  building: '🏠',
  city: '🏙',
  country: '🌍',
  county: '🗺',
  district: '🏘',
  highway: '🛣',
  historic: '🏛',
  house: '🏠',
  leisure: '🌳',
  locality: '🏘',
  natural: '🌳',
  railway: '🚆',
  shop: '🛍',
  state: '🗺',
  street: '🛣',
  tourism: '📷',
  waterway: '💧'
}
const DEFAULT_CATEGORY = '📍'

function categorySymbol (p) {
  const key = (p.osm_key === 'place' || p.osm_key === 'boundary') ? p.type : p.osm_key
  return CATEGORIES[key] || CATEGORIES[p.type] || DEFAULT_CATEGORY
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
  const [title, ...address] = item.place_name.split(',')
  return `<div class="geocoder-result">` +
    `<img class="geocoder-result-icon" src="/emojis/noto/${categorySymbol(item.properties)}.png" alt="">` +
    `<div class="geocoder-result-text">` +
    `<div class="geocoder-result-title">${escapeHtml(title)}</div>` +
    `<div class="geocoder-result-address">${escapeHtml(address.join(',').trim())}</div>` +
    `</div></div>`
}

// transparent marker-color and stroke leave only the emoji visible, and let the
// style pick the white halo of the active state (see points-layer in styles.js)
function toMapFeature (item) {
  const [title] = item.place_name.split(',')
  return {
    type: 'Feature',
    id: functions.featureId(),
    geometry: item.geometry,
    properties: {
      ...item.properties,
      title: title,
      label: title,
      desc: item.place_name,
      'marker-symbol': categorySymbol(item.properties),
      'marker-size': '30',
      'marker-color': 'transparent',
      stroke: 'transparent'
    }
  }
}

// kept here as well as on the layer, so the source only gets built once there is
// something to show, and so it survives the basemap change that drops it
let results = []

function showResults (items) {
  results = items.map(toMapFeature)
  searchLayer().setResults(results)
}

// https://maplibre.org/maplibre-gl-geocoder/types/MaplibreGeocoderOptions.html
// https://photon.komoot.io/
export const geocoderConfig = {
  forwardGeocode: async (config) => {
    const params = new URLSearchParams({ q: config.query, limit: config.limit || 5 })
    const lang = document.documentElement.lang.split('-')[0]
    if (PHOTON_LANGS.includes(lang)) { params.set('lang', lang) }
    // photon prefers results around this point and scales that preference with the zoom.
    // taken from the map, the geocoder drops its own proximity below zoom 9.
    const center = map.getCenter()
    params.set('lon', center.lng.toFixed(5))
    params.set('lat', center.lat.toFixed(5))
    params.set('zoom', Math.round(map.getZoom()))
    try {
      const response = await fetch(`https://photon.komoot.io/api/?${params}`)
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
      return { features: [] }
    }
  }
}

export function initializeSearchControl () {
  // runs once per map, so this is also where the results of the previous map are dropped
  resetSearchLayer()
  results = []

  // https://maplibre.org/maplibre-gl-geocoder/
  const geocoder = new MaplibreGeocoder(geocoderConfig, {
    maplibregl,
    zoom: 16,
    flyTo: { maxZoom: 16 },
    clearAndBlurOnEsc: true,
    // photon is built for typeahead, the control debounces the requests by 200ms
    showResultsWhileTyping: true,
    // the built-in markers only appear together with a fit of the map bounds
    marker: false,
    showResultMarkers: false,
    render: renderResult
  })
  map.addControl(geocoder, 'top-right')

  // a picked result stays highlighted, a listed one only while the pointer is on its row
  let picked = false
  geocoder.on('results', e => {
    picked = false
    showResults(e.features)
  })
  geocoder.on('result', e => {
    picked = true
    showResults([e.result])
    searchLayer().setActive(0)
  })
  geocoder.on('clear', () => {
    picked = false
    results = []
    searchLayer().clearResults()
  })

  // a basemap change drops every source, so the visible results need a re-render
  map.on('style.load', () => {
    if (results.length) { searchLayer().setResults(results) }
  })

  const geocoderButton = document.querySelector('.maplibregl-ctrl-geocoder')
  geocoderButton.classList.add('hidden')
  const searchIcon = document.querySelector('.maplibregl-ctrl-geocoder--icon-search')
  searchIcon.addEventListener('click', (_e) => { geocoderButton.classList.toggle('expanded') })

  // the result list keeps the order of the markers
  geocoderButton.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.suggestions > li')
    if (item) { searchLayer().setActive([...item.parentNode.children].indexOf(item)) }
  })
  geocoderButton.addEventListener('mouseleave', (_e) => { searchLayer().setActive(picked ? 0 : -1) })

  map.once('load', function (_e) {
    // delayed via timeout, the geocoders !important transition overrides data-aos-delay
    setTimeout(() => { animateElement('.maplibregl-ctrl-geocoder', 'fade-left') }, 500)
  })
}
