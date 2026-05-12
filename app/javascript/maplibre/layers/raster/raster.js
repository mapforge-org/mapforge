import * as functions from 'helpers/functions'
import { draw } from 'maplibre/edit'
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature'
import { Layer } from 'maplibre/layers/layer'
import { layers } from 'maplibre/layers/layers'
import { extractTheme, fetchNearestRoute, fetchRouteDetails } from 'maplibre/layers/raster/waymarkedtrails'
import { addGeoJSONSource, map, removeStyleLayers } from 'maplibre/map'

export class RasterLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.mapClickHandler = null
    this.mapContextMenuHandler = null
    this.isWaymarkedtrails = layer.query && layer.query.includes('waymarkedtrails.org')
    this.highlightedFeatureId = null
  }

  set show(value) {
    this.layer.show = value
    if (!value && this.isWaymarkedtrails) {
      this.clearHighlight()
    }
  }

  get show() {
    return this.layer.show
  }

  createSource() {
    if (!this.query) { return }
    if (map.getSource(this.sourceId)) {
      console.log('Source ' + this.sourceId + ' already exists, skipping add')
      return
    }

    const sourceConfig = {
      type: 'raster',
      tiles: [this.query],
      tileSize: 256
    }

    if (this.isWaymarkedtrails) {
      sourceConfig.attribution = 'Map overlay &copy; <a href="https://waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    }

    map.addSource(this.sourceId, sourceConfig)

    if (this.isWaymarkedtrails) {
      const geojsonSourceId = this.sourceId + '-features'
      if (!map.getSource(geojsonSourceId)) {
        addGeoJSONSource(geojsonSourceId, false)
      }
    }
  }

  initialize() {
    if (!this.query) { return Promise.resolve() }

    // Make idempotent: existing layers/handlers must be cleared.
    removeStyleLayers(this.sourceId)
    if (this.isWaymarkedtrails) {
      removeStyleLayers(this.sourceId + '-features')
    }
    this.removeEventHandlers()

    map.addLayer({
      id: 'raster-layer_' + this.sourceId,
      type: 'raster',
      source: this.sourceId,
      paint: {
        'raster-opacity': 0.9
      }
    })

    if (this.isWaymarkedtrails) {
      // Styles defined here rather than in styles.js: these are simple static layers
      // for a single highlighted track, unlike the geojson styles which need feature-state,
      // dasharray, hit-test layers, and dynamic color expressions.
      const geojsonSourceId = this.sourceId + '-features'

      // Outline layer (black border) - rendered first (below)
      map.addLayer({
        id: 'line-outline_' + geojsonSourceId,
        type: 'line',
        source: geojsonSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#000',
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            8, 6,
            20, 18
          ],
          'line-opacity': 0.9
        }
      })

      // Main line layer (colored route) - rendered on top
      map.addLayer({
        id: 'line_' + geojsonSourceId,
        type: 'line',
        source: geojsonSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            8, 4,
            20, 14
          ],
          'line-opacity': 0.9
        }
      })

      // osmc:symbol badge along route (mirrors styles.js stroke-image-url layer)
      map.addLayer({
        id: 'line-symbol_' + geojsonSourceId,
        type: 'symbol',
        source: geojsonSourceId,
        filter: ['has', 'stroke-image-url'],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 100,
          'icon-image': ['get', 'stroke-image-url'],
          'icon-size': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1.1, 18, 1.8],
          'icon-rotation-alignment': 'viewport'
        }
      })

      // Label layer for route names
      map.addLayer({
        id: 'line-labels_' + geojsonSourceId,
        type: 'symbol',
        source: geojsonSourceId,
        filter: ['has', 'label'],
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 14,
          'text-max-angle': 30,
          'text-keep-upright': true,
          'text-rotation-alignment': 'map',
          'symbol-spacing': 200
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 2
        }
      })
    }

    this.setupEventHandlers()
    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve()
  }

  clearHighlight() {
    if (this.highlightedFeatureId) {
      this.highlightedFeatureId = null
      this.render(null)
    }
  }

  render(highlightedFeatureId = null) {
    if (this.isWaymarkedtrails) {
      const geojsonSourceId = this.sourceId + '-features'
      const source = map.getSource(geojsonSourceId)
      if (source && this.layer.geojson) {
        const featuresToRender = highlightedFeatureId
          ? this.layer.geojson.features.filter(f => f.id === highlightedFeatureId)
          : []
        source.setData({
          type: 'FeatureCollection',
          features: featuresToRender
        })
        if (highlightedFeatureId) {
          const layerIds = ['line-outline_', 'line_', 'line-symbol_', 'line-labels_'].map(p => p + geojsonSourceId)
          layerIds.forEach(id => { if (map.getLayer(id)) map.moveLayer(id) })
        }
      }
    }
  }

  async fetchAndStoreRoute(theme, lng, lat) {
    const route = await fetchNearestRoute(theme, lng, lat, map.getZoom())
    if (!route) return null

    const feature = await fetchRouteDetails(theme, route.id)
    if (!feature) return null

    if (!this.layer.geojson) {
      this.layer.geojson = { type: 'FeatureCollection', features: [] }
    }

    const existingIndex = this.layer.geojson.features.findIndex(f => f.id === feature.id)
    if (existingIndex >= 0) {
      this.layer.geojson.features[existingIndex] = feature
    } else {
      this.layer.geojson.features.push(feature)
    }

    return feature
  }

  setupEventHandlers() {
    if (!this.isWaymarkedtrails) return

    const theme = extractTheme(this.query)
    if (!theme) {
      console.warn('Could not extract theme from waymarkedtrails URL:', this.query)
      return
    }

    this.mapClickHandler = async (e) => {
      if (!this.show) return

      // Skip waymarkedtrails selection when draw mode is active (not simple_select)
      if (draw && draw.getMode() !== 'simple_select') return

      // Skip if clicking on draw elements (vertices, midpoints, active features)
      if (draw) {
        const allFeatures = map.queryRenderedFeatures(e.point)
        const drawFeature = allFeatures.find(f => f.layer?.id?.startsWith('gl-draw-'))
        if (drawFeature) return
      }

      // Priority: skip waymarkedtrails if user has geojson features at this location
      const geojsonLayers = layers?.filter(l => l.type === 'geojson' && l.show) || []
      if (geojsonLayers.length > 0) {
        const geojsonLayerIds = geojsonLayers.flatMap(l => l.getStyleLayerIds())
        const geojsonFeatures = map.queryRenderedFeatures(e.point, { layers: geojsonLayerIds })
        const geojsonFeature = geojsonFeatures.find(f => !f.properties?.cluster)
        if (geojsonFeature) {
          // User's geojson feature takes priority - don't select waymarkedtrails
          return
        }
      }

      const feature = await this.fetchAndStoreRoute(theme, e.lngLat.lng, e.lngLat.lat)

      if (!feature) {
        this.clearHighlight()
        return
      }

      // Clear any existing highlights before setting waymarkedtrails highlight
      resetHighlightedFeature()

      this.highlightedFeatureId = feature.id
      this.render(feature.id)

      const geojsonSourceId = this.sourceId + '-features'
      highlightFeature(feature, true, geojsonSourceId)
    }

    map.on('click', this.mapClickHandler)

    this.mapContextMenuHandler = (e) => {
      e.preventDefault()

      if (!this.show || !this.highlightedFeatureId) return

      const feature = this.layer.geojson?.features.find(f => f.id === this.highlightedFeatureId)
      if (!feature) return

      functions.e('#map-context-menu', el => {
        if (el.querySelector('[data-action*="addToGeojsonLayer"]')) { return }
        el.classList.remove('hidden')
        const copyButton = document.createElement('div')
        copyButton.classList.add('context-menu-item')
        copyButton.innerHTML = '<i class="bi bi-copy me-1"></i>Copy to my layer'
        copyButton.dataset.action = 'click->map--context-menu#addToGeojsonLayer'
        copyButton.dataset.featureId = feature.id
        copyButton.dataset.layerType = 'raster'
        el.appendChild(copyButton)
      })
    }

    map.on('contextmenu', this.mapContextMenuHandler)
  }

  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.mapClickHandler) {
      map.off('click', this.mapClickHandler)
      this.mapClickHandler = null
    }
    if (this.mapContextMenuHandler) {
      map.off('contextmenu', this.mapContextMenuHandler)
      this.mapContextMenuHandler = null
    }
  }
}
