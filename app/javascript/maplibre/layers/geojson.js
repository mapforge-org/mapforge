import { buffer } from "@turf/buffer"
import { draw, select } from 'maplibre/edit'
import { initializeKmMarkerStyles, renderKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { initializeExtrasLabelStyles, renderRouteExtras } from 'maplibre/layers/geojson/route_extras'
import { Layer } from 'maplibre/layers/layer'
import { getFeature } from 'maplibre/layers/layers'
import { addGeoJSONSource, map, mapProperties } from 'maplibre/map'
import { defaultLineWidth, initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

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
    initializeExtrasLabelStyles(this.routeExtrasSourceId)

    // Exclude features with route extras from the main line layers (they're rendered in route-extras-source instead)
    const mainLineFilter = ['all',
      ['==', ['geometry-type'], 'LineString'],
      ['!', ['has', 'show-route-extras']],
      [">=", ["zoom"], ["coalesce", ["to-number", ["get", "min-zoom"]], 0]]
    ]
    map.setFilter(`line-layer_${this.sourceId}`, mainLineFilter)
    // Hide the outline layer for route extras - we only want the colored segments visible
    map.setLayoutProperty(`line-layer-outline_${this.routeExtrasSourceId}`, 'visibility', 'none')

    // Override line-cap to 'butt' for route extras line layer to prevent color overlap at segment junctions
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
    const extrusionLines = this.renderExtrusionLines()
    const geojson = { type: 'FeatureCollection', features: this.layer.geojson.features.concat(extrusionLines) }
    map.getSource(this.sourceId).setData(geojson, false)
    this.resetDrawFeatures(resetDraw)
  }

  renderAnimationFrame(feature, frameCount) {
    feature.properties = feature.properties || {}
    feature.id = feature.id || feature.properties.id
    feature.properties.id = feature.id
    map.getSource(this.sourceId).updateData({ update: [feature] })

    renderRouteExtras(this.layer.geojson.features, this.routeExtrasSourceId)
    if (frameCount % 10 === 0) {
      renderKmMarkers(this.layer.geojson.features, this.kmMarkerSourceId)
    }
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

  renderExtrusionLines() {
    if (mapProperties.terrain) { return [] }

    // LineStrings with fill-extrusion-height are buffered into polygons for MapLibre's fill-extrusion layer
    // Skipped when 'show-route-extras' would render it's own extrusion
    let extrusionLines = this.layer.geojson.features.filter(feature => (
      feature.geometry.type === 'LineString' &&
      feature.properties['fill-extrusion-height'] &&
      !feature.properties['show-route-extras'] &&
      feature.geometry.coordinates.length !== 1
    ))

    return extrusionLines.map(feature => {
      const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaultLineWidth
      const extrusionLine = buffer(feature, width, { units: 'meters' })
      extrusionLine.properties = { ...feature.properties }
      if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
        extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
      }
      extrusionLine.properties['stroke-width'] = 0
      extrusionLine.properties['stroke-opacity'] = 0
      extrusionLine.properties['fill-opacity'] = 0
      return extrusionLine
    })
  }
}
