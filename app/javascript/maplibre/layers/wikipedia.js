import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { Layer } from 'maplibre/layers/layer'
import { map } from 'maplibre/map'
import { initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

export class WikipediaLayer extends Layer {
  initialize() {
    initializeViewStyles(this.sourceId)
    initializeClusterStyles(this.sourceId, "/icons/wikipedia.png")
    return this.loadData()
  }

  loadData() {
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
        this.layer.geojson = wikipediatoGeoJSON(data)
        this.render()
      })
      .catch(error => {
        console.error('Failed to fetch wikipedia for ' + this.id, error)
        status('Failed to load layer ' + this.layer.name, 'error')
      })
  }
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
