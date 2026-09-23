import * as functions from 'helpers/functions'
import { addCopyToLayerMenuItem, hideContextMenu } from 'maplibre/controls/context_menu'
import {
  highlightedFeatureId,
  stickyFeatureHighlight
} from 'maplibre/feature'
import { Layer } from 'maplibre/layers/layer'
import { overpassDescription } from 'maplibre/layers/osm_description'
import { addGeoJSONSource, map, mapProperties } from 'maplibre/map'
import { basemaps } from 'maplibre/styles/basemaps'
import { initializeViewStyles } from 'maplibre/styles/styles'

export class BasemapLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.contextMenuHandler = null
  }

  createSource() {
    addGeoJSONSource(this.sourceId)
  }

  /**
   * Initialize basemap layer for feature highlighting on hover.
   * Note: Basemap layer is special - it manually calls createSource() because it's not
   * in the standard layers array during normal initialization flow.
   */
  initialize() {
    if (!basemaps()[mapProperties.base_map].sourceName) { return Promise.resolve() }

    this.createSource()
    initializeViewStyles(this.sourceId)
    this.setupEventHandlers()

    return Promise.resolve()
  }

  /**
   * Adds a context menu for the copy of the highlighted feature, and a custom mousemove.
   */
  setupEventHandlers() {
    this.removeEventHandlers()
    this.setupClickHandler()
    this.setupMouseMoveHandler()

    this.contextMenuHandler = (e) => {
      e.preventDefault()

      const features = map.queryRenderedFeatures(e.point, { layers: this.getStyleLayerIds() })

      // the hovered feature was stored by highlightFeatureAtPoint, with an id of its own
      if (features.length) {
        addCopyToLayerMenuItem(this.geojson.features.find(f => f.id === features[0].id))
      }
    }

    map.on('contextmenu', this.contextMenuHandler)
  }

  /**
   * Removes event handlers including custom contextmenu and touch handlers.
   */
  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.contextMenuHandler) {
      map.off('contextmenu', this.contextMenuHandler)
      this.contextMenuHandler = null
    }
    if (this.touchStartHandler) {
      map.off('touchstart', this.touchStartHandler)
      this.touchStartHandler = null
    }
  }

  /**
   * Subclasses can restrict which features are highlighted.
   */
  highlightable(_feature) { return true }

  /**
   * Returns the highlightable basemap vector tile features at a point, top-most first.
   */
  basemapFeaturesAtPoint(point) {
    const basemapSource = basemaps()[mapProperties.base_map].sourceName
    const queryLayerIds = map.getLayersOrder().filter(id => map.getLayer(id)?.source === basemapSource)
    return map.queryRenderedFeatures(point, { layers: queryLayerIds })
      .filter(feature => this.highlightable(feature))
  }

  /**
   * Converts a vector tile feature into a geojson feature for this layer's own source.
   * Subclasses can override to add properties.
   */
  toGeoJSON(feature) {
    const geojsonFeature = {
      type: 'Feature',
      geometry: feature.geometry,
      properties: { ...feature.properties }
    }
    geojsonFeature.id = geojsonFeature.properties.id = functions.featureId()
    geojsonFeature.properties.desc = overpassDescription(geojsonFeature.properties)
    const height = geojsonFeature.properties['hoehe'] || geojsonFeature.properties['render_height']
    if (height) {
      geojsonFeature.properties['fill-extrusion-height'] = height
    }
    return geojsonFeature
  }

  /**
   * Renders a single vector tile feature into this layer's source.
   * @returns {object} the rendered geojson feature
   */
  renderHighlight(feature) {
    const geojsonFeature = this.toGeoJSON(feature)
    this.geojson.features = [geojsonFeature]
    map.getSource(this.sourceId).setData(this.geojson, false)
    return geojsonFeature
  }

  /**
   * Handles feature highlighting at a given point (used by both mouse and touch).
   */
  highlightFeatureAtPoint(point) {
    if (stickyFeatureHighlight && highlightedFeatureId) { return }
    if (document.querySelector('.show > .map-modal')) { return }
    // a frame queued by perFrame() can run after the source is gone
    if (!map.getSource(this.sourceId)) { return }

    const features = this.basemapFeaturesAtPoint(point)
    if (!features.length) { return }

    const feature = features[0]
    if (this.sameFeature(feature, this.selectedFeature)) { return }
    this.selectedFeature = feature
    hideContextMenu()

    this.renderHighlight(feature)
  }

  // Runs on every mouse frame, and stringifying large polygons (water, landuse) is slow, so a
  // different id answers at once. Merged tile features can share an id, so the geometry decides
  // the rest, and the one of the selected feature is stringified only once.
  sameFeature(feature, selected) {
    if (!selected || feature.id !== selected.id || feature.sourceLayer !== selected.sourceLayer) { return false }
    if (this.selectedGeometryOf !== selected) {
      this.selectedGeometryOf = selected
      this.selectedGeometry = JSON.stringify(selected.geometry)
    }
    return JSON.stringify(feature.geometry) === this.selectedGeometry
  }

  /**
   * Custom mousemove handler for basemap layer - queries basemap source layers.
   */
  setupMouseMoveHandler() {
    this.mouseMoveHandler = functions.perFrame((e) => {
      this.highlightFeatureAtPoint(e.point)
    })

    this.touchStartHandler = (e) => {
      // Only handle single touch
      if (e.originalEvent.touches && e.originalEvent.touches.length !== 1) { return }
      this.highlightFeatureAtPoint(e.point)
    }

    map.on('mousemove', this.mouseMoveHandler)
    map.on('touchstart', this.touchStartHandler)
  }
}
