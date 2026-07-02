import { buffer } from "@turf/buffer"
import { draw, select } from 'maplibre/edit'
import { initializeKmMarkerStyles, renderKmMarkers } from 'maplibre/layers/geojson/km_markers'
import { detectLevels, filterFeaturesByLevel, getActiveLevel } from 'maplibre/controls/levels'
import { initializeExtrasLabelStyles, renderRouteExtras } from 'maplibre/layers/geojson/route_extras'
import { Layer } from 'maplibre/layers/layer'
import { getFeature } from 'maplibre/layers/layers'
import { addGeoJSONSource, map, mapProperties, removeGeoJSONSource } from 'maplibre/map'
import { defaultLineWidth, initializeClusterStyles, initializeViewStyles } from 'maplibre/styles/styles'

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

    // Exclude features with route extras from the main linestring layers (they're rendered in route-extras-source instead)
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
    return this.loadData()
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
  // (loadData just streamed it from the layer URL). When no level filter is active, the
  // source already holds exactly the features we'd upload, so skip the redundant re-parse.
  render(resetDraw = true, { sourceLoaded = false } = {}) {
    if (!this.layer?.geojson?.features) { return }
    const source = map.getSource(this.sourceId)
    if (!source) { console.warn(`Source ${this.sourceId} not found, skipping render`); return }

    this.ensureFeaturePropertyIds()

    // Detect available levels first so activeLevel is defaulted before filtering
    detectLevels()

    // Filter features by active level(s)
    const filteredFeatures = filterFeaturesByLevel(this.layer.geojson.features)

    renderKmMarkers(filteredFeatures, this.kmMarkerSourceId)
    renderRouteExtras(filteredFeatures, this.routeExtrasSourceId)
    this.renderExtrusionLines(filteredFeatures)

    if (sourceLoaded && !getActiveLevel()) {
      // MapLibre's URL load already holds exactly this set; don't re-parse it.
      map.getContainer().setAttribute('data-geojson-loaded', 'true')
    } else {
      console.log("Redraw: Setting source data for geojson layer", this.layer)
      map.getContainer().setAttribute('data-geojson-loaded', 'false')
      source.setData({ type: 'FeatureCollection', features: filteredFeatures }, false)
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

    // Only update extrusion polygons if this feature has them
    if (feature.properties['fill-extrusion-height']) {
      const filteredFeatures = filterFeaturesByLevel(this.layer.geojson.features)
      this.renderExtrusionLines(filteredFeatures)
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
        feature.geometry.type === 'LineString' &&
        feature.properties['fill-extrusion-height'] &&
        !feature.properties['show-route-extras'] &&
        feature.geometry.coordinates.length !== 1
      ))
      .map(feature => {
        const width = feature.properties['fill-extrusion-width'] || feature.properties['stroke-width'] || defaultLineWidth
        const extrusionLine = buffer(feature, width / 2, { units: 'meters' })
        extrusionLine.id = `${feature.id}-extrusion`
        extrusionLine.properties = { ...feature.properties, id: extrusionLine.id }
        if (!extrusionLine.properties['fill-extrusion-color'] && feature.properties.stroke) {
          extrusionLine.properties['fill-extrusion-color'] = feature.properties.stroke
        }
        extrusionLine.properties['stroke-width'] = 0
        extrusionLine.properties['stroke-opacity'] = 0
        return extrusionLine
      })

    source.setData({ type: 'FeatureCollection', features: extrusionFeatures })
  }
}
