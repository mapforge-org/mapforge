import { animateElement } from 'helpers/dom'
import MaplibreGeocoder from '@maplibre/maplibre-gl-geocoder'
import { map } from 'maplibre/map'

const PHOTON_LANGS = ['de', 'en', 'fr', 'it']

// Bootstrap icon per photon category. Places and boundaries are told apart by their type,
// everything else by its osm key.
const CATEGORY_ICONS = {
  aeroway: 'bi-airplane',
  amenity: 'bi-cup-hot',
  building: 'bi-house-door',
  city: 'bi-building',
  country: 'bi-globe-americas',
  county: 'bi-map',
  district: 'bi-buildings',
  highway: 'bi-signpost-2',
  historic: 'bi-bank',
  house: 'bi-house-door',
  leisure: 'bi-tree',
  locality: 'bi-houses',
  natural: 'bi-tree',
  railway: 'bi-train-front',
  shop: 'bi-shop',
  state: 'bi-map',
  street: 'bi-signpost-2',
  tourism: 'bi-camera',
  waterway: 'bi-water'
}

let resultMarkers = []

function categoryIcon (p) {
  const category = (p.osm_key === 'place' || p.osm_key === 'boundary') ? p.type : p.osm_key
  return CATEGORY_ICONS[category] || CATEGORY_ICONS[p.type] || 'bi-geo-alt'
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
    `<i class="bi ${categoryIcon(item.properties)} geocoder-result-icon"></i>` +
    `<div class="geocoder-result-text">` +
    `<div class="geocoder-result-title">${escapeHtml(title)}</div>` +
    `<div class="geocoder-result-address">${escapeHtml(address.join(',').trim())}</div>` +
    `</div></div>`
}

function showResultMarkers (features) {
  removeResultMarkers()
  resultMarkers = features.map(feature => {
    const element = document.createElement('div')
    element.className = 'search-marker'
    element.innerHTML = `<i class="bi ${categoryIcon(feature.properties)} search-marker-pin"></i>`
    return new maplibregl.Marker({ element }).setLngLat(feature.center).addTo(map)
  })
}

function removeResultMarkers () {
  resultMarkers.forEach(marker => marker.remove())
  resultMarkers = []
}

// -1 dims all of them again
function highlightResultMarker (index) {
  resultMarkers.forEach((marker, i) => {
    marker.getElement().classList.toggle('active', i === index)
  })
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
    showResultMarkers(e.features)
  })
  geocoder.on('result', e => {
    picked = true
    showResultMarkers([e.result])
    highlightResultMarker(0)
  })
  geocoder.on('clear', () => {
    picked = false
    removeResultMarkers()
  })

  const geocoderButton = document.querySelector('.maplibregl-ctrl-geocoder')
  geocoderButton.classList.add('hidden')
  const searchIcon = document.querySelector('.maplibregl-ctrl-geocoder--icon-search')
  // the tooltip sits on the icon and the input, not on the control, else it also covers the result list
  const searchInput = document.querySelector('.maplibregl-ctrl-geocoder--input')
  for (const element of [searchIcon, searchInput]) {
    element.setAttribute('title', window.__('Search location'))
    element.setAttribute('data-toggle', 'tooltip')
    element.setAttribute('data-bs-trigger', 'hover')
  }
  searchIcon.addEventListener('click', (_e) => { geocoderButton.classList.toggle('expanded') })

  // the result list keeps the order of the markers
  geocoderButton.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.suggestions > li')
    if (item) { highlightResultMarker([...item.parentNode.children].indexOf(item)) }
  })
  geocoderButton.addEventListener('mouseleave', (_e) => { highlightResultMarker(picked ? 0 : -1) })

  map.once('load', function (_e) {
    // delayed via timeout, the geocoders !important transition overrides data-aos-delay
    setTimeout(() => { animateElement('.maplibregl-ctrl-geocoder', 'fade-left') }, 500)
  })
}
