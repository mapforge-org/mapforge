import * as functions from 'helpers/functions'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import {
  highlightedFeatureId,
  stickyFeatureHighlight
} from 'maplibre/feature'
import { Layer } from 'maplibre/layers/layer'
import { overpassDescription } from 'maplibre/layers/osm_description'
import { map, mapProperties } from 'maplibre/map'
import { basemaps } from 'maplibre/styles/basemaps'
import { initializeViewStyles } from 'maplibre/styles/styles'

// Highlights the basemap feature under the cursor, copied into the own source of this layer
export class BasemapLayer extends Layer {
  initialize() {
    if (!basemaps()[mapProperties.base_map].sourceName) { return Promise.resolve() }

    initializeViewStyles(this.sourceId)
    this.setupEventHandlers()

    return Promise.resolve()
  }

  setupEventHandlers() {
    super.setupEventHandlers()
    // the hovered feature was stored by highlightFeatureAtPoint, with an id of its own
    this.listenForCopy()
    this.listen('mousemove', functions.perFrame((e) => {
      this.highlightFeatureAtPoint(e.point)
    }))
    this.listen('touchstart', (e) => {
      if (e.originalEvent.touches && e.originalEvent.touches.length !== 1) { return }
      this.highlightFeatureAtPoint(e.point)
    })
  }

  highlightable(_feature) { return true }

  // top-most first
  basemapFeaturesAtPoint(point) {
    const basemapSource = basemaps()[mapProperties.base_map].sourceName
    const queryLayerIds = map.getLayersOrder().filter(id => map.getLayer(id)?.source === basemapSource)
    return map.queryRenderedFeatures(point, { layers: queryLayerIds })
      .filter(feature => this.highlightable(feature))
  }

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

  // returns the rendered geojson feature
  renderHighlight(feature) {
    const geojsonFeature = this.toGeoJSON(feature)
    this.geojson.features = [geojsonFeature]
    map.getSource(this.sourceId).setData(this.geojson, false)
    return geojsonFeature
  }

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
}
