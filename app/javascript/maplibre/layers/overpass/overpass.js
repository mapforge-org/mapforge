import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { addCopyToLayerMenuItem } from 'maplibre/controls/context_menu'
import { Layer } from 'maplibre/layers/layer'
import { layers } from 'maplibre/layers/layers'
import { applyOverpassQueryStyle } from 'maplibre/layers/overpass/queries'
import { map } from 'maplibre/map'
import { overpassDescription } from 'maplibre/layers/osm_description'
import { osmAttribution } from 'maplibre/styles/basemaps'
import { initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

export class OverpassLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.contextMenuHandler = null
  }

  // Overpass serves OpenStreetMap data, which the ODbL requires to be credited
  get attribution() {
    return osmAttribution
  }

  initialize() {
    if (!this.layer.query) { return Promise.resolve() }

    initializeViewStyles(this.sourceId, this.layer.heatmap)
    const clustered = !this.layer.query.includes("heatmap=true") &&
      !this.layer.query.includes("cluster=false") &&
      !this.layer.query.includes("geom") // clustering breaks lines & geometries
    if (clustered) {
      const clusterIcon = getCommentValue(this.layer.query, 'cluster-symbol') || getCommentValue(this.layer.query, 'cluster-image-url') ||
        getCommentValue(this.layer.query, 'marker-symbol') || getCommentValue(this.layer.query, 'marker-image-url')
      const clusterColor = getCommentValue(this.layer.query, 'cluster-color') || getCommentValue(this.layer.query, 'marker-color')
      initializeClusterStyles(this.sourceId, clusterIcon, clusterColor)
    }
    this.setupEventHandlers()
    return this.loadData()
  }

  setupEventHandlers() {
    super.setupEventHandlers()

    this.contextMenuHandler = (e) => {
      e.preventDefault()
      const queryLayerIds = this.getStyleLayerIds()
      const features = map.queryRenderedFeatures(e.point, { layers: queryLayerIds })

      const rendered = features.find(f => !f.properties?.cluster)
      if (rendered) {
        addCopyToLayerMenuItem(this.geojson.features.find(f => f.id === rendered.id))
      }
    }
    map.on('contextmenu', this.contextMenuHandler)
  }

  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.contextMenuHandler) {
      map.off('contextmenu', this.contextMenuHandler)
      this.contextMenuHandler = null
    }
  }

  /**
   * Built on demand, so the tags stay the only copy of the element in the feature.
   * A query template can put its own text into desc, that text opens the body.
   */
  description(feature) {
    return [feature.properties.desc, overpassDescription(feature.properties.osm)]
      .filter(Boolean).join('\n\n')
  }

  reloadAfterMapMove() {
    if (!this.layer.query) { return false }
    // Only show reload button if query uses dynamic bbox template
    // Queries with hardcoded bbox coordinates should not trigger reload
    return (this.layer.query.includes('{{bbox}}') || !this.layer.query.includes('[bbox')) ? 'ondemand' : false
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
      // return if layer is gone (likely page change)
      if (!layers || !layers.includes(this)) { return }
      status(window.__('Failed to load layer %{name}').replace('%{name}', this.layer.name), 'error')
      // Set empty geojson so layer can still render
      this.layer.geojson = { type: 'FeatureCollection', features: [] }
      this.render()
      return false
    })
  }
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
  const labelProperty = getCommentValue(query, 'label-property')
  const heatmap = query.includes("heatmap=true")
  const styleKeys = ['marker-color', 'stroke', 'stroke-width', 'fill', 'fill-opacity']
  const styleValues = Object.fromEntries(styleKeys.map(key => [key, getCommentValue(query, key)]))

  geojson.features.forEach( f => {
    // osmtogeojson runs with flatProperties, so the properties are the tags of the element
    // plus its id. They move under 'osm', the top level is for the style keys of mapforge.
    const osm = f.properties
    f.properties = { osm: osm }
    f.properties["label"] = labelProperty ? osm[labelProperty] : osm["name"]
    if (heatmap) { f.properties["heatmap"] = true }
    if (styleValues['marker-color']) { f.properties["marker-color"] = styleValues['marker-color'] }
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
    ;['stroke', 'stroke-width', 'fill', 'fill-opacity'].forEach(key => {
      if (styleValues[key]) { f.properties[key] = styleValues[key] }
    })
    // https://wiki.openstreetmap.org/wiki/Key:osmc:symbol?uselang=en
    // osmc:symbol=waycolor:background[:foreground][:foreground2][:text:textcolor]
    if ((f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString')
      && osm['osmc:symbol']) {
      const parts = osm['osmc:symbol'].split(':')
      f.properties["stroke"] = parts[0]
      f.properties["stroke-width"] = "2"
      f.properties["stroke-image-url"] = "/icon/osmc/" + osm['osmc:symbol']
      // render 'ref' name as label on bike routes without osmc:symbol
    } else if (osm["route"] === 'bicycle' && osm["ref"]){
      f.properties["label"] = osm["ref"]
    }
  })
  return geojson
}
