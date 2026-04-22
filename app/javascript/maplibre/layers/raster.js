import { Layer } from 'maplibre/layers/layer'
import { map } from 'maplibre/map'

export class RasterLayer extends Layer {
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

    // Add attribution for known raster layer providers
    if (this.query.includes('waymarkedtrails.org')) {
      sourceConfig.attribution = 'Map overlay &copy; <a href="https://waymarkedtrails.org" target="_blank">Waymarked Trails</a>'
    }

    map.addSource(this.sourceId, sourceConfig)
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

    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve()
  }

  render() {
    // No-op for raster layers
  }

  setupEventHandlers() {
    // No feature interaction for raster layers
  }
}
