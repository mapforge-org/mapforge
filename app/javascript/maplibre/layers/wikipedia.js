import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { initLayersModal } from 'maplibre/controls/shared'
import { layers } from 'maplibre/layers/layers'
import { map } from 'maplibre/map'
import { initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

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

export function loadWikipediaLayer(id) {
  const layer = layers.find(f => f.id === id)
  // query API docs: https://en.wikipedia.org/w/api.php?action=help&modules=query
  // Cannot include article previews in geo search
  const url = "https://de.wikipedia.org/w/api.php?origin=*&action=query&format=json&list=geosearch&gslimit=200&gsradius="
    + "10000&gscoord=" + map.getCenter().lat + "%7C" + map.getCenter().lng

  return fetch(url)
    .then(response => {
      if (!response.ok) { throw new Error('Network response was not ok') }
      return response.json()
    })
    .then(data => {
      if (data.error) { throw new Error('API error: ' + data.error.info ) }
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

export async function wikipediaFeatureDescription(feature) {
  const page = encodeURIComponent(feature.properties.title)
  const api = `https://de.wikipedia.org/api/rest_v1/page/summary/${page}`
  const url = `https://de.wikipedia.org/wiki/${page}`

  const data = await fetch(api).then(r => r.json())
  let desc = ''
  if (data.thumbnail?.source) {
    desc += `<p><a target="_blank" href="${url}">` +
      `<img class="w-100" src="${data.thumbnail.source}"></a></p>`
  }
  desc += `<p>${data.extract}</p>`
  desc += `<p><img src="/icons/wikipedia.png" class="me-1 ms-1 icon"/><a target="_blank" href="${url}">Wikipedia article</a></p>`

  return desc
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
