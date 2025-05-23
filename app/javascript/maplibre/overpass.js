import { layers, redrawGeojson } from 'maplibre/map'

export function loadOverpassLayers() {
  layers.filter(f => f.type === 'overpass').forEach((layer) => {
    console.log('Loading overpass layer ' + layer.id)
    fetch("https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        // The body contains the query, Note: newlines (\n) break
        body: '[out:json];' + layer.query
      })
    // overpass xml to geojson: https://github.com/tyrasd/osmtogeojson
    .then( response => { return response.json() } )
    .then( data => {
      console.log('Received from overpass-api.de', data)
      const geojson = osmtogeojson(data)
      console.log('osmtogeojson', geojson)
      layer.geojson = geojson
      redrawGeojson()
    })
    .catch(error => {
      console.error('Failed to fetch overpass:', error)
    })
  })
}
