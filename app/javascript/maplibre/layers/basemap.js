import * as functions from 'helpers/functions'
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
  get sourceId() {
    const basemapSource = basemaps()[mapProperties.base_map].sourceName
    return "basemap_" + basemapSource + "_highlight"
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
    // No click handler needed for basemap layer
    this.setupMouseMoveHandler()
  }

  /**
   * Custom mousemove handler for basemap layer - queries basemap source layers.
   */
  setupMouseMoveHandler() {
    this.mouseMoveHandler = (e) => {
      if (stickyFeatureHighlight && highlightedFeatureId) { return }
      if (document.querySelector('.show > .map-modal')) { return }

      const basemapSource = basemaps()[mapProperties.base_map].sourceName
      const mapLayers = map.getStyle().layers
      const queryLayerIds = mapLayers.filter(layer => layer.source === basemapSource).map(layer => layer.id)
      const features = map.queryRenderedFeatures(e.point, { layers: queryLayerIds})

      if (features.length) {
        console.log('Selected features: ', features)
        const feature = features[0]

        const geojsonFeature = {
          type: 'Feature',
          geometry: feature.geometry,
          properties: feature.properties
        }
        geojsonFeature.id = geojsonFeature.properties.id = functions.featureId()
        geojsonFeature.properties.desc = overpassDescription(geojsonFeature.properties)

        this.layer.geojson.features = [geojsonFeature]
        map.getSource(this.sourceId).setData(this.layer.geojson, false)
      }
    }

    map.on('mousemove', this.mouseMoveHandler)
  }
}
