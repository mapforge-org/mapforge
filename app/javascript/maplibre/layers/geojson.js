import { buffer } from "@turf/buffer"
import { draw, select } from 'maplibre/edit'
import { initializeKmMarkerStyles, renderKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { detectLevels, filterFeaturesByLevel } from 'maplibre/layers/geojson/levels'
import { initializeExtrasLabelStyles, renderRouteExtras } from 'maplibre/layers/geojson/route_extras'
import { Layer } from 'maplibre/layers/layer'
import { getFeature } from 'maplibre/layers/layers'
import { addGeoJSONSource, map, mapProperties, removeGeoJSONSource } from 'maplibre/map'
import { defaultLineWidth, initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

// Buffer a single extrusion LineString into a polygon for MapLibre's fill-extrusion layer.
// Returns null for geometry that can't be buffered (non-line, <2 coords, or degenerate).
// @turf/buffer (JSTS) is expensive, so callers should only invoke this for features that changed.
function buildLineExtrusion(feature) {
  if (feature.geometry?.type !== 'LineString' || feature.geometry.coordinates.length < 2) {
    return null
  }
  const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaultLineWidth
  const extrusionLine = buffer(feature, width / 2, { units: 'meters' })
  if (!extrusionLine) { return null }
  extrusionLine.id = `${feature.id}-extrusion`
  extrusionLine.properties = { ...feature.properties, id: extrusionLine.id }
  if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
    extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
  }
  extrusionLine.properties['stroke-width'] = 0
  extrusionLine.properties['stroke-opacity'] = 0
  return extrusionLine
}

export class GeoJSONLayer extends Layer {
  get kmMarkerSourceId() {
    return `km-marker-source-${this.id}`
  }

  get routeExtrasSourceId() {
    return `route-extras-source-${this.id}`
  }

  get extrusionSourceId() {
    return `extrusion-source-${this.id}`
  }

  createSource() {
    super.createSource()
    addGeoJSONSource(this.kmMarkerSourceId, false)
    addGeoJSONSource(this.routeExtrasSourceId, false)
    addGeoJSONSource(this.extrusionSourceId, false)
  }

  cleanup() {
    super.cleanup()
    removeGeoJSONSource(this.kmMarkerSourceId)
    removeGeoJSONSource(this.routeExtrasSourceId)
    removeGeoJSONSource(this.extrusionSourceId)
  }

  initialize() {
    initializeViewStyles(this.sourceId, !!this.layer.heatmap)
    if (this.layer.cluster) { initializeClusterStyles(this.sourceId, null) }
    initializeKmMarkerStyles(this.kmMarkerSourceId)
    initializeViewStyles(this.routeExtrasSourceId)
    initializeExtrasLabelStyles(this.routeExtrasSourceId)
    initializeViewStyles(this.extrusionSourceId)

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
    this.renderExtrusionLines(filteredFeatures)
    const geojson = { type: 'FeatureCollection', features: filteredFeatures }

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
    // A reorder-to-front changes render order only, never geometry, so we do a
    // surgical single-feature update moving it to the end of the list
    this.ensureFeaturePropertyIds()
    source.updateData({ remove: [feature.id], add: [feature] })

    // Buffered extrusion polygons are GPU depth-sorted, so their source order is
    // irrelevant. Route-extras labels, however, use a feature-index-based
    // symbol-sort-key, so their (small, route-only) companion source must be refreshed.
    if (feature.geometry?.type === 'LineString' && feature.properties?.['show-route-extras']) {
      renderRouteExtras(filterFeaturesByLevel(this.layer.geojson.features), this.routeExtrasSourceId)
    }
  }

  // Surgically update a SINGLE already-present feature and its companion geometry,
  // instead of a full render() that re-serializes the whole source and re-buffers every
  // extrusion line. Use for property/geometry changes to an existing feature.
  // NOT suitable for: adding/removing a feature (use render()), geometry edits that need
  // MapboxDraw sync (render() runs resetDrawFeatures), or level/visibility changes
  // (render() runs detectLevels). Companion refreshes assume the feature's companion
  // flags are current — a feature that just had route-extras/km/extrusion toggled OFF
  // still needs render() to purge its stale companion geometry (see updateKmMarkers note).
  applyFeatureUpdate(feature, { updateKmMarkers = true } = {}) {
    feature.properties = feature.properties || {}
    feature.id = feature.id || feature.properties.id
    feature.properties.id = feature.id

    const source = map.getSource(this.sourceId)
    if (!source) { return }
    source.updateData({ update: [feature] })

    // Route-extras labels use a feature-index sort-key, so rebuild the (small, route-only) source.
    if (feature.properties['show-route-extras']) {
      renderRouteExtras(filterFeaturesByLevel(this.layer.geojson.features), this.routeExtrasSourceId)
    }

    // Re-buffer only THIS feature's extrusion polygon (if it's a bufferable line).
    if (feature.geometry?.type === 'LineString' && feature.properties['fill-extrusion-height'] &&
        !feature.properties['show-route-extras'] && !mapProperties.terrain) {
      const extrusionSource = map.getSource(this.extrusionSourceId)
      const polygon = buildLineExtrusion(feature)
      if (extrusionSource && polygon) {
        extrusionSource.updateData({ remove: [polygon.id], add: [polygon] })
      }
    }

    // km-markers rebuild from the whole feature set; callers in a hot loop (animation)
    // can throttle this via updateKmMarkers, one-shot callers should leave it on.
    if (updateKmMarkers) {
      renderKmMarkers(filterFeaturesByLevel(this.layer.geojson.features), this.kmMarkerSourceId)
    }
  }

  updateAnimatedFeature(feature, frameCount) {
    // Skip if a full render is in progress (data-geojson-loaded='false')
    if (map.getContainer().getAttribute('data-geojson-loaded') === 'false') {
      return
    }
    // km-marker rebuilds are relatively expensive, so throttle them to every 10th frame.
    this.applyFeatureUpdate(feature, { updateKmMarkers: frameCount % 10 === 0 })
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
    const source = map.getSource(this.extrusionSourceId)
    if (!source) { return }

    if (mapProperties.terrain) {
      source.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    // LineStrings with fill-extrusion-height are buffered into polygons for MapLibre's fill-extrusion layer.
    // Placed in a separate non-selectable source so the polygons are never clickable.
    // Skipped when 'show-route-extras' renders its own extrusion.
    const extrusionFeatures = features
      .filter(feature => (
        feature.properties['fill-extrusion-height'] &&
        !feature.properties['show-route-extras']
      ))
      .map(buildLineExtrusion)
      .filter(Boolean)

    source.setData({ type: 'FeatureCollection', features: extrusionFeatures })
  }
}
