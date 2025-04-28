import { layersFactory } from "@maplibre/maplibre-gl-directions"
import CustomMapLibreGlDirections from "maplibre/routing/custom_directions"
import { map, mapProperties, upsert, geojsonData } from 'maplibre/map'
import { highlightColor } from 'maplibre/edit_styles'
import { styles, featureColor } from 'maplibre/styles'
import { decodePolyline } from 'helpers/polyline'
import { basemaps, defaultFont } from 'maplibre/basemaps'
import { getRouteElevation } from 'maplibre/routing/openrouteservice'
import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'

// https://github.com/maplibre/maplibre-gl-directions
// Examples: https://maplibre.org/maplibre-gl-directions/#/examples
// API: https://maplibre.org/maplibre-gl-directions/api/
// OSRM routing server: https://project-osrm.org/, backend: https://github.com/Project-OSRM/osrm-backend/tree/master
// OSRM router.project-osrm.org rules: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
// FOSSGIS rules: https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/

let directions
let currentFeature

export function resetDirections () {
  if (directions) {
    console.log("Resetting directions")
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
    // api: "https://router.project-osrm.org/route/v1",
    // car | bike | foot
    api: "https://routing.openstreetmap.de/routed-" + profile + "/route/v1",
    profile: 'driving',
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
    directions.setWaypointsFeatures(waypoints.map( (wp, index) => createWaypointfeature(wp, index) ))
    //directions.setSnappointsFeatures(waypoints.map(wp => createWaypointfeature(wp)))
    //directions.setRoutelinesFeatures(createRouteLinefeatures(currentFeature))
  }
  directions.interactive = true

  directions.on("fetchroutesend", async (e) => {
    console.log(directions)
    console.log(e)

    // use 'snapped' waypoints
    let waypoints = e.data.waypoints.map(wp => wp.location)
    directions.setWaypointsFeatures(waypoints.map( (wp, index) => createWaypointfeature(wp, index)))

    let coords = decodePolyline(e.data.routes[0].geometry)
    // add elevation from openrouteservice
    coords = await getRouteElevation(coords)

    currentFeature = { "type": "Feature", "id": currentFeature?.id || functions.featureId(),
      "geometry": { "coordinates": coords || [], "type": "LineString" },
      "properties": currentFeature?.properties || { "fill-extrusion-height": 15 }
    }
    currentFeature.properties.route = { "provider": "osrm",
                                        "profile": profile,
                                        "waypoints": waypoints }

    if (geojsonData.features.find(f => f.id === currentFeature.id)) {
      upsert(currentFeature)
      mapChannel.send_message('update_feature', currentFeature)
      status('Updated track')
    } else {
      upsert(currentFeature)
      mapChannel.send_message('new_feature', currentFeature)
      status('Added track')
    }
  })

  directions.on('movewaypoint', (e) => {
    console.log('Waypoint moved', e)
  })

  directions.on('addwaypoint', (e) => {
    status('Waypoint added')
    console.log('Waypoint added', e)
  })

  directions.on('removewaypoint', (e) => {
    console.log('Waypoint removed', e)
  })
}

export function getDirectionsLayers () {
  let layers = layersFactory()
  console.log('Directions layers:', layers)
  layers = layers.filter(layer => layer.id !== "maplibre-gl-directions-routeline")
  layers = layers.filter(layer => layer.id !== "maplibre-gl-directions-routeline-casing")

  // display of route is already handled in view styles
  layers.unshift( {
    id: "maplibre-gl-directions-routeline",
    type: "line",
    source: "maplibre-gl-directions",
    layout: {
      "line-cap": "round",
      "line-join": "round"
    },
    paint: {
      "line-width": 5,
      'line-color': highlightColor,
      'line-dasharray': [0.2, 2],
      "line-opacity": 0.8
    },
    filter: ["==", ["get", "route"], "SELECTED"]
  })

  // line border
  layers.unshift( {
    "id": "maplibre-gl-directions-routeline-casing",
    "type": "line",
    "source": "maplibre-gl-directions",
    paint: {
      "line-width": 10,
      "line-opacity": 0
    },
    filter: ["==", ["get", "route"], "SELECTED"],
  })

  // add a direction arrow layer
  layers.push( Object.assign({}, styles()['line-layer-route-direction'], {
    source: "maplibre-gl-directions",
    id: "maplibre-gl-directions-routeline-direction" }) )

  let waypoints_layer = layers.find(layer => layer.id === "maplibre-gl-directions-waypoint")
  waypoints_layer.paint["circle-color"] = featureColor

  let waypoints_casing_layer = layers.find(layer => layer.id === "maplibre-gl-directions-waypoint-casing")
  waypoints_casing_layer.paint["circle-color"] = highlightColor

  layers.push({
    id: "maplibre-gl-directions-waypoint-label",
    type: "symbol",
    source: "maplibre-gl-directions",
    layout: {
      "text-field": ["get", "label"],
      "text-font": [basemaps()[mapProperties.base_map].font || defaultFont]
    },
    paint: {
      "text-color": "#ffffff",
      "text-opacity": 1
    },
    filter: [
      "all",
      ["==", ["geometry-type"], "Point"],
      ["==", ["get", "type"], "WAYPOINT"]
    ],
  })
  return layers
}

function createWaypointfeature (coords, index) {
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
      "label": String.fromCharCode(64 + index+1),
      "highlight": false
    }
  }
}

// function createRouteLinefeatures (feature) {
//   //feature

//   //[{"type":"Feature","geometry":{"type":"LineString","coordinates":[[-74.19281,40.72035],[-74.19214,40.72202],[-74.19272,40.72186],[-74.19346,40.72203],[-74.18833,40.73438],[-74.18785,40.73675],[-74.18707,40.73766],[-74.18381,40.74446],[-74.18297,40.74418],[-74.18274,40.74463]]},
//   //"properties":{"id":"Pe-UF3f7NUsReWlxoMw2M","routeIndex":0,"route":"SELECTED","legIndex":0,"congestion":0,"departSnappointProperties":{"type":"SNAPPOINT","id":"nmLjKyNVGH7A_tyPpGoJI","profile":"driving","waypointProperties":{"type":"WAYPOINT","id":"LQh6XJuxCkJz7LsSF6ePj","index":0,"category":"ORIGIN","highlight":false},"highlight":false},"arriveSnappointProperties":{"type":"SNAPPOINT","id":"fBHK_nYWZ0Og5Dk0zRHdt","profile":"driving","waypointProperties":{"type":"WAYPOINT","id":"eVJ1T9NlCsmjg5-EaUhxR","index":1,"category":"DESTINATION","highlight":false},"highlight":false},"highlight":false}}]
//   return [feature]
// }

