import * as functions from 'helpers/functions'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import {
  highlightedFeatureId,
  stickyFeatureHighlight
} from 'maplibre/feature'
import { Layer } from 'maplibre/layers/layer'
import { overpassDescription } from 'maplibre/layers/overpass'
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
   * Override to disable click handler and provide custom mousemove for basemap layers.
   */
  setupEventHandlers() {
    this.removeEventHandlers()
    this.setupClickHandler()
    this.setupMouseMoveHandler()

    this.contextMenuHandler = (e) => {
      e.preventDefault()

      const basemapSource = this.sourceId
      const mapLayers = map.getStyle().layers
      const queryLayerIds = mapLayers.filter(layer => layer.source === basemapSource).map(layer => layer.id)
      const features = map.queryRenderedFeatures(e.point, { layers: queryLayerIds })

      if (features.length) {
        functions.e('#map-context-menu', el => {
          if (el.querySelector('[data-action*="addToGeojsonLayer"]')) { return }
          el.classList.remove('hidden')

          const copyButton = document.createElement('div')
          copyButton.classList.add('context-menu-item')
          copyButton.innerHTML = '<i class="bi bi-copy me-1"></i>Copy to my layer'
          copyButton.dataset.action = 'click->map--context-menu#addToGeojsonLayer'
          copyButton.dataset.featureId = features[0].id
          copyButton.dataset.layerType = 'basemap'
          el.appendChild(copyButton)
        })
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
   * Handles feature highlighting at a given point (used by both mouse and touch).
   */
  highlightFeatureAtPoint(point) {
    if (stickyFeatureHighlight && highlightedFeatureId) { return }
    if (document.querySelector('.show > .map-modal')) { return }

    const basemapSource = basemaps()[mapProperties.base_map].sourceName
    const mapLayers = map.getStyle().layers
    const queryLayerIds = mapLayers.filter(layer => layer.source === basemapSource).map(layer => layer.id)
    const features = map.queryRenderedFeatures(point, { layers: queryLayerIds})

    if (features.length) {
      const feature = features[0]

      // exit early when moving over same feature
      if (JSON.stringify(feature.geometry) === JSON.stringify(this?.selectedFeature?.geometry)) { return }
      this.selectedFeature = feature
      hideContextMenu()

      // console.log('Hovering features: ', features)

      const geojsonFeature = {
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.properties
      }
      geojsonFeature.id = geojsonFeature.properties.id = functions.featureId()
      geojsonFeature.properties.desc = overpassDescription(geojsonFeature.properties)
      const height = geojsonFeature.properties['hoehe'] || geojsonFeature.properties['render_height']
      if (height) {
        geojsonFeature.properties['fill-extrusion-height'] = height
      }

      this.layer.geojson.features = [geojsonFeature]
      map.getSource(this.sourceId).setData(this.layer.geojson, false)
    }
  }

  /**
   * Custom mousemove handler for basemap layer - queries basemap source layers.
   */
  setupMouseMoveHandler() {
    this.mouseMoveHandler = (e) => {
      this.highlightFeatureAtPoint(e.point)
    }

    this.touchStartHandler = (e) => {
      // Only handle single touch
      if (e.originalEvent.touches && e.originalEvent.touches.length !== 1) { return }
      this.highlightFeatureAtPoint(e.point)
    }

    map.on('mousemove', this.mouseMoveHandler)
    map.on('touchstart', this.touchStartHandler)
  }
}
