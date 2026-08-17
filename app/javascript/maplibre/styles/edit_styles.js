
import { addCopyMenuItem, addDeleteMenuItem, addLineMenuItems, addLineVertexMenuItems } from 'maplibre/controls/context_menu'
import { draw } from 'maplibre/edit'
import { highlightFeature } from 'maplibre/feature'
import { queryFeaturesNear } from 'maplibre/layers/layer'
import { getFeature } from 'maplibre/layers/layers'
import { editDefaults } from 'maplibre/styles/defaults'
import { pointSize, pointSizeMax, styles } from 'maplibre/styles/styles'

// started from https://github.com/mapbox/mapbox-gl-draw/blob/main/src/lib/theme.js
// Styling Draw: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md#styling-draw
// mode == 'active': selected for editing
// mode != 'active': normal display
// mode == 'static': not available for editing
//
// mapbox gl draw doesn't use 'feature-state', but switches between different
// source layers 'mapbox-gl-draw-cold' + 'mapbox-gl-draw-hot'

export function initializeEditStyles() {
  map.on('contextmenu', (e) => {
    e.preventDefault()
    const features = queryFeaturesNear(e.point)

    if (draw.getMode() !== 'simple_select') {
      // console.log(features)
      // Only show actions for the first vertex found under cursor
      let vertexHandled = false
      let lineHandled = false
      for (const f of features) {
        // on right-click layer id is .cold, on touch it's .hot
        if (!vertexHandled && (f.layer.id === 'gl-draw-polygon-and-line-vertex-inactive.cold' ||
          f.layer.id === 'gl-draw-polygon-and-line-vertex-inactive.hot')
        ) {
          addLineVertexMenuItems(f)
          vertexHandled = true
        }
        // the outline match also covers route extras tracks, which mainLineFilter keeps out
        // of line-layer_
        if (!lineHandled && (f.layer.id.startsWith('line-layer_geojson') ||
          f.layer.id.startsWith('line-layer-outline_geojson'))){
          addLineMenuItems(f)
          lineHandled = true
        }
      }
    }

    for (const f of features) {
      if (f.properties.id && f.layer.id.includes('_geojson-source-')) {
        // f.geometry.type is from the tiled render and can wrongly report MultiLineString
        const geometryType = getFeature(f.properties.id, 'geojson')?.geometry.type
        addCopyMenuItem(f.properties.id, geometryType)
        addDeleteMenuItem(f.properties.id)
        highlightFeature(f)
        break
      }
    }
  })
}

export function editStyles() {
  return [
    // removeSource(styles()['polygon-layer']), // gl-draw-polygon-fill-inactive
    styles()['polygon-layer-outline'],
    // styles()['line-layer-outline'], // line outline below line, because it's a wider line
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
        'line-color': editDefaults.highlightColor,
        'line-dasharray': editDefaults.activeLineDashArray,
        'line-width': editDefaults.activeLineWidth
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
        'line-color': editDefaults.highlightColor,
        'line-dasharray': editDefaults.activeLineDashArray,
        'line-width': editDefaults.activeLineWidth
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
        'circle-radius': editDefaults.midpointSize,
        'circle-color': editDefaults.midpointColor,
        'circle-opacity': editDefaults.midpointOpacity,
        'circle-stroke-color': editDefaults.midpointOutlineColor,
        'circle-stroke-width': editDefaults.midpointOutlineWidth
      }
    },
    // default point behind symbols and transparent points
    {
      id: 'gl-draw-point-stroke-inactive',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['==', 'meta', 'feature'],
        ['!=', 'mode', 'static'],
        ['!has', 'user_route']
      ],
      paint: {
        'circle-radius': pointSize(),
        'circle-opacity': [
          'match', ['get', 'user_marker-color'], 'transparent', editDefaults.inactivePointOpacity, 0],
        'circle-color': editDefaults.inactivePointColor
      }
    },

    // active point wheen dragging, either single or on a line / polygon
    {
      id: 'gl-draw-point-stroke-active',
      type: 'circle',
      filter: ['all',
        ['==', '$type', 'Point'],
        ['==', 'active', 'true'],
        ['!=', 'meta', 'midpoint']
      ],
      paint: {
        'circle-radius': ['*', pointSizeMax(), editDefaults.activePointSizeFactor],
        'circle-color': editDefaults.activePointColor,
        'circle-opacity': editDefaults.activePointOpacity,
        'circle-stroke-color': editDefaults.highlightColor,
        'circle-stroke-width': editDefaults.activePointOutlineWidth
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
        'circle-radius': editDefaults.vertexSize,
        'circle-opacity': 0,
        'circle-stroke-color': editDefaults.vertexOutlineColor,
        'circle-stroke-width': editDefaults.vertexOutlineWidth,
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
        'circle-radius': editDefaults.vertexSize,
        'circle-color': editDefaults.highlightColor
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
        'circle-radius': editDefaults.routeVertexSize,
        'circle-opacity': 0,
        'circle-stroke-opacity': 1,
        'circle-stroke-color': editDefaults.routeVertexBorderColor,
        'circle-stroke-width': editDefaults.routeVertexBorderWidth,
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
        'circle-radius': editDefaults.routeVertexSize,
        'circle-color': editDefaults.routeVertexColor,
        'circle-opacity': editDefaults.routeVertexOpacity
      }
    },
    //
    // {
    //   id: "maplibre-gl-directions-waypoint",
    //   type: "line",
    // }

  ]
}
