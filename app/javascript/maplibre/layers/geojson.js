import { buffer } from "@turf/buffer"
import { draw, select } from 'maplibre/edit'
import {
  applyLevelFilter as applyKmMarkerLevelFilter,
  hasKmMarkers,
  initializeKmMarkerStyles,
  renderKmMarkers
} from 'maplibre/layers/geojson/km_markers'
import { detectLevels, withLevelFilter } from 'maplibre/controls/levels'
import {
  applyLevelFilter as applyRouteExtrasLevelFilter,
  hasRouteExtras,
  initializeExtrasLabelStyles,
  renderRouteExtras
} from 'maplibre/layers/geojson/route_extras'
import { Layer } from 'maplibre/layers/layer'
import { getFeature } from 'maplibre/layers/layers'
import { addGeoJSONSource, map, mapProperties, removeGeoJSONSource } from 'maplibre/map'
import { clusterStyles, defaultLineWidth, initializeClusterStyles, initializeViewStyles, styles, viewStyleNames } from 'maplibre/styles/styles'

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

// Whether a feature needs a buffered extrusion polygon: a LineString with a height set, not
// already rendered as a route-extras segment (which builds its own extrusion), and not hidden by 3D terrain.
function needsExtrusionPolygon(feature) {
  return feature.geometry?.type === 'LineString' &&
    !!feature.properties?.['fill-extrusion-height'] &&
    !feature.properties?.['show-route-extras'] &&
    !mapProperties.terrain
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

  // Excludes features with route extras from the main linestring layers (they're rendered in
  // route-extras-source instead).
  get mainLineFilter() {
    return ['all',
      ['==', ['geometry-type'], 'LineString'],
      ['!', ['has', 'show-route-extras']],
      [">=", ["zoom"], ["to-number", ["coalesce", ["get", "min-zoom"], 0]]],
      ["<=", ["zoom"], ["to-number", ["coalesce", ["get", "max-zoom"], 24]]]
    ]
  }

  get dataUrl() {
    return `/m/${window.gon.map_id}/layer/${this.id}.geojson`
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

    map.setFilter(`line-layer_${this.sourceId}`, withLevelFilter(this.mainLineFilter))
    // Hide the outline layer for route extras - we only want the colored segments visible
    map.setLayoutProperty(`line-layer-outline_${this.routeExtrasSourceId}`, 'visibility', 'none')

    // Override line-cap to 'butt' for route extras line layer to prevent color overlap at segment junctions
    map.setLayoutProperty(`line-layer_${this.routeExtrasSourceId}`, 'line-cap', 'butt')

    this.setupEventHandlers()
    return this.loadData()
  }

  // Re-applies the current level filter to every already-added style layer for this GeoJSON
  // layer (main view styles, heatmap, clusters, and the km-marker/route-extras companions),
  // instead of re-filtering features and re-uploading the source (see render()).
  applyLevelFilter() {
    const styleDefs = styles()
    const sourceIds = [this.sourceId, this.routeExtrasSourceId, this.extrusionSourceId]
    sourceIds.forEach(sourceId => {
      viewStyleNames.forEach(styleName => {
        const layerId = `${styleName}_${sourceId}`
        if (!map.getLayer(layerId)) { return }
        const baseFilter = (styleName === 'line-layer' && sourceId === this.sourceId)
          ? this.mainLineFilter
          : styleDefs[styleName].filter
        map.setFilter(layerId, withLevelFilter(baseFilter))
      })

      const heatmapLayerId = `heatmap-layer_${sourceId}`
      if (map.getLayer(heatmapLayerId)) {
        map.setFilter(heatmapLayerId, withLevelFilter(styleDefs['heatmap-layer'].filter))
      }
    })

    if (this.layer.cluster) {
      clusterStyles(null).forEach(style => {
        const layerId = `${style.id}_${this.sourceId}`
        if (map.getLayer(layerId)) { map.setFilter(layerId, withLevelFilter(style.filter)) }
      })
    }

    applyKmMarkerLevelFilter(this.kmMarkerSourceId)
    applyRouteExtrasLevelFilter(this.routeExtrasSourceId)
  }

  // setData(url) lets MapLibre fetch AND parse the features in its web worker (off the main
  // thread, so the UI stays responsive even for large layers); once loaded we read them back
  // via getData() into this.layer.geojson (for lookup/sync/derived sources) without a 2nd request.
  loadData() {
    const sourceId = this.sourceId
    const source = map.getSource(sourceId)
    return new Promise((resolve) => {
      const cleanup = () => {
        map.off('sourcedata', onData)
        map.off('error', onError)
      }
      const onData = (e) => {
        // make sure to only act on the completed load of this source
        if (e.sourceId !== sourceId || e.sourceDataType === 'metadata' || !map.isSourceLoaded(sourceId)) { return }
        cleanup()
        source.getData()
          .then(geojson => { this.layer.geojson = geojson; this.render(true, { sourceLoaded: true }); resolve(geojson) })
          .catch(error => { console.error(`Failed to read data for ${sourceId}`, error); resolve() })
      }
      // A failed URL fetch fires an 'error' event (not a completed 'sourcedata'). Resolve rather
      // than reject so a single failing layer doesn't hang initializeLayerStyles' Promise.all.
      const onError = (e) => {
        if (e.sourceId !== sourceId) { return }
        cleanup()
        console.error(`Failed to load data for ${sourceId}`, e.error)
        resolve()
      }
      map.on('sourcedata', onData)
      map.on('error', onError)
      source.setData(this.dataUrl)
    })
  }

  // sourceLoaded=true means the main MapLibre source already holds this.layer.geojson
  // (loadData just streamed it from the layer URL), so it already holds exactly the
  // features we'd upload, and re-parsing them is skipped. Level visibility is handled by
  // style filters (see applyLevelFilter), not by pre-filtering features here.
  render(resetDraw = true, { sourceLoaded = false } = {}) {
    if (!this.layer?.geojson?.features) { return }
    const source = map.getSource(this.sourceId)
    if (!source) { console.warn(`Source ${this.sourceId} not found, skipping render`); return }

    this.ensureFeaturePropertyIds()

    // Detect available levels so the level control reflects this layer's data
    detectLevels()

    const features = this.layer.geojson.features

    renderKmMarkers(features, this.kmMarkerSourceId)
    renderRouteExtras(features, this.routeExtrasSourceId)
    this.renderExtrusionLines(features)

    if (sourceLoaded) {
      // MapLibre's URL load already holds exactly this set; don't re-parse it.
      map.getContainer().setAttribute('data-geojson-loaded', 'true')
    } else {
      console.log("Redraw: Setting source data for geojson layer", this.layer)
      map.getContainer().setAttribute('data-geojson-loaded', 'false')
      source.setData({ type: 'FeatureCollection', features }, false)
      // Wait for MapLibre to complete the render, then signal completion
      map.once('render', () => {
        map.getContainer().setAttribute('data-geojson-loaded', 'true')
      })
    }

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
    if (hasRouteExtras(feature)) {
      renderRouteExtras(this.layer.geojson.features, this.routeExtrasSourceId)
    }
  }

  // Surgically update a single existing feature (and, when asked, its companion geometry)
  // without a full render(). The route-extras and km-marker companion sources are rebuilt
  // from ALL features and run turf ops, so they are ONLY refreshed when the caller opts in.
  // A plain property edit (color, height, title, …) doesn't affect those companions, so it
  // skips them and stays instant. Callers that change geometry or toggle a companion on/off
  // pass the matching flag.
  // Options:
  // - resetDraw: re-sync the MapboxDraw overlay (geometry edits in draw); no-op otherwise.
  // - refreshRouteExtras: rebuild the route-extras companion source (geometry change / toggle).
  // - refreshKmMarkers: rebuild the km-marker companion source (geometry change / toggle).
  applyFeatureUpdate(feature, { resetDraw = false, refreshRouteExtras = false, refreshKmMarkers = false } = {}) {
    feature.properties = feature.properties || {}
    feature.id = feature.id || feature.properties.id
    feature.properties.id = feature.id

    const source = map.getSource(this.sourceId)
    if (!source) { return }
    source.updateData({ remove: [feature.id], add: [feature] })

    if (refreshRouteExtras) {
      renderRouteExtras(this.layer.geojson.features, this.routeExtrasSourceId)
    }

    // Extrusion polygon lives in a separate source (only LineStrings ever have one): upsert it
    // for a non-route extrusion line, otherwise remove any stale polygon (height cleared,
    // route-extras enabled, terrain on, …).
    const extrusionSource = map.getSource(this.extrusionSourceId)
    if (extrusionSource && feature.geometry?.type === 'LineString') {
      const polygon = needsExtrusionPolygon(feature) ? buildLineExtrusion(feature) : null
      if (polygon) {
        extrusionSource.updateData({ remove: [polygon.id], add: [polygon] })
      } else {
        extrusionSource.updateData({ remove: [`${feature.id}-extrusion`] })
      }
    }

    if (refreshKmMarkers) {
      renderKmMarkers(this.layer.geojson.features, this.kmMarkerSourceId)
    }

    // Keep the MapboxDraw overlay in sync for geometry edits (no-op when nothing is in draw).
    if (resetDraw) { this.resetDrawFeatures(true) }
  }

  // Surgically add a feature to this layer's source without a full render(). Unlike
  // applyFeatureUpdate, there's no prior state to compare against, so companion refreshes are
  // decided from the feature's own properties instead of caller flags.
  applyFeatureAdd(feature) {
    const source = map.getSource(this.sourceId)
    if (!source) { return }
    source.updateData({ add: [feature] })

    if (hasRouteExtras(feature)) {
      renderRouteExtras(this.layer.geojson.features, this.routeExtrasSourceId)
    }

    const extrusionSource = map.getSource(this.extrusionSourceId)
    if (extrusionSource && needsExtrusionPolygon(feature)) {
      const polygon = buildLineExtrusion(feature)
      if (polygon) { extrusionSource.updateData({ add: [polygon] }) }
    }

    if (hasKmMarkers(feature)) {
      renderKmMarkers(this.layer.geojson.features, this.kmMarkerSourceId)
    }
  }

  // Surgically remove a feature from this layer's source without a full render(). See
  // applyFeatureAdd for why companion refreshes are derived from the feature, not caller flags.
  applyFeatureRemove(feature) {
    const source = map.getSource(this.sourceId)
    if (!source) { return }
    source.updateData({ remove: [feature.id] })

    if (hasRouteExtras(feature)) {
      renderRouteExtras(this.layer.geojson.features, this.routeExtrasSourceId)
    }

    const extrusionSource = map.getSource(this.extrusionSourceId)
    if (extrusionSource && feature.geometry?.type === 'LineString') {
      extrusionSource.updateData({ remove: [`${feature.id}-extrusion`] })
    }

    if (hasKmMarkers(feature)) {
      renderKmMarkers(this.layer.geojson.features, this.kmMarkerSourceId)
    }

    // Cheap regardless of draw's contents, so always keep it in sync (e.g. a feature deleted
    // remotely while selected locally).
    this.resetDrawFeatures(true)
  }

  updateAnimatedFeature(feature, frameCount) {
    // Skip if a full render is in progress (data-geojson-loaded='false')
    if (map.getContainer().getAttribute('data-geojson-loaded') === 'false') {
      return
    }
    // Geometry moves every frame, so companions follow it: rebuild route-extras when the
    // animating feature has them, and throttle the (pricier) km-marker rebuild to every 10th frame.
    this.applyFeatureUpdate(feature, {
      refreshRouteExtras: hasRouteExtras(feature),
      refreshKmMarkers: frameCount % 10 === 0
    })
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
      .filter(needsExtrusionPolygon)
      .map(buildLineExtrusion)
      .filter(Boolean)

    source.setData({ type: 'FeatureCollection', features: extrusionFeatures })
  }
}
