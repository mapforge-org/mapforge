import { map, layers, redrawGeojson } from 'maplibre/map'

export function loadOverpassLayers() {
  layers.filter(f => f.type === 'overpass').forEach((layer) => {
    console.log('Loading overpass layer ' + layer.id)
    let query = layer.query

    // settings block
    query = "[out:json][timeout:25][bbox:{{bbox}}];" + query
    query = replaceBboxWithMapRectangle(query)

    console.log('Overpass query ', query)
    fetch("https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        // The body contains the query, Note: newlines (\n) break
        body: query
      })
    // overpass xml to geojson: https://github.com/tyrasd/osmtogeojson
    .then( response => { return response.json() } )
    .then( data => {
      console.log('Received from overpass-api.de', data)
      let geojson = osmtogeojson(data)
      console.log('osmtogeojson', geojson)
      geojson = styleOverpassLayers(geojson)
      layer.geojson = geojson
      redrawGeojson()
    })
    .catch(error => {
      console.error('Failed to fetch overpass:', error)
    })
  })
}

function replaceBboxWithMapRectangle(query) {
  // Get the current map bounds (returns a LngLatBounds object)
  const bounds = map.getBounds()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  // Create a bbox array: [minLat, minLon, maxLat, maxLon]
  const bbox = [sw.lat, sw.lng, ne.lat, ne.lng]
  // Replace all occurrences of {{bbox}} with the rectangle string
  return query.replace(/\{\{bbox\}\}/g, bbox.join(","))
}

function styleOverpassLayers(geojson) {
  geojson.features.forEach( f => {
    f.properties["label"] = f.properties["name"]
    f.properties["desc"] = f.properties["website"]
    if (['no', 'customers'].includes(f.properties['internet_access:fee'])) {
       f.properties["marker-symbol"] = "🛜"
    }
    if (['toilets'].includes(f.properties.amenity)) {
       f.properties["marker-symbol"] = "🚻"
       f.properties["desc"] = f.properties?.notes
    }
    if (f.properties['amenity'] === 'post_box') {
       f.properties["marker-symbol"] = "📯"
    }
    if (f.properties?.subway === 'yes') {
       f.properties["marker-symbol"] = "🚇"
    }
    if (f.properties?.train === 'yes') {
       f.properties["marker-symbol"] = "🚆"
    }
    if (f.properties?.tourism === 'camp_site') {
       f.properties["marker-symbol"] = "🏕️"
    }
    if (f.properties?.craft === 'brewery') {
       f.properties["marker-symbol"] = "🍻"
    }
  })
  return geojson
}
