import { addGeoJSONSource, map } from 'maplibre/map'

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
 *
 * Example:
 *   class MyLayer extends Layer {
 *     initialize() {
 *       initializeViewStyles(this.sourceId)
 *       initializeClusterStyles(this.sourceId, '/icons/my-icon.png')
 *       return this.loadData()
 *     }
 *
 *     loadData() {
 *       return fetch('/api/my-data')
 *         .then(response => response.json())
 *         .then(data => {
 *           this.layer.geojson = processData(data)
 *           this.render()
 *         })
 *         .catch(error => {
 *           console.error('Failed to load layer:', error)
 *           this.layer.geojson = { type: 'FeatureCollection', features: [] }
 *           this.render()
 *         })
 *     }
 *   }
 *
 * Then register in factory.js:
 *   const layerTypes = { ..., mylayer: MyLayer }
 */
export class Layer {
  constructor(layer) {
    this.layer = layer
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
