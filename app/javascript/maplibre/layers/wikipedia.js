import { map } from 'maplibre/map'
import { initializeViewStyles, initializeClusterStyles } from 'maplibre/styles/styles'
import * as functions from 'helpers/functions'
import { initLayersModal } from 'maplibre/controls/shared'
import { status } from 'helpers/status'
import { layers } from 'maplibre/layers/layers'

export function initializeWikipediaLayers(id = null) {
  // console.log('Initializing Wikipedia layers')
  let initLayers = layers.filter(l => l.type === 'wikipedia')
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  return initLayers.map((layer) => {
    initializeViewStyles('wikipedia-source-' + layer.id)
    initializeClusterStyles('wikipedia-source-' + layer.id, "/icons/wikipedia.png")

    return loadWikipediaLayer(layer.id).then(() => { if (id) { initLayersModal() } })
  })
}

// similar: https://github.com/styluslabs/maps/blob/master/assets/plugins/wikipedia-search.js
export function loadWikipediaLayer(id) {
  const layer = layers.find(f => f.id === id)
  const url = "https://en.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=geosearch&gslimit=500&gsradius="
    + "5000&gscoord=" + map.getCenter().lat + "%7C" + map.getCenter().lng

  return fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was not ok') }
      return response.json()
    })
    .then(data => {
      layer.geojson = wikipediatoGeoJSON(data)
      renderWikipediaLayer(layer.id)
    })
    .catch(error => {
      console.error('Failed to fetch wikipedia for ' + layer.id, error)
      status('Failed to load layer ' + layer.name, 'error')
    })
}

export function renderWikipediaLayer(id) {
  let layer = layers.find(l => l.id === id)
  console.log("Redraw: Setting source data for wikipedia layer", layer)

  // TODO: only needed once, not each render
  // this + `promoteId: 'id'` is a workaround for the maplibre limitation:
  // https://github.com/mapbox/mapbox-gl-js/issues/2716
  // because to highlight a feature we need the id,
  // and in the style layers it only accepts mumeric ids in the id field initially
  layer.geojson.features.forEach((feature) => { feature.properties.id = feature.id })
  map.getSource(layer.type + '-source-' + layer.id).setData(layer.geojson, false)
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
        "label": entry.title,
        "wikipediaId": entry.pageid,
        "marker-image-url": "/icons/wikipedia.png",
        "marker-color": "white",
        "marker-size": "20"
      }
    }
    geoJSON.features.push(feature)
  })
  return geoJSON
}

