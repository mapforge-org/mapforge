import { draw, select } from 'maplibre/edit'
import { updateDeckExtrusionLines } from 'maplibre/deck_overlay'
import { Layer } from 'maplibre/layers/layer'
import { getFeature } from 'maplibre/layers/layers'
import { initializeKmMarkerStyles, renderKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { renderRouteExtras } from 'maplibre/layers/geojson/route_extras'
import { addGeoJSONSource, map } from 'maplibre/map'
import { initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

export class GeoJSONLayer extends Layer {
  get kmMarkerSourceId() {
    return `km-marker-source-${this.id}`
  }

  get routeExtrasSourceId() {
    return `route-extras-source-${this.id}`
  }

  createSource() {
    super.createSource()
    addGeoJSONSource(this.kmMarkerSourceId, false)
    addGeoJSONSource(this.routeExtrasSourceId, false)
  }

  initialize() {
    initializeViewStyles(this.sourceId, !!this.layer.heatmap)
    if (this.layer.cluster) { initializeClusterStyles(this.sourceId, null) }
    initializeKmMarkerStyles(this.kmMarkerSourceId)
    initializeViewStyles(this.routeExtrasSourceId)

    // Override line-cap to 'butt' for route extras line layer to prevent color overlap at segment junctions
    // Keep outline as 'round' to ensure continuous white border
    map.setLayoutProperty(`line-layer_${this.routeExtrasSourceId}`, 'line-cap', 'butt')

    this.setupEventHandlers()
    this.render()
    return Promise.resolve()
  }

  render(resetDraw = true) {
    console.log("Redraw: Setting source data for geojson layer", this.layer)
    if (!this.layer?.geojson?.features) { return }
    this.ensureFeaturePropertyIds()
    renderKmMarkers(this.layer.geojson.features, this.kmMarkerSourceId)
    renderRouteExtras(this.layer.geojson.features, this.routeExtrasSourceId)
    updateDeckExtrusionLines(this.sourceId, this.layer.geojson.features)
    const geojson = { type: 'FeatureCollection', features: this.layer.geojson.features }
    map.getSource(this.sourceId).setData(geojson, false)
    this.resetDrawFeatures(resetDraw)
  }

  resetDrawFeatures(resetDraw) {
    if (draw && resetDraw) {
      // This has a performance drawback over draw.set(), but some feature
      // properties don't get updated otherwise
      // API: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md
      const drawFeatureIds = draw.getAll().features.map(feature => feature.id)
      draw.deleteAll()

      drawFeatureIds.forEach((featureId) => {
        let feature = getFeature(featureId, "geojson")
        if (feature) {
          draw.add(feature)
          select(feature)
        }
      })
    }
  }
}
