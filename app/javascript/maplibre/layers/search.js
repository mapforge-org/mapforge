import { addCopyToLayerMenuItem } from 'maplibre/controls/context_menu'
import { Layer } from 'maplibre/layers/layer'
import { fetchOverpassTags, overpassDescription } from 'maplibre/layers/overpass/overpass'
import { map } from 'maplibre/map'
import { circleImage, pruneCircleImages } from 'maplibre/styles/circle_image'
import { initializeViewStyles } from 'maplibre/styles/styles'

const OSM_TYPES = { N: 'node', W: 'way', R: 'relation' }

const MARKER_PREFIX = 'search-marker'
// the symbols layer scales an icon by marker-size / 60, so with an image of 60 css pixels the
// marker-size is the width of the marker on the screen
const MARKER_IMAGE_SIZE = 60
export const MARKER_SIZE = 50
// the active result goes up to 1, see pointOpacityActive in styles.js
export const MARKER_OPACITY = 0.8
// keeps the label at the distance that it has below an emoji point of the map
export const MARKER_LABEL_OFFSET = [0, 1.3]
// the marker image belongs to the current map style, and the other three values fit that
// image only. a copy to a layer of the map drops them and renders as a plain emoji point.
export const TRANSIENT_PROPERTIES = ['marker-image-url', 'marker-size', 'marker-opacity', 'label-offset']

// a paint expression of maplibre cannot read a css variable, so it is resolved here
function ctrlButtonColor () {
  return getComputedStyle(document.documentElement).getPropertyValue('--ctrl-button-color').trim()
}

// The emoji sits on a circle in the color of the map controls, which tells a result of the
// search apart from a feature of the map.
export function resultMarkerImage (symbol) {
  return circleImage(MARKER_PREFIX, ctrlButtonColor(),
    { size: MARKER_IMAGE_SIZE, symbol: symbol, border: '#ffffff' })
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
    pruneCircleImages(MARKER_PREFIX, new Set(features.map(f => f.properties['marker-image-url'])))
    this.render()
  }

  clearResults() {
    this.setResults([])
  }

  /**
   * Photon answers with a fixed set of address fields. The osm id of the result buys the
   * rest of the tags from overpass, on demand, so a click pays for one result only.
   */
  async description(feature) {
    const type = OSM_TYPES[feature.properties.osm_type]
    if (!type) { return feature.properties.desc }

    const tags = await fetchOverpassTags(type, feature.properties.osm_id)
    if (!tags) { return feature.properties.desc }

    feature.properties.osm = { ...tags, id: `${type}/${feature.properties.osm_id}` }
    return overpassDescription(feature.properties.osm)
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
