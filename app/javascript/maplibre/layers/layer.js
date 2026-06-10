import * as functions from 'helpers/functions'
import { flyToFeature } from 'maplibre/animations'
import { draw } from 'maplibre/edit'
import {
  highlightFeature,
  highlightedFeatureId,
  highlightedFeatureSource,
  resetHighlightedFeature,
  stickyFeatureHighlight
} from 'maplibre/feature'
import { getFeature } from 'maplibre/layers/layers'
import { addGeoJSONSource, frontFeature, map } from 'maplibre/map'

/**
 * Base class for map layers. Subclass to create new layer types.
 *
 * Required overrides:
 * - initialize(): Promise - Apply styles and load data. Return loadData() promise or Promise.resolve()
 * - loadData(): Promise - Fetch data, set this.layer.geojson, call this.render()
 *
 * Optional overrides:
 * - createSource(): void - Override if you need custom source setup beyond standard GeoJSON source
 * - render(resetDraw): void - Override for custom rendering logic (e.g., km markers, extrusion lines)
 * - get sourceId(): string - Override for custom source naming convention
 * - setupEventHandlers(): void - Override to customize click/mousemove behavior or disable handlers
 * - cleanup(): void - Override to add custom cleanup, but call super.cleanup()
 */
export class Layer {
  constructor(layer) {
    this.layer = layer
    this.clickHandler = null
    this.mouseMoveHandler = null
  }

  get id() {
    return this.layer.id
  }

  get type() {
    return this.layer.type
  }

  get name() {
    return this.layer.name
  }

  set name(value) {
    this.layer.name = value
  }

  get query() {
    return this.layer.query
  }

  set query(value) {
    this.layer.query = value
  }

  get show() {
    return this.layer.show
  }

  set show(value) {
    this.layer.show = value
  }

  get cluster() {
    return this.layer.cluster
  }

  set cluster(value) {
    this.layer.cluster = value
  }

  get heatmap() {
    return this.layer.heatmap
  }

  set heatmap(value) {
    this.layer.heatmap = value
  }

  get geojson() {
    // Initialize geojson defensively to prevent undefined.features errors
    if (!this.layer.geojson) {
      this.layer.geojson = { type: 'FeatureCollection', features: [] }
    }
    return this.layer.geojson
  }

  set geojson(value) {
    this.layer.geojson = value
  }

  get sourceId() {
    return `${this.type}-source-${this.id}`
  }

  /**
   * Creates the MapLibre source for this layer.
   * Called once during initialization; visibility toggles reuse the source.
   */
  createSource() {
    const cluster = !!this.layer.cluster && !this.layer.heatmap
    addGeoJSONSource(this.sourceId, cluster)
  }

  /**
   * Applies styles and loads data for this layer.
   * May be called multiple times (e.g., when toggling visibility).
   * @returns {Promise} Promise that resolves when layer is ready
   */
  initialize() {
    return Promise.resolve()
  }

  /**
   * Fetches data for this layer and renders it.
   * @returns {Promise} Promise that resolves when data is loaded
   */
  loadData() {
    return Promise.resolve(this.layer?.geojson)
  }

  /**
   * Renders layer data to the map.
   * @param {boolean} [resetDraw=true] - Whether to reset draw features (for GeoJSON layers)
   */
  render() {
    this.ensureFeaturePropertyIds()
    map.getSource(this.sourceId).setData(this.layer.geojson, false)
  }

  ensureFeaturePropertyIds() {
    this.layer?.geojson?.features?.forEach((feature) => {
      feature.properties = feature.properties || {}
      feature.properties.id = feature.id
    })
  }

  /**
   * Sets up event handlers for feature interaction (click, hover).
   * Called during layer initialization. Override to customize or disable handlers.
   */
  setupEventHandlers() {
    this.removeEventHandlers()
    this.setupClickHandler()
    this.setupMouseMoveHandler()
  }

  /**
   * Sets up click handler for feature selection and onclick actions.
   * Override to customize click behavior.
   */
  setupClickHandler() {
    this.clickHandler = (e) => {
      if (draw && draw.getMode() !== 'simple_select') { return }
      if (window.gon.map_mode === 'static') { return }
      // Exit if another layer already selected a feature on this click
      if (e.defaultPrevented) { return }

      console.log('Features clicked', e.features)
      // Skip clusters, unique stack by feature id
      const stack = [...new Map(e.features
        .filter(f => !f.properties?.cluster)
        .map(f => [f.id, f])).values()]
      if (!stack.length) { return }

      // iterate selection through features (in edit mode)
      const currentIdx = stack.findIndex(f => f.id === highlightedFeatureId)
      let feature = (currentIdx === -1 || currentIdx === stack.length - 1)
        ? stack[0]
        : stack[currentIdx + 1]

      if (window.gon.map_mode === 'ro' || e.originalEvent.shiftKey) {
        feature = e.features.find(f => f.properties?.onclick !== false)
        if (!feature) { return }

        if (feature.properties?.onclick === 'link' && feature.properties?.['onclick-target']) {
          window.location.href = feature.properties?.['onclick-target']
          return
        }
        if (feature.properties?.onclick === 'feature' && feature.properties?.['onclick-target']) {
          const targetId = feature.properties?.['onclick-target']
          const targetFeature = getFeature(targetId)
          if (targetFeature) {
            flyToFeature(targetFeature)
          } else {
            console.error('Target feature with id ' + targetId + ' not found')
          }
          return
        }
      }
      highlightFeature(feature, true, this.sourceId)
      // Defer the layer re-upload until after the browser paints the selection state —
      // frontFeature calls setData on the whole layer, which would otherwise stall feedback.
      requestAnimationFrame(() => frontFeature(feature))
      e.preventDefault()
    }

    map.on('click', this.getStyleLayerIds(), this.clickHandler)

    // Double-click opens geometry edit mode directly
    this.dblClickHandler = (e) => {
      if (window.gon.map_mode !== 'rw') { return }
      if (this.type !== 'geojson') { return }
      if (draw && draw.getMode() !== 'simple_select') { return }

      let feature = e.features.find(f => !f.properties?.cluster)
      if (!feature) { return }

      console.log('Double-click on feature:', feature.id)

      highlightFeature(feature, true, this.sourceId)
      requestAnimationFrame(() => frontFeature(feature))

      // Dispatch custom event to open geometry tab
      window.dispatchEvent(new CustomEvent('toggle-edit-feature', {
        detail: { type: 'geometry' }
      }))

      // Prevent map zoom on double-click
      e.preventDefault()
      e.originalEvent.stopPropagation()
    }

    map.on('dblclick', this.getStyleLayerIds(), this.dblClickHandler)
  }

  /**
   * Sets up mousemove handler for hover highlighting (read-only mode only).
   * Override to customize hover behavior.
   */
  setupMouseMoveHandler() {
    if (window.gon.map_mode === 'ro' && !functions.isTouchDevice()) {
      this.mouseMoveHandler = (e) => {
        if (stickyFeatureHighlight && highlightedFeatureId) { return }
        if (document.querySelector('.show > .map-modal')) { return }
        if (!map.getSource(this.sourceId)) { return }

        const features = map.queryRenderedFeatures(e.point, { layers: this.getStyleLayerIds() })
        let feature = features.find(f => !f.properties?.cluster && f.properties?.onclick !== false)

        if (feature?.id) {
          if (feature.id === highlightedFeatureId) { return }
          highlightFeature(feature, false, this.sourceId)
          requestAnimationFrame(() => frontFeature(feature))
        } else if (highlightedFeatureSource === this.sourceId) {
          resetHighlightedFeature()
        }
      }

      map.on('mousemove', this.mouseMoveHandler)
    }
  }

  /**
   * Returns array of MapLibre layer IDs for this source.
   * Override if you have custom layer naming.
   */
  getStyleLayerIds() {
    // Get all layer IDs that belong to this source
    const sourceSuffix = '_' + this.sourceId
    return map.getStyle().layers
      .filter(layer => layer.id.endsWith(sourceSuffix))
      .map(layer => layer.id)
  }

  /**
   * Removes event handlers for this layer.
   * Called before re-initialization and during cleanup.
   */
  removeEventHandlers() {
    if (!map || !map.getStyle()) { return }
    if (this.clickHandler) {
      map.off('click', this.getStyleLayerIds(), this.clickHandler)
      this.clickHandler = null
    }
    if (this.dblClickHandler) {
      map.off('dblclick', this.getStyleLayerIds(), this.dblClickHandler)
      this.dblClickHandler = null
    }
    if (this.mouseMoveHandler) {
      map.off('mousemove', this.mouseMoveHandler)
      this.mouseMoveHandler = null
    }
  }

  /**
   * Cleans up layer resources (event handlers, etc.).
   * Override to add custom cleanup, but call super.cleanup().
   */
  cleanup() {
    this.removeEventHandlers()
  }

  /**
   * Clear any layer-specific highlight state.
   * Override in subclasses that maintain their own highlight state beyond the global highlightedFeatureId.
   */
  clearHighlight() {
    // Default implementation does nothing - most layers rely on global highlightedFeatureId
  }

  /**
   * Reload mode after map was moved
   * - ondemand: 'load for this area button'
   */
  reloadAfterMapMove() {
    return false
  }

  // overwrite all layer properties with data,
  // keep geojson if data does not include it
  update(data) {
    const geojson = this.layer.geojson
    Object.assign(this.layer, data)
    if (geojson && !data.geojson) {
      this.layer.geojson = geojson
    }
  }

  // JSON form of layer without geojson data to compare
  toJSON() {
    const { geojson: _geojson, ...rest } = this.layer
    return rest
  }
}
