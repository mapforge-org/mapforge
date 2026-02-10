import { pointSize, pointSizeMax, styles } from 'maplibre/styles/styles'

// started from https://github.com/mapbox/mapbox-gl-draw/blob/main/src/lib/theme.js
// Styling Draw: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md#styling-draw
// mode == 'active': selected for editing
// mode != 'active': normal display
// mode == 'static': not available for editing
//
// mapbox gl draw doesn't use 'feature-state', but switches between different
// source layers 'mapbox-gl-draw-cold' + 'mapbox-gl-draw-hot'

export const highlightColor = '#fbb03b'
const midpointSize = 6
const vertexSize = 6

export function editStyles() {
  return [
    // removeSource(styles()['polygon-layer']), // gl-draw-polygon-fill-inactive
    removeSource(styles()['polygon-layer-outline']),
    removeSource(styles()['line-layer-outline']), // line outline below line, because it's a wider line
    // removeSource(styles()['line-layer']),

    // active polygon outline
    {
      id: 'gl-draw-polygon-stroke-active',
      type: 'line',
      filter: ['all',
        ['==', 'active', 'true'],
        ['==', '$type', 'Polygon']],
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': highlightColor,
        'line-dasharray': [0.2, 2],
        'line-width': 5
      }
    },
    // active linestring
    {
      id: 'gl-draw-line-active',
      type: 'line',
      filter: ['all',
        ['==', '$type', 'LineString'],
        ['==', 'active', 'true']
      ],
      layout: {
        'line-cap': 'round',
        'line-join': 'round'
      },
      paint: {
        'line-color': highlightColor,
        'line-dasharray': [0.2, 2],
        'line-width': 5
      }
    },
    // midpoints to extend lines/polygons
    // https://github.com/mapbox/mapbox-gl-draw/blob/main/src/lib/create_midpoint.js
    {
      id: 'gl-draw-polygon-midpoint',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['==', 'meta', 'midpoint'],
        // only show midpoints if this is not a route
        // parent properties are patched into the midpoint properties
        ['!has', 'user_route']
      ],
      paint: {
        'circle-radius': midpointSize,
        'circle-color': 'grey',
        'circle-opacity': 0.8,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1
      }
    },
    // default point behind symbols and transparent points
    {
      id: 'gl-draw-point-point-stroke-inactive',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['==', 'meta', 'feature'],
        ['!=', 'mode', 'static'],
        ['!has', 'user_route']
      ],
      paint: {
        'circle-radius': pointSize,
        'circle-opacity': [
          'match', ['get', 'user_marker-color'], 'transparent', 0.2, 0],
        'circle-color': '#c0c0c0'
      }
    },

    // active point, either single or on a line / polygon
    {
      id: 'gl-draw-point-stroke-active',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['==', 'active', 'true'],
        ['!=', 'meta', 'midpoint']
      ],
      paint: {
        'circle-radius': ['*', pointSizeMax, 2],
        'circle-color': '#ffffff',
        'circle-opacity': 0.2,
        'circle-stroke-color': highlightColor,
        'circle-stroke-width': 3
      }
    },

    // outline border of inactive vertex points on lines + polygons,
    // rendering outline seperately to generate nicer overlay effect
    {
      id: 'gl-draw-polygon-and-line-vertex-outline-inactive',
      type: 'circle',
      filter: ['all',
        ['==', 'meta', 'vertex'],
        ['==', '$type', 'Point'],
        ['!=', 'mode', 'static'],
        ['!has', 'user_route']
      ],
      paint: {
        'circle-radius': vertexSize,
        'circle-opacity': 0,
        'circle-stroke-color': '#444',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 1
      }
    },
    // inactive vertex points on lines + polygons (non-route)
    {
      id: 'gl-draw-polygon-and-line-vertex-inactive',
      type: 'circle',
      filter: ['all',
        ['==', 'meta', 'vertex'],
        ['==', '$type', 'Point'],
        ['!=', 'mode', 'static'],
        ['!has', 'user_route']
      ],
      paint: {
        'circle-radius': vertexSize,
        'circle-color': highlightColor
      }
    },
    // Route point borders (rendered like midpoints in normal linestring)
    {
      id: 'gl-draw-route-vertex-inactive-midpoint-border',
      type: 'circle',
      filter: ['all',
        ['==', 'meta', 'vertex'],
        ['==', '$type', 'Point'],
        ['!=', 'mode', 'static'],
        ['has', 'user_route']
      ],
      paint: {
        'circle-radius': 4,
        'circle-opacity': 0,
        'circle-stroke-opacity': 1,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1,
      }
    },
    // Route midpoints (rendered like midpoints in normal linestring)
    {
      id: 'gl-draw-route-vertex-inactive-midpoint',
      type: 'circle',
      filter: ['all',
        ['==', 'meta', 'vertex'],
        ['==', '$type', 'Point'],
        ['!=', 'mode', 'static'],
        ['has', 'user_route']
      ],
      paint: {
        'circle-radius': 4,
        'circle-color': 'grey',
        'circle-opacity': 0.7
      }
    },
    //
    // {
    //   id: "maplibre-gl-directions-waypoint",
    //   type: "line",
    // }

  ]
}

export function removeSource (style) {
  // eslint-disable-next-line no-unused-vars
  const { source, ...filteredStyle } = style
  return filteredStyle
}
