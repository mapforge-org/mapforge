import { hexToRgb } from 'helpers/functions'
import { initializeOverlay, removeDeckLayer, setDeckLayer } from 'maplibre/layers/deckgl/overlay'
import { generateWallGeometry } from 'maplibre/layers/deckgl/wall_geometry'
import { Layer } from 'maplibre/layers/layer'

/**
 * DeckGL Layer - renders GeoJSON features using deck.gl instead of MapLibre style layers.
 *
 * Key differences from standard GeoJSON layers:
 * - No MapLibre source or style layers (deck.gl renders via its own WebGL context)
 * - Immutable layer pattern (create new deck.GeoJsonLayer instance to update)
 * - Functional styling via accessor functions instead of declarative style spec
 * - Built-in GPU picking for interactivity
 * - Polygon extrusion works (fill-extrusion-height), but LineString extrusion doesn't
 *   (deck.gl GeoJsonLayer only extrudes Polygons, not lines)
 */
export class DeckGLLayer extends Layer {
  /**
   * No-op: deck.gl doesn't use MapLibre sources
   */
  createSource() {
    // Skip MapLibre source creation
  }

  /**
   * Initialize deck.gl overlay and create the deck.gl layer.
   */
  async initialize() {
    await initializeOverlay()

    if (!this.layer.geojson || this.layer.geojson.features.length === 0) {
      await this.loadData()
    }

    this.render()
    return Promise.resolve()
  }

  /**
   * Load GeoJSON data from the map endpoint (copies all features from geojson layers).
   */
  async loadData() {
    const url = '/m/' + window.gon.map_id + '.geojson'
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to load GeoJSON: ' + response.statusText)
    }
    this.layer.geojson = await response.json()
    return this.layer.geojson
  }

  /**
   * Renders the layer by creating a deck.gl GeoJsonLayer instance.
   * deck.gl layers are immutable, so we create a new one each time.
   * Also creates a SolidPolygonLayer for 3D LineString walls.
   */
  render() {
    if (!window.deck) {
      console.error('deck.gl not loaded')
      return
    }

    const layers = []

    // Main GeoJSON layer for all features
    const mainLayer = new window.deck.GeoJsonLayer({
      id: `deckgl-${this.id}`,
      data: this.geojson,
      visible: this.show !== false,

      stroked: true,
      filled: true,
      extruded: true,
      pickable: true,
      pointType: 'circle+text',
      _full3d: true,

      getFillColor: f => {
        const rgb = hexToRgb(f.properties.fill || '#c0c0c0')
        const opacity = (f.properties['fill-opacity'] || 1) * 255
        return rgb.concat(opacity)
      },

      getLineColor: f => {
        const rgb = hexToRgb(f.properties.stroke || '#000')
        const opacity = (f.properties['stroke-opacity'] || 1) * 255
        return rgb.concat(opacity)
      },

      getLineWidth: f => (f.properties['stroke-width'] || 2)*3,
      lineWidthUnits: 'pixels',

      // Only works for Polygons, not LineStrings
      // (deck.gl GeoJsonLayer doesn't support LineString extrusion)
      getElevation: f => f.properties['fill-extrusion-height'] || 0,

      getPointRadius: 6,
      pointRadiusUnits: 'pixels',

      autoHighlight: true,
      highlightColor: [255, 200, 0, 180],

      getText: f => f.properties.label || f.properties.title || '',
      getTextSize: 12,
      getTextColor: [0, 0, 0, 255],
      getTextBackgroundColor: [255, 255, 255, 200],
      textBackground: true,

      onClick: (info) => {
        if (info.object) {
          console.log('deck.gl feature clicked', info.object)
          // deck.gl handles highlighting via autoHighlight
          // Don't call highlightFeature() - it expects a MapLibre source
        }
      },

      onHover: (info) => {
        if (info.object) {
          document.body.style.cursor = 'pointer'
        } else {
          document.body.style.cursor = ''
        }
      }
    })

    layers.push(mainLayer)

    // Add 3D wall layer for LineStrings with fill-extrusion-height
    const wallFeatures = generateWallGeometry(this.geojson.features || [])
    if (wallFeatures.length > 0) {
      const wallLayer = new window.deck.SolidPolygonLayer({
        id: `deckgl-walls-${this.id}`,
        data: wallFeatures,
        visible: this.show !== false,
        pickable: true,
        filled: true,
        extruded: false,
        _full3d: true,

        getPolygon: f => f.geometry.coordinates[0],
        getFillColor: f => {
          const rgb = hexToRgb(f.properties['fill-extrusion-color'] || '#888')
          const opacity = (f.properties['stroke-opacity'] || 1) * 255
          return rgb.concat(opacity)
        }
      })

      layers.push(wallLayer)
    }

    setDeckLayer(this.id, layers)
  }

  /**
   * No-op: deck.gl handles events via onClick/onHover callbacks
   */
  setupEventHandlers() {
    // Events are configured in the deck.gl layer config
  }

  /**
   * No-op: deck.gl handlers are removed when the layer is removed from the overlay
   */
  removeEventHandlers() {
    // No-op
  }

  /**
   * Returns empty array since deck.gl layers have no MapLibre style layers
   */
  getStyleLayerIds() {
    return []
  }

  /**
   * Updates visibility by recreating the deck.gl layer with new visible prop.
   */
  setVisibility(visible) {
    this.show = visible
    this.render()
  }

  /**
   * Cleanup: remove from overlay
   */
  cleanup() {
    removeDeckLayer(this.id)
    super.cleanup()
  }
}
