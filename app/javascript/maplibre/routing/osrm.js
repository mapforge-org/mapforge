import { layersFactory } from "@maplibre/maplibre-gl-directions"
import CustomMapLibreGlDirections from "maplibre/routing/custom_directions"
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

let directions
let currentFeature


export function resetDirections () {
  if (directions) {
    console.log("Resetting directions with ", currentFeature)
    directions.destroy()
    if (map.getSource("maplibre-gl-directions")) {
      map.removeSource("maplibre-gl-directions")
    }
    currentFeature = undefined
    directions = undefined
  }
}

export function initDirections (profile, feature) {
  resetDirections()
  console.log("Initializing directions ('" + profile + "') with", feature || "new route")
  currentFeature = feature

  // https://maplibre.org/maplibre-gl-directions/api/interfaces/MapLibreGlDirectionsConfiguration.html
  directions = new CustomMapLibreGlDirections(map, {
    api: "https://router.project-osrm.org/route/v1",
    profile: profile,
    refreshOnMove: false, // no live updates on route drag
    // https://project-osrm.org/docs/v5.24.0/api/#route-service
    requestOptions: {
      alternatives: "false",
      overview: 'full',
      snapping: 'any',
      generate_hints: false
    },
    layers: getDirectionsLayers()
  })

  if (currentFeature) {
    let waypoints = currentFeature.properties.route.waypoints
    console.log("Waypoints: ", waypoints)
    // TODO: waypoints need to be full geojson features
    directions.setWaypointsFeatures(waypoints.map(wp => createWaypointfeature(wp)))
    //directions.setSnappointsFeatures(waypoints.map(wp => createWaypointfeature(wp)))
    //directions.setRoutelinesFeatures(createRouteLinefeatures(currentFeature))
  }
  directions.interactive = true

  directions.on("fetchroutesend", (e) => {
    console.log(e)

    // use 'snapped' waypoints
    let waypoints = e.data.waypoints.map(wp => wp.location)
    directions.setWaypointsFeatures(waypoints.map(wp => createWaypointfeature(wp)))

    let coords = decodePolyline(e.data.routes[0].geometry)
    currentFeature = { "type": "Feature", "id": currentFeature?.id || functions.featureId(),
      "geometry": { "coordinates": coords, "type": "LineString" },
      "properties": currentFeature?.properties || { "fill-extrusion-height": 32, "show-km-markers": true }
    }
    currentFeature.properties.route = { "provider": "osrm", "profile": profile, "waypoints": waypoints }

    upsert(currentFeature)
    mapChannel.send_message('new_feature', currentFeature)
    status('Added track')
  })

  directions.on('movewaypoint', (e) => {
    console.log('Waypoint moved', e)
  })
}

export function getDirectionsLayers () {
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
  return layers
}

function createWaypointfeature (coords) {
  return {
    "type": "Feature",
    "geometry": {
      "type": "Point",
      "coordinates": coords
    },
    "properties": {
      "type": "WAYPOINT",
      "id": functions.featureId(),
      "index": 0,
      "category": "ORIGIN",
      "highlight": false
    }
  }
}

function createRouteLinefeatures (feature) {
  //feature

  //[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[-74.19281,40.72035],[-74.19214,40.72202],[-74.19272,40.72186],[-74.19346,40.72203],[-74.18833,40.73438],[-74.18785,40.73675],[-74.18707,40.73766],[-74.18381,40.74446],[-74.18297,40.74418],[-74.18274,40.74463]]},
  //"properties":{"id":"Pe-UF3f7NUsReWlxoMw2M","routeIndex":0,"route":"SELECTED","legIndex":0,"congestion":0,"departSnappointProperties":{"type":"SNAPPOINT","id":"nmLjKyNVGH7A_tyPpGoJI","profile":"driving","waypointProperties":{"type":"WAYPOINT","id":"LQh6XJuxCkJz7LsSF6ePj","index":0,"category":"ORIGIN","highlight":false},"highlight":false},"arriveSnappointProperties":{"type":"SNAPPOINT","id":"fBHK_nYWZ0Og5Dk0zRHdt","profile":"driving","waypointProperties":{"type":"WAYPOINT","id":"eVJ1T9NlCsmjg5-EaUhxR","index":1,"category":"DESTINATION","highlight":false},"highlight":false},"highlight":false}}]

  return [feature]
}

