import { map, layers, redrawGeojson, addGeoJSONSource, viewUnchanged, sortLayers } from 'maplibre/map'
import { applyOverpassQueryStyle } from 'maplibre/overpass/queries'
import { initializeViewStyles, initializeClusterStyles } from 'maplibre/styles'
import * as functions from 'helpers/functions'
import { initLayersModal } from 'maplibre/controls/shared'
import { status } from '../../helpers/status'

export function initializeOverpassLayers(id = null) {
  let initLayers = layers.filter(l => l.type === 'overpass')
  if (id) { initLayers = initLayers.filter(l => l.id === id)  }
  initLayers.forEach((layer) => {
    const clustered = !layer.query.includes("heatmap=true") && 
      !layer.query.includes("cluster=false") && 
      !layer.query.includes("geom") // clustering breaks lines & geometries
    // TODO: changing cluster setup requires a map reload
    addGeoJSONSource('overpass-source-' + layer.id, clustered)
    initializeViewStyles('overpass-source-' + layer.id)
    if (clustered) {
      const clusterIcon = getCommentValue(layer.query, 'cluster-symbol') || getCommentValue(layer.query, 'cluster-image-url') || 
        getCommentValue(layer.query, 'marker-symbol') || getCommentValue(layer.query, 'marker-image-url')
      initializeClusterStyles('overpass-source-' + layer.id, clusterIcon)
    }
    // use server's pre-loaded geojson if available and map is at default center
    if (layer.geojson?.features?.length && viewUnchanged()) { 
      layer.geojson = applyOverpassStyle(layer.geojson, layer.query)
      layer.geojson = applyOverpassQueryStyle(layer.geojson, layer.name)      
      redrawGeojson()
    } else {
      // layer with id comes from the layers modal, reload modal
      loadOverpassLayer(layer.id).then(() => { if (id) { initLayersModal() } })
    }
  })
  sortLayers()
}

export function loadOverpassLayer(id) {
  const layer = layers.find(f => f.id === id)
  if (!layer?.query) { return Promise.resolve() }
  let query = layer.query

  const beforeSemicolon = query.split(';')[0]
  // query already comes with a settings block
  if (/\[bbox|\[timeout|\[out/.test(beforeSemicolon)) {
    if (!query.includes("[bbox")) { query = "[bbox:{{bbox}}]" + query } 
    if (!query.includes("[timeout")) { query = "[timeout:25]" + query }
    if (!query.includes("[out")) { query = "[out:json]" + query }
  } else {
    query = "[out:json][timeout:25][bbox:{{bbox}}];\n" + query
  }
  query = replaceBboxWithMapRectangle(query)
  console.log('Loading overpass layer', layer, query)
  functions.e('#layer-reload', e => { e.classList.add('hidden') })
  functions.e('#layer-loading', e => { e.classList.remove('hidden') })

  return fetch("https://overpass-api.de/api/interpreter",
    {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      // The body contains the query, Note: newlines (\n) break
      body: query
    })
  // overpass xml to geojson: https://github.com/tyrasd/osmtogeojson
  .then( response => {
    if (!response.ok) {
      throw new Error(`HTTP status: ${response.status}`)
    }
    return response.json()
   } )
  .then( data => {
    // console.log('Received from overpass-api.de', data)
    let geojson = osmtogeojson(data)
    // console.log('osmtogeojson', geojson)
    geojson = applyOverpassStyle(geojson, query)
    layer.geojson = applyOverpassQueryStyle(geojson, layer.name)
    redrawGeojson()
    functions.e('#layer-loading', e => { e.classList.add('hidden') })
    functions.e('#maplibre-map', e => { e.setAttribute('data-overpass-loaded', true) })
  })
  .catch(error => {
    console.error('Failed to fetch overpass for ' + layer.id, error)
    status('Failed to load layer ' + layer.name, 'error')
    functions.e(`#layer-list-${layer.id} .reload-icon`, e => { e.classList.remove('layer-refresh-animate') })
    functions.e('#layer-loading', e => { e.classList.add('hidden') })
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
  const markerSymbol = getCommentValue(query, 'marker-symbol')
  const markerImageUrl = getCommentValue(query, 'marker-image-url')
  const heatmap = query.includes("heatmap=true")

  geojson.features.forEach( f => {
    f.properties["label"] = f.properties["name"]
    if (getCommentValue(query, 'label-property')) {
      f.properties["label"] = f.properties[getCommentValue(query, 'label-property')]
    }
    f.properties["desc"] = overpassDescription(f.properties)
    if (heatmap) { f.properties["heatmap"] = true }
    if (markerSymbol) {
      f.properties["marker-symbol"] = markerSymbol
      f.properties["marker-size"] = "30"
      f.properties["marker-color"] = "transparent"
      f.properties["stroke"] = "transparent"
    } else if (markerImageUrl) {
      f.properties["marker-image-url"] = markerImageUrl
      f.properties["marker-size"] = "30"
      f.properties["marker-color"] = "transparent"
      f.properties["stroke"] = "transparent"
    }
    if (getCommentValue(query, 'stroke')) { f.properties["stroke"] = getCommentValue(query, 'stroke') }
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

  desc += `\n**OSM tags:**\n 
  <div class="overpass-data-table">\n
  |               |               |
  | ------------- | ------------- |\n`
  const keys = Object.keys(props).filter(key => !['description', 'notes', 'website', 'url', 'id', 'label'].includes(key))
  keys.forEach(key => {
    desc += `| **${key}** | ${props[key]} |\n`
  })
  desc += '\n' + '</div>\n'

  desc += '\n' + '![osm link](/icons/osm-icon-small.png)'
  desc += '\n' + '[See node in OpenStreetMap](https://www.openstreetmap.org/' + props['id'] + ')'

  return desc
}

function getCommentValue(query, key) {
  // Match lines like: // key=value (with possible spaces)
  const regex = new RegExp(`^\\s*\\/\\/\\s*${key}\\s*=\\s*(.+)$`, "m")
  const match = query.match(regex)

  return match ? match[1].trim() : null
}