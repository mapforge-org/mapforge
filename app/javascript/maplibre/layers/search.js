import { addCopyToLayerMenuItem } from 'maplibre/controls/context_menu'
import { Layer } from 'maplibre/layers/layer'
import { map } from 'maplibre/map'
import { initializeViewStyles } from 'maplibre/styles/styles'

// Geocoder results live in their own source so they get the same click, hover and
// context menu handling as the other layers. The instance stays out of the global
// 'layers' array: the results are transient and must not reach the layers modal,
// the undo stack or the server.
export class SearchLayer extends Layer {
  constructor() {
    super({ id: 'results', type: 'search', name: 'Search results',
      geojson: { type: 'FeatureCollection', features: [] } })
    this.contextMenuHandler = null
  }

  initialize() {
    this.createSource()
    initializeViewStyles(this.sourceId)
    this.setupEventHandlers()
    return Promise.resolve()
  }

  setupEventHandlers() {
    super.setupEventHandlers()

    this.contextMenuHandler = (e) => {
      e.preventDefault()
      const features = map.queryRenderedFeatures(e.point, { layers: this.getStyleLayerIds() })
      if (!features.length) { return }

      addCopyToLayerMenuItem(this.geojson.features.find(f => f.id === features[0].id))
    }
    map.on('contextmenu', this.contextMenuHandler)
  }

  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.contextMenuHandler) {
      if (map?.getStyle()) { map.off('contextmenu', this.contextMenuHandler) }
      this.contextMenuHandler = null
    }
  }

  setResults(features) {
    this.layer.geojson = { type: 'FeatureCollection', features: features }
    this.render()
  }

  clearResults() {
    this.setResults([])
  }

  // -1 deactivates all of them again
  setActive(index) {
    this.geojson.features.forEach((feature, i) => {
      map.setFeatureState({ source: this.sourceId, id: feature.id }, { active: i === index })
    })
  }
}

let instance = null

// A basemap change calls map.setStyle, which drops every source and style layer,
// so the source is rebuilt on demand. Both initializeViewStyles and
// setupEventHandlers clean up after themselves, so initialize() is safe to repeat.
export function searchLayer() {
  if (!instance) { instance = new SearchLayer() }
  if (!map.getSource(instance.sourceId)) { instance.initialize() }
  return instance
}

// Drops the results and the handlers of the previous map on navigation.
export function resetSearchLayer() {
  instance?.cleanup()
  instance = null
}
