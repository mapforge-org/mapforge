import { BasemapLayer } from 'maplibre/layers/basemap'
import { GeoJSONLayer } from 'maplibre/layers/geojson'
import { Layer } from 'maplibre/layers/layer'
import { OverpassLayer } from 'maplibre/layers/overpass'
import { WikipediaLayer } from 'maplibre/layers/wikipedia'

const layerTypes = {
  geojson: GeoJSONLayer,
  overpass: OverpassLayer,
  wikipedia: WikipediaLayer,
  basemap: BasemapLayer
}

export function createLayerInstance(data) {
  const LayerClass = layerTypes[data.type] || Layer
  return new LayerClass(data)
}
