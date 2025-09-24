import { hexToRgb } from 'helpers/functions'
import { mapProperties, initializeMaplibreProperties } from 'maplibre/map'
import maplibregl from 'maplibre-gl'

// eslint expects variables to get imported, but we load the full lib in header
const deck = window.deck;

['turbo:load'].forEach(function (e) {
  window.addEventListener(e, function () {
    // console.log(e)
    if (document.getElementById('deck-map')) {
      init()
    }
  })
})

async function init () {
  initializeMaplibreProperties()

  const map = new maplibregl.Map({
    container: 'deck-map', // container ID
    // style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    // style: '/layers/nostreets.json?key=' + window.gon.map_keys.maptiler,
    style: 'https://tiles.versatiles.org/assets/styles/graybeard/style.json',
    // center: [8.271366455078127, 50.013330503465454],
    center: mapProperties.center || mapProperties.default_center,
    zoom: mapProperties.zoom,
    pitch: 45 // tilt the map
  })
  map.addControl(new maplibregl.NavigationControl())

  // await map.once('load')

  // https://deck.gl/docs/api-reference/layers/geojson-layer
  const geojsonLayer = new deck.GeoJsonLayer({
    id: 'geojson',
    data: '/m/' + window.gon.map_id + '.geojson',
    // Styles
    stroked: true, // Ensure strokes are visible
    filled: true,
    pickable: true,
    pointType: 'icon+circle+text', // 'icon+circle+text',

    getIcon: d => ({
      url: d.properties['marker-image-url'],
      height: 100,
      width: 100,
      anchorY: 50
    }),
    onIconError: e => console.log(e),
    getIconSize: 50,
    // sizeScale: 10,
    // sizeMinPixels: 20,
    // getPosition: d => d.position,

    // pointRadiusMinPixels: 2,
    // pointRadiusScale: 5,
    // getPointRadius: f => 1,
    getFillColor: f => hexToRgb(f.properties.fill || '#c0c0c0').concat((f.properties['fill-opacity'] || 1) * 255),
    getLineWidth: f => (f.properties['stroke-width'] || 1) * 0.1, // Stroke width in meters
    getLineColor: f => hexToRgb(f.properties.stroke || '#000').concat((f.properties['stroke-opacity'] || 1) * 255),
    getPointRadius: 4,

    // extruded: true,
    // getElevation: 10,

    // // Interactive props
    // pickable: true,
    autoHighlight: true,
    getText: f => f.properties.label || f.properties.title,
    getTextSize: 12
    // onClick: info =>
    //   // eslint-disable-next-line
    //   info.object && alert(`${info.object.properties['marker-image-url']} (${info.object.properties.abbrev})`)
    // // beforeId: 'watername_ocean' // In interleaved mode, render the layer under map labels
  })

  const deckOverlay = new deck.MapboxOverlay({
    interleaved: true,
    layers: [
      geojsonLayer
    ]
  })

  map.on('load', () => {
    // map.addSource('terrain', {
    //   type: 'raster-dem',
    //   url: 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=' + window.gon.map_keys.maptiler
    // })
    // map.setTerrain({
    //   source: 'terrain',
    //   exaggeration: 1 // Adjust the exaggeration as needed
    // })

    map.addControl(deckOverlay)
  })
}
