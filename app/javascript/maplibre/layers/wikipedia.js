import { map, layers, addGeoJSONSource, redrawGeojson } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'

export function initializeWikipediaLayers(id = null) {
  console.log('Initializing Wikipedia layers')
  let initLayers = layers.filter(l => l.type === 'wikipedia')
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  initLayers.forEach((layer) => {
    addGeoJSONSource('wikipedia-source-' + layer.id, false)
    initializeViewStyles('wikipedia-source-' + layer.id)
    loadWikipediaLayer(layer.id)
    })
}

// similar: https://github.com/styluslabs/maps/blob/master/assets/plugins/wikipedia-search.js
export function loadWikipediaLayer(id) {
  const layer = layers.find(f => f.id === id)
  const url = "https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=geosearch&gslimit=500&gsradius="
    + "5000&gscoord=" + map.getCenter().lat + "%7C" + map.getCenter().lng

  functions.e('#layer-reload', e => { e.classList.add('hidden') })
  functions.e('#layer-loading', e => { e.classList.remove('hidden') })

  return fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was not ok') }
      return response.json()
    })
    .then(data => {
      layer.geojson = wikipediatoGeoJSON(data)
      redrawGeojson()
      functions.e('#layer-loading', e => { e.classList.add('hidden') })
    })
    .catch(error => {
      console.error('Failed to fetch wikipedia for ' + layer.id, error)
      status('Failed to load layer ' + layer.name, 'error')
      functions.e(`#layer-list-${layer.id} .reload-icon`, e => { e.classList.remove('layer-refresh-animate') })
      functions.e('#layer-loading', e => { e.classList.add('hidden') })
    })
}


function wikipediatoGeoJSON(data) {
  let geoJSON = {
    "type": "FeatureCollection",
    "features": []
  }
  data['query']['geosearch'].forEach( entry => {
    let feature = {
      "id": functions.featureId(),
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [entry.lon, entry.lat]
      },
      "properties": {
        "title": entry.title,
        "pageid": entry.pageid,
        "dist": entry.dist,
        "desc": "https://en.wikipedia.org/?curid=" + entry.pageid,
        "marker-image-url": "/icons/wikipedia.png",
        "marker-color": "white",
        "marker-size": "20"
      }
    }
    geoJSON.features.push(feature)
  })
  console.log(geoJSON)
  return geoJSON
}

