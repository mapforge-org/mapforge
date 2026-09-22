import { status } from 'helpers/status';
import * as maplibregl from 'maplibre-gl';
import { map } from 'maplibre/map';
import { demSource, elevationSource } from 'maplibre/styles/basemaps';
import { defaults } from 'maplibre/styles/defaults';

// Add terrain/hillshade/contours before the user layers, so they're in the base layer group
// when sortLayers() runs, keeping them below user GeoJSON features
export function addElevationLayers (properties, basemapName) {
  demSource.setupMaplibre(maplibregl)
  const elevation = basemapName !== 'test'
  if (elevation && properties.terrain) { addTerrain() }
  if (elevation && properties.hillshade) { addHillshade() }
  if (properties.globe) { addGlobe() }
  if (elevation && properties.contours) { addContours() }
}

function addTerrain () {
  map.addSource('map-terrain', elevationSource)
  map.setTerrain({
    source: 'map-terrain',
    exaggeration: 0.05
  })
  status(window.__('Terrain added to map'))
}

function addHillshade () {
  map.addSource('map-hillshade', elevationSource)
  map.addLayer({
    id: 'hills',
    type: 'hillshade',
    source: 'map-hillshade',
    layout: { visibility: 'visible' },
    paint: {
      "hillshade-method": "standard",
      'hillshade-shadow-color': '#473B24',
      "hillshade-exaggeration": 0.2
    }
  })
  status(window.__('Hillshade added to map'))
}

function addContours () {
  map.addSource('map-contours', {
    type: "vector",
    tiles: [
      demSource.contourProtocolUrl({
        thresholds: {
          // zoom: [minor, major]
          10: [200, 400],
          11: [200, 400],
          12: [100, 200],
          13: [100, 200],
          14: [50, 100],
          15: [20, 100],
        },
        elevationKey: "ele",
        levelKey: "level",
        contourLayer: "contours",
        buffer: 1,
        overzoom: 2
      }),
    ],
    maxzoom: 16,
  })
  map.addLayer({
    id: "contours",
    type: "line",
    source: "map-contours",
    "source-layer": "contours",
    paint: {
      "line-color": "rgba(0,0,0, 50%)",
      "line-width": ["match", ["get", "level"], 1, 1, 0.5],
    },
    layout: {
      "line-join": "round",
    },
  })
  map.addLayer({
    id: "contour-text",
    type: "symbol",
    source: "map-contours",
    "source-layer": "contours",
    filter: [">", ["get", "level"], 0],
    paint: {
      "text-halo-color": "white",
      "text-halo-width": 1,
    },
    layout: {
      "symbol-placement": "line",
      "text-anchor": "center",
      "text-size": 11,
      "text-field": [
        "concat",
        ["number-format", ["get", "ele"], {}],
        "m",
      ],
      "text-font": [defaults.font]
    }
  })
  status(window.__('Contour lines added to map'))
}

function addGlobe () {
  // https://maplibre.org/maplibre-style-spec/projection/
  map.setProjection({ type: 'globe' })
  // see https://maplibre.org/maplibre-gl-js/docs/examples/sky-with-fog-and-terrain/
  map.setSky({
    'atmosphere-blend': [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, 1,
      5, 1,
      7, 0
    ]
  })
}
