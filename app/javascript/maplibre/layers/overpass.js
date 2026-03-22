import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { Layer } from 'maplibre/layers/layer'
import { applyOverpassQueryStyle } from 'maplibre/layers/queries'
import { map } from 'maplibre/map'
import { initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

export class OverpassLayer extends Layer {
  initialize() {
    if (!this.layer.query) { return Promise.resolve() }

    initializeViewStyles(this.sourceId, this.layer.heatmap)
    const clustered = !this.layer.query.includes("heatmap=true") &&
      !this.layer.query.includes("cluster=false") &&
      !this.layer.query.includes("geom") // clustering breaks lines & geometries
    if (clustered) {
      const clusterIcon = getCommentValue(this.layer.query, 'cluster-symbol') || getCommentValue(this.layer.query, 'cluster-image-url') ||
        getCommentValue(this.layer.query, 'marker-symbol') || getCommentValue(this.layer.query, 'marker-image-url')
      initializeClusterStyles(this.sourceId, clusterIcon)
    }
    return this.loadData()
  }

  loadData() {
    if (!this.layer.query) { return Promise.resolve() }
    let query = this.layer.query

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
    console.log('Loading overpass layer', this.layer)

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
      let geojson = osmtogeojson(data)
      geojson = applyOverpassStyle(geojson, query)
      this.layer.geojson = applyOverpassQueryStyle(geojson, this.layer.name)
      this.render()
      functions.e('#maplibre-map', e => { e.setAttribute('data-overpass-loaded', true) })
    })
    .catch(error => {
      console.error('Failed to fetch overpass for ' + this.id, this.layer.query, error.message)
      status('Failed to load layer ' + this.layer.name, 'error')
      // Set empty geojson so layer can still render
      this.layer.geojson = { type: 'FeatureCollection', features: [] }
      this.render()
    })
  }
}

// Standalone utility exports

export function overpassDescription(props) {
  let desc = ''
  if (props["description"]) { desc += props["description"] + '\n\n' }
  if (props["notes"]) { desc += props["notes"] + '\n' }
  if (props["website"]) { desc += props["website"] + '\n' }
  if (props["url"]) { desc += props["url"] + '\n' }

  desc += `\n**OSM tags:**
  <div class="overpass-data-table">
  |               |               |
  | ------------- | ------------- |\n`
  const keys = Object.keys(props).filter(key => !['description', 'notes', 'website', 'url', 'id', 'label'].includes(key))
  keys.forEach(key => {
    // direct links
    if (key == 'wikipedia') {
      desc += `| **${key}** | [${props[key]}](${wikiLink(props[key])})`
    } else if (key == 'wikidata') {
      desc += `| **${key}** | [${props[key]}](https://www.wikidata.org/wiki/${props[key]})`
    } else if (key == 'wikimedia_commons') {
      desc += `| **${key}** | [${props[key]}](https://commons.wikimedia.org/wiki/${encodeURIComponent(props[key])})`
    } else {
      desc += `| **${key}** | ${props[key]} `
    }
    // link to osm taginfo where it makes sense
    if (!['wikipedia', 'email', 'name', 'phone', 'wikidata', 'wikimedia_commons'].includes(key)) {
      desc += `[![Taginfo](/icons/osm-icon-smaller.png)](https://taginfo.openstreetmap.org/tags/${key}=${encodeURIComponent(props[key])})`
    }
    desc += `|\n`
  })
  desc += '\n' + '</div>\n'

  desc += '\n' + '![osm link](/icons/osm-icon-small.png)'
  desc += '[See node in OpenStreetMap](https://www.openstreetmap.org/' + props['id'] + ')'

  return desc
}

// Private helpers

function getCommentValue(query, key) {
  // Match lines like: // key=value (with possible spaces)
  const regex = new RegExp(`^\\s*\\/\\/\\s*${key}\\s*=\\s*(.+)$`, "m")
  const match = query.match(regex)

  return match ? match[1].trim() : null
}

function replaceBboxWithMapRectangle(query) {
  const bounds = map.getBounds()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  const bbox = [sw.lat, sw.lng, ne.lat, ne.lng]
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

function wikiLink(str) {
  const [lang, title] = str.split(':')
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`
}
