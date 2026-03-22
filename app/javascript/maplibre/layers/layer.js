import { addGeoJSONSource, map } from 'maplibre/map'

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
   * Returns Promise for loading data.
   */
  initialize() {
    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve(this.layer?.geojson)
  }

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
