import { map } from 'maplibre/map'
import { showFeatureDetails } from 'maplibre/feature'
import { draw } from 'maplibre/edit'

export function initializeMapStyles() {
  if (window.gon.map_mode === 'rw') {
    // const select_layers = ["building-3d"]

    map.addSource('highlight', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    })

    map.addLayer({
      id: 'highlight-linestring-layer',
      type: 'line',
      filter: ['all',
        ['in', '$type', 'LineString']],
      source: 'highlight',
      paint: {
        'line-color': '#ff0000'
      }
    }) 

    map.addLayer({
      id: 'highlight-circle-layer',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point']],
      source: 'highlight',
      paint: {
        'circle-color': '#ff0000',
        'circle-radius': 10,
        'circle-stroke-color': '#ff0000',
        'circle-stroke-width': 2
      }
    }) 

    map.addLayer({
      id: 'highlight-polygon-layer',
      type: 'fill',
      filter: ['all',
        ['in', '$type', 'Polygon']],
      source: 'highlight',
      paint: {
        'fill-color': '#ff0000'
      }
    })  
    
    map.addLayer({
      id: 'highlight-extrusion-layer',
      type: 'fill-extrusion',
      filter: ['all',
        ['in', '$type', 'Polygon']],
      source: 'highlight',
      paint: {
        'fill-extrusion-color': '#ff0000'
      }
    })

    map.on('click', function (e) {
      const features = map.queryRenderedFeatures(e.point)
      if (draw && draw.getMode() !== 'simple_select') { return }
      if (!features?.length) { return }
      
      console.log(features)
      let feature = features[0]

      // Update highlight source with clicked feature
      map.getSource('highlight').setData({
        type: 'FeatureCollection',
        features: [feature]
      })

      showFeatureDetails(feature)
    })
  }
}