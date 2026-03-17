import { map } from 'maplibre/map'

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

  get sourceId() {
    return `${this.type}-source-${this.id}`
  }

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
}
