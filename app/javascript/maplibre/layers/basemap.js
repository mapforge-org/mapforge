import * as functions from 'helpers/functions';
import {
  highlightedFeatureId,
  stickyFeatureHighlight
} from 'maplibre/feature';
import { layers } from 'maplibre/layers/layers';
import { overpassDescription } from 'maplibre/layers/overpass';
import { addGeoJSONSource, map, mapProperties } from 'maplibre/map';
import { basemaps } from 'maplibre/styles/basemaps';
import { initializeViewStyles } from 'maplibre/styles/styles';

export function initializeBaseMapLayers() {
  if (!basemaps()[mapProperties.base_map].sourceName) { return }

  let layerId = functions.featureId()
  // must match server attribute order, for proper comparison in map_channel
  let layer = { "id": layerId, "type": 'basemap', "name": 'basemap', geojson: { type: 'FeatureCollection', features: [] } }
  layers.push(layer)

  const basemapSource = basemaps()[mapProperties.base_map].sourceName
  const highlightSource = "basemap_" + basemapSource + "_highlight"
  const mapLayers = map.getStyle().layers

  addGeoJSONSource(highlightSource)
  initializeViewStyles(highlightSource)

  map.on('mousemove', (e) => {
    if (stickyFeatureHighlight && highlightedFeatureId) { return }
    if (document.querySelector('.show > .map-modal')) { return }

    const queryLayerIds = mapLayers.filter(layer => layer.source === basemapSource).map(layer => layer.id)
    const features = map.queryRenderedFeatures(e.point, { layers: queryLayerIds})

    if (features.length) {
      //console.log('Features hovered', features)

      const feature = features[0]

      // ✅ Geometry ist bereits in WGS84 (lng/lat)
      const geojsonFeature = {
        type: 'Feature',
        geometry: feature.geometry,
        properties: feature.properties
      }
      geojsonFeature.id = geojsonFeature.properties.id = functions.featureId()
      geojsonFeature.properties.desc = overpassDescription(geojsonFeature.properties)

      console.log('GeoJSON:', geojsonFeature)

      layer.geojson.features = [geojsonFeature]
      map.getSource(highlightSource).setData(layer.geojson, false)
    }




  })

}