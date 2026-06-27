import { buffer } from "@turf/buffer"
import { draw, select } from 'maplibre/edit'
import { initializeKmMarkerStyles, renderKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { detectLevels, filterFeaturesByLevel } from 'maplibre/layers/geojson/levels'
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
      [">=", ["zoom"], ["to-number", ["coalesce", ["get", "min-zoom"], 0]]],
      ["<=", ["zoom"], ["to-number", ["coalesce", ["get", "max-zoom"], 24]]]
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

    // Signal that GeoJSON is re-rendering (set to false)
    map.getContainer().setAttribute('data-geojson-loaded', 'false')

    // Detect available levels first so activeLevel is defaulted before filtering
    detectLevels()

    // Filter features by active level(s)
    const filteredFeatures = filterFeaturesByLevel(this.layer.geojson.features)

    renderKmMarkers(filteredFeatures, this.kmMarkerSourceId)
    renderRouteExtras(filteredFeatures, this.routeExtrasSourceId)
    const extrusionLines = this.renderExtrusionLines(filteredFeatures)
    const geojson = { type: 'FeatureCollection', features: filteredFeatures.concat(extrusionLines) }

    const source = map.getSource(this.sourceId)
    if (!source) {
      console.warn(`Source ${this.sourceId} not found, skipping render`)
      return
    }
    source.setData(geojson, false)

    // Wait for MapLibre to complete the render, then signal completion
    map.once('render', () => {
      map.getContainer().setAttribute('data-geojson-loaded', 'true')
    })

    this.resetDrawFeatures(resetDraw)
  }

  bringToFront(feature) {
    const source = map.getSource(this.sourceId)
    if (!source) { return }
    // Only LineStrings spawn derived companion geometry (route-extras segments/labels,
    // buffered extrusion polygons) that a surgical reorder would leave stale.
    const spawnsCompanionGeometry = feature.geometry?.type === 'LineString' &&
      (feature.properties?.['show-route-extras'] || feature.properties?.['fill-extrusion-height'])
    if (spawnsCompanionGeometry) {
      return this.render()
    }
    this.ensureFeaturePropertyIds()
    source.updateData({ remove: [feature.id], add: [feature] })
  }

  renderAnimationFrame(feature, frameCount) {
    // Skip if a full render is in progress (data-geojson-loaded='false')
    if (map.getContainer().getAttribute('data-geojson-loaded') === 'false') {
      return
    }

    feature.properties = feature.properties || {}
    feature.id = feature.id || feature.properties.id
    feature.properties.id = feature.id

    const source = map.getSource(this.sourceId)
    if (!source) return

    source.updateData({ update: [feature] })

    // Only update route extras if this feature has them
    if (feature.properties['show-route-extras']) {
      const filteredFeatures = filterFeaturesByLevel(this.layer.geojson.features)
      renderRouteExtras(filteredFeatures, this.routeExtrasSourceId)
    }

    // Reduce km marker updates - only every 10 frames
    if (frameCount % 10 === 0) {
      const filteredFeatures = filterFeaturesByLevel(this.layer.geojson.features)
      renderKmMarkers(filteredFeatures, this.kmMarkerSourceId)
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

  renderExtrusionLines(features) {
    if (mapProperties.terrain) { return [] }

    // LineStrings with fill-extrusion-height are buffered into polygons for MapLibre's fill-extrusion layer
    // Skipped when 'show-route-extras' would render it's own extrusion
    let extrusionLines = features.filter(feature => (
      feature.geometry.type === 'LineString' &&
      feature.properties['fill-extrusion-height'] &&
      !feature.properties['show-route-extras'] &&
      feature.geometry.coordinates.length !== 1
    ))

    return extrusionLines.map(feature => {
      const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaultLineWidth
      const extrusionLine = buffer(feature, width / 2, { units: 'meters' })
      // Needs a unique id so updateData() diffing can index the source. The source uses
      // promoteId: 'id', so the diff key is properties.id - override both with a unique extrusion id.
      extrusionLine.id = `${feature.id}-extrusion`
      extrusionLine.properties = { ...feature.properties, id: extrusionLine.id }
      if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
        extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
      }
      extrusionLine.properties['stroke-width'] = 0
      extrusionLine.properties['stroke-opacity'] = 0
      return extrusionLine
    })
  }
}
