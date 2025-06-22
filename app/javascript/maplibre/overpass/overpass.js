import { map, layers, redrawGeojson, addGeoJSONSource } from 'maplibre/map'
import { applyOverpassQueryStyle, getQueryTemplate } from 'maplibre/overpass/queries'
import { initializeViewStyles, initializeClusterStyles } from 'maplibre/styles'
import * as functions from 'helpers/functions'

export function loadOverpassLayers() {
  layers.filter(l => l.type === 'overpass').forEach((layer) => {
    const clustered = !!getQueryTemplate(layer.name)?.cluster
    addGeoJSONSource('overpass-source-' + layer.id, clustered)
    initializeViewStyles('overpass-source-' + layer.id)
    if (clustered) {
      initializeClusterStyles('overpass-source-' + layer.id, getQueryTemplate(layer.name).clusterIcon)
    }
    if (!layer.geojson) { loadOverpassLayer(layer.id) }
  })
}

export function loadOverpassLayer(id) {
  const layer = layers.find(f => f.id === id)
  if (!layer?.query) { return Promise.resolve() }
  console.log('Loading overpass layer', layer)
  let query = layer.query

  // settings block
  query = "[out:json][timeout:25][bbox:{{bbox}}];" + query
  query = replaceBboxWithMapRectangle(query)

  return fetch("https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      // The body contains the query, Note: newlines (\n) break
      body: query
    })
  // overpass xml to geojson: https://github.com/tyrasd/osmtogeojson
  .then( response => { return response.json() } )
  .then( data => {
    //console.log('Received from overpass-api.de', data)
    let geojson = osmtogeojson(data)
    // console.log('osmtogeojson', geojson)
    geojson = applyOverpassStyle(geojson, query)
    layer.geojson = applyOverpassQueryStyle(geojson, layer.name)
    redrawGeojson()
    functions.e('#maplibre-map', e => { e.setAttribute('data-overpass-loaded', true) })
  })
  .catch(error => {
    console.error('Failed to fetch overpass for ' + layer.id, error)
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

function applyOverpassStyle(geojson, query) {
  geojson.features.forEach( f => {
    f.properties["label"] = f.properties["name"]
    f.properties["desc"] = overpassDescription(f.properties)
    if (query.includes("out skel;")) { f.properties["heatmap"] = true }
    if (f.properties['amenity'] === 'post_box') {
      f.properties["marker-symbol"] = "📯"
    }

    // https://wiki.openstreetmap.org/wiki/Key:osmc:symbol?uselang=en
    // osmc:symbol=waycolor:background[:foreground][:foreground2][:text:textcolor]
    if ((f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
      && f.properties['osmc:symbol']) {
      const parts = f.properties['osmc:symbol'].split(':')

      f.properties["stroke"] = parts[0]
      f.properties["stroke-width"] = "2"
      f.properties["stroke-image-url"] = "/icon/osmc/" + f.properties['osmc:symbol']
    // render 'ref' name as label on bike routes without osmc:symbol
    } else if (f.properties["route"] === 'bicycle' && f.properties["ref"]){
      f.properties["label"] = f.properties["ref"]
    }
  })
  return geojson
}

function overpassDescription(props) {
  let desc = ''
  if (props["description"]) { desc += props["description"] + '\n\n' }
  if (props["notes"]) { desc += props["notes"] + '\n' }
  if (props["website"]) { desc += props["website"] + '\n' }
  if (props["url"]) { desc += props["url"] + '\n' }
  { desc += '```\n' + JSON.stringify(props, null, 2) + '\n```\n' }

  desc += '\n' + '![osm link](/icons/osm-icon-small.png)'
  desc += '\n' + '[' + props['id'] + '](https://www.openstreetmap.org/' + props['id'] + ')'

  return desc
}
