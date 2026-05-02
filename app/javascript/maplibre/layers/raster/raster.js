import * as functions from 'helpers/functions'
import { highlightFeature } from 'maplibre/feature'
import { Layer } from 'maplibre/layers/layer'
import { extractTheme, fetchNearestRoute, fetchRouteDetails } from 'maplibre/layers/raster/waymarkedtrails'
import { addGeoJSONSource, map } from 'maplibre/map'

export class RasterLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.mapClickHandler = null
    this.mapContextMenuHandler = null
    this.isWaymarkedtrails = layer.query && layer.query.includes('waymarkedtrails.org')
  }

  set show(value) {
    this.layer.show = value
    if (!value && this.isWaymarkedtrails) {
      this.render(null)
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

    map.addLayer({
      id: 'raster-layer_' + this.sourceId,
      type: 'raster',
      source: this.sourceId,
      paint: {
        'raster-opacity': 0.9
      }
    })

    if (this.isWaymarkedtrails) {
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
    }

    this.setupEventHandlers()
    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve()
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
      }
    }
  }

  async fetchAndStoreRoute(theme, lng, lat) {
    const route = await fetchNearestRoute(theme, lng, lat)
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

      const feature = await this.fetchAndStoreRoute(theme, e.lngLat.lng, e.lngLat.lat)

      if (!feature) {
        this.render(null)
        return
      }

      this.render(feature.id)

      const geojsonSourceId = this.sourceId + '-features'
      highlightFeature(feature, true, geojsonSourceId)
    }

    map.on('click', this.mapClickHandler)

    this.mapContextMenuHandler = async (e) => {
      e.preventDefault()

      if (!this.show) return

      const feature = await this.fetchAndStoreRoute(theme, e.lngLat.lng, e.lngLat.lat)
      if (!feature) return

      this.render(feature.id)

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
