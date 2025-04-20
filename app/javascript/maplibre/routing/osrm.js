import MapLibreGlDirections, { layersFactory } from "@maplibre/maplibre-gl-directions";
import { map, mapProperties, upsert } from 'maplibre/map'
import { styles } from 'maplibre/styles'
import { decodePolyline } from 'helpers/polyline'
import { basemaps, defaultFont } from 'maplibre/basemaps'
import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'

// https://github.com/maplibre/maplibre-gl-directions/tree/main
// Examples: https://maplibre.org/maplibre-gl-directions/#/examples
// API: https://maplibre.org/maplibre-gl-directions/api/
// OSRM routing server: https://project-osrm.org/, backend: https://github.com/Project-OSRM/osrm-backend/tree/master
// OSRM router.project-osrm.org rules: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
// FOSSGIS rules: https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/

export function initDirections () {

  let layers = layersFactory()

  console.log(layers)
  layers = layers.filter(layer => layer.id !== "maplibre-gl-directions-routeline")
  layers = layers.filter(layer => layer.id !== "maplibre-gl-directions-routeline-casing")

  // display of route is already handled in view styles
  layers.push( {
    id: "maplibre-gl-directions-routeline",
    type: "line",
    source: "maplibre-gl-directions",
    paint: {
      "line-width": 12,
      "line-opacity": 0
    },
    filter: ["==", ["get", "route"], "SELECTED"],
  })

  // line border
  layers.push( {
    "id": "maplibre-gl-directions-routeline-casing",
    "type": "line",
    "source": "maplibre-gl-directions",
    paint: {
      "line-width": 12,
      "line-opacity": 0
    },
    filter: ["==", ["get", "route"], "SELECTED"],
  })

  // add a direction arrow layer
  layers.push( Object.assign({}, styles()['line-layer-route-direction'], {
    source: "maplibre-gl-directions",
    id: "maplibre-gl-directions-routeline-direction" }) )

  layers.push({
    id: "maplibre-gl-directions-waypoint-label",
    type: "symbol",
    source: "maplibre-gl-directions",
    layout: {
      "text-field": [
        "case",
        ["==", ["get", "category"], "ORIGIN"], "A",
        ["==", ["get", "category"], "DESTINATION"], "B",
        "",
      ],
      "text-font": [basemaps()[mapProperties.base_map].font || defaultFont]
    },
    paint: {
      "text-color": "#ffffff",
      "text-opacity": 0.7
    },
    filter: [
      "all",
      ["==", ["geometry-type"], "Point"],
      ["==", ["get", "type"], "WAYPOINT"],
      ["in", ["get", "category"], ["literal", ["ORIGIN", "DESTINATION"]]],
    ],
  })

  map.once('load', async function (_e) {

    // https://maplibre.org/maplibre-gl-directions/api/interfaces/MapLibreGlDirectionsConfiguration.html
    const directions = new MapLibreGlDirections(map, {
      api: "https://router.project-osrm.org/route/v1",
      profile: "driving",
      refreshOnMove: false, // no live updates on route drag
      // https://project-osrm.org/docs/v5.24.0/api/#route-service
      requestOptions: {
        alternatives: "false",
        overview: 'full',
        snapping: 'any'
      },
      layers
    })
    directions.interactive = true

    directions.on("fetchroutesend", (e) => {

      console.log(e)
      console.log(e.data.routes[0].geometry)
      let coords = decodePolyline(e.data.routes[0].geometry)
      console.log(coords)
      //console.log(JSON.stringify(directions.routelines))
      let feature = { "type": "Feature", "id": functions.featureId(),
        "geometry": { "coordinates": coords, "type": "LineString" },
        "properties": { "fill-extrusion-height": 32,
          "show-km-markers": true,
          "route": {"profile": "osrm", "profile": "cycling-mountain", "waypoints": [] }}
      }

      upsert(feature)
      mapChannel.send_message('new_feature', feature)
      status('Added track')
    })
  })
}
