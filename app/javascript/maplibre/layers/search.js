import { addCopyToLayerMenuItem } from 'maplibre/controls/context_menu'
import { Layer } from 'maplibre/layers/layer'
import { fetchOsmElement, overpassDescription } from 'maplibre/layers/osm_description'
import { map } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles/styles'

const OSM_TYPES = { N: 'node', W: 'way', R: 'relation' }

// the active result goes up to 1, see pointOpacityActive in styles.js
export const MARKER_OPACITY = 0.8
export const MARKER_OUTLINE = '#ffffff'
// the colors tell a result of the search apart from a feature of the map. a copy to a layer
// of the map drops them and renders as a plain emoji point.
export const TRANSIENT_PROPERTIES = ['marker-color', 'stroke', 'marker-opacity']

// a paint expression of maplibre cannot read a css variable, so it is resolved here
export function markerColor () {
  return getComputedStyle(document.documentElement).getPropertyValue('--ctrl-button-color').trim()
}

// Geocoder results live in their own source so they get the same click, hover and
// context menu handling as the other layers. The instance stays out of the global
// 'layers' array: the results are transient and must not reach the layers modal,
// the undo stack or the server.
export class SearchLayer extends Layer {
  constructor() {
    super({ id: 'results', type: 'search', name: 'Search results',
      geojson: { type: 'FeatureCollection', features: [] } })
    this.contextMenuHandler = null
  }

  initialize() {
    this.createSource()
    initializeViewStyles(this.sourceId)
    this.setupEventHandlers()
    return Promise.resolve()
  }

  setupEventHandlers() {
    super.setupEventHandlers()

    this.contextMenuHandler = (e) => {
      e.preventDefault()
      const features = map.queryRenderedFeatures(e.point, { layers: this.getStyleLayerIds() })
      if (!features.length) { return }

      addCopyToLayerMenuItem(this.copyableFeature(features[0].id))
    }
    map.on('contextmenu', this.contextMenuHandler)
  }

  // a copy gets saved, so it must not keep the properties of the search marker
  copyableFeature(id) {
    const feature = this.geojson.features.find(f => f.id === id)
    if (!feature) { return null }
    const properties = { ...feature.properties }
    // no geojson layer builds a description on demand, so tags that a click on the
    // result already loaded are rendered into the text of the copy
    if (properties.osm) { properties.desc = overpassDescription(properties.osm) }
    TRANSIENT_PROPERTIES.forEach(key => delete properties[key])
    return { ...feature, properties: properties }
  }

  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.contextMenuHandler) {
      if (map?.getStyle()) { map.off('contextmenu', this.contextMenuHandler) }
      this.contextMenuHandler = null
    }
  }

  setResults(features) {
    this.layer.geojson = { type: 'FeatureCollection', features: features }
    this.render()
  }

  clearResults() {
    this.setResults([])
  }

  /**
   * Photon answers with a fixed set of address fields. The osm id of the result buys the
   * rest of the tags from the OSM API, on demand, so a click pays for one result only.
   */
  async description(feature) {
    const type = OSM_TYPES[feature.properties.osm_type]
    if (!type) { return feature.properties.desc }

    const tags = (await fetchOsmElement(`${type}/${feature.properties.osm_id}`))?.tags
    if (!tags) { return feature.properties.desc }

    const osm = { ...tags, id: `${type}/${feature.properties.osm_id}` }
    // the modal passes a copy, the copy to a layer reads the tags from the source feature
    const source = this.geojson.features.find(f => f.id === feature.id)
    if (source) { source.properties.osm = osm }
    return overpassDescription(osm)
  }

  // -1 deactivates all of them again
  setActive(index) {
    this.geojson.features.forEach((feature, i) => {
      map.setFeatureState({ source: this.sourceId, id: feature.id }, { active: i === index })
    })
  }
}

let instance = null

// A basemap change calls map.setStyle, which drops every source and style layer,
// so the source is rebuilt on demand. Both initializeViewStyles and
// setupEventHandlers clean up after themselves, so initialize() is safe to repeat.
export function searchLayer() {
  if (!instance) { instance = new SearchLayer() }
  if (!map.getSource(instance.sourceId)) { instance.initialize() }
  return instance
}

// The instance stays out of the global layers array, so getLayer cannot find it.
export function searchLayerOf(featureId) {
  return instance?.geojson?.features.some(f => f.id === featureId) ? instance : null
}

// Drops the results and the handlers of the previous map on navigation.
export function resetSearchLayer() {
  instance?.cleanup()
  instance = null
}
