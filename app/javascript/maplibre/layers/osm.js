import { draw } from 'maplibre/edit'
import { highlightFeature } from 'maplibre/feature'
import { BasemapLayer } from 'maplibre/layers/basemap'
import { selectableFeaturesNear } from 'maplibre/layers/layer'
import { fetchOsmElement, overpassDescription } from 'maplibre/layers/osm_description'
import { map } from 'maplibre/map'

const OSM_ELEMENT_TYPES = { 1: 'node', 2: 'way', 3: 'relation' }
// Layer classes in protomaps/basemaps that call FeatureMerge in postProcess
const MERGING_SOURCE_LAYERS = ['roads', 'water', 'earth', 'landuse', 'buildings', 'landcover', 'boundaries']

/**
 * Highlights basemap features that come from OpenStreetMap, and logs their OpenStreetMap id.
 * Protomaps has no osm_id property, it packs the element type into the high bits of the
 * vector tile feature id: (type << 44) | osm_id. See protomaps/basemaps FeatureId.java.
 */
export class OsmLayer extends BasemapLayer {
  /**
   * True for tile features that planetiler built from several OSM elements, for example all
   * streets of an area. FeatureMerge.makeMergedId clears the last decimal digit of the tile
   * feature id to mark them, see https://github.com/onthegomap/planetiler/pull/1397
   */
  merged(feature) {
    return feature.id % 10 === 0 && MERGING_SOURCE_LAYERS.includes(feature.sourceLayer)
  }

  osmId(feature) {
    if (this.merged(feature)) { return }

    const type = OSM_ELEMENT_TYPES[Math.floor(feature.id / 2 ** 44)]
    if (!type) { return }

    return `${type}/${feature.id % 2 ** 44}`
  }

  osmUrl(feature) {
    const osmId = this.osmId(feature)
    if (!osmId) { return }

    return `https://www.openstreetmap.org/${osmId}`
  }

  highlightable(feature) {
    return Boolean(this.osmId(feature))
  }

  /**
   * OSM elements at a point, top-most first. One element renders in several style layers
   * (fill and label), so keep only the first hit per OSM id.
   */
  osmFeaturesAtPoint(point) {
    const byOsmId = new Map()
    this.basemapFeaturesAtPoint(point).forEach(feature => {
      const osmId = this.osmId(feature)
      if (!byOsmId.has(osmId)) { byOsmId.set(osmId, feature) }
    })
    return [...byOsmId.values()]
  }

  toGeoJSON(feature) {
    const geojsonFeature = super.toGeoJSON(feature)
    geojsonFeature.properties.osmId = this.osmId(feature)
    return geojsonFeature
  }

  highlightFeatureAtPoint(point) {
    const previous = this.selectedFeature
    super.highlightFeatureAtPoint(point)
    // super only replaces selectedFeature when the hovered feature changed
    if (this.selectedFeature === previous) { return }

    this.logFeatures(this.osmFeaturesAtPoint(point))
  }

  logFeatures(features) {
    console.log('OSM features under cursor:', features.map(feature => ({
      url: this.osmUrl(feature),
      sourceLayer: feature.sourceLayer,
      properties: feature.properties
    })))
  }

  clearHighlight() {
    this.selectedOsmId = null
  }

  /**
   * The clicked elements live in the basemap vector source, not in this layer's style layers,
   * so this handler listens on the whole map instead of on layer ids.
   */
  setupClickHandler() {
    this.clickHandler = (e) => {
      if (draw && draw.getMode() !== 'simple_select') { return }
      if (window.gon.map_mode === 'static') { return }
      if (e.defaultPrevented) { return }

      // user layers win over basemap elements
      if (selectableFeaturesNear(e.point).length) { return }

      const stack = this.osmFeaturesAtPoint(e.point)
      if (!stack.length) { return }
      this.logFeatures(stack)

      const current = stack.findIndex(f => this.osmId(f) === this.selectedOsmId)
      const feature = stack[(current + 1) % stack.length]
      this.selectedFeature = feature

      const geojsonFeature = this.renderHighlight(feature)
      highlightFeature(geojsonFeature, true, this.sourceId)
      // highlightFeature cascades into resetHighlightedFeature, which calls clearHighlight
      // on every layer, so store the cycle position after it
      this.selectedOsmId = this.osmId(feature)

      e.preventDefault()
    }

    map.on('click', this.clickHandler)
  }

  /**
   * Description hook for the details modal. The modal shows a loading message while the
   * OSM API answers. Falls back to the vector tile properties when the request fails.
   */
  async description(feature) {
    const osmId = feature.properties.osmId
    const element = await fetchOsmElement(osmId)
    if (!element) { return feature.properties.desc }

    feature.properties.osm = { ...element.tags, id: osmId }
    return overpassDescription(feature.properties.osm)
  }
}
