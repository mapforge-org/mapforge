import { layersFactory } from "@maplibre/maplibre-gl-directions"
import CustomMapLibreGlDirections from "maplibre/routing/custom_directions"
import { map, mapProperties, upsert, geojsonData } from 'maplibre/map'
import { highlightColor } from 'maplibre/edit_styles'
import { updateElevation } from 'maplibre/edit'
import { styles, featureColor } from 'maplibre/styles'
import { decodePolyline } from 'helpers/polyline'
import { basemaps, defaultFont } from 'maplibre/basemaps'
import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import { showFeatureDetails } from 'maplibre/feature'
import { addUndoState } from 'maplibre/undo'

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
    // console.log("Waypoints: ", waypoints)
    directions.setWaypointsFeatures(waypoints.map( (wp, index) => directions.createWaypointfeature(wp, index) ))
    // Generate routeline for setting new midpoints
    directions.setSnappointsFeatures(directions.createSnappointsFeatures())
    directions.setRoutelinesFeatures(directions.createRoutelinesFeatures(currentFeature))
  }
  directions.interactive = true

  directions.on("fetchroutesend", async (e) => {
    // console.log(directions)
    console.log("fetchroutesend", e)

    // use 'snapped' waypoints
    let waypoints = e.data.waypoints.map(wp => wp.location)
    directions.setWaypointsFeatures(waypoints.map( (wp, index) => directions.createWaypointfeature(wp, index)))

    const defaultProperties = { "fill-extrusion-height": 8,
                                "fill-extrusion-base": 3,
                                "stroke-opacity": 0.65,
                                // "stroke-image-url": "/icons/direction-arrow.png",
                                "fill-extrusion-color": "#2d587d",
                                "fill-extrusion-width": 1.5,
                                "stroke-width": 5,
                                "stroke": "#2d587d" }
    let coords = decodePolyline(e.data.routes[0].geometry)
    currentFeature = { "type": "Feature", "id": currentFeature?.id || functions.featureId(),
      "geometry": { "coordinates": coords || [], "type": "LineString" },
      // deep clone properties to avoid modifying the original feature
      "properties": JSON.parse(JSON.stringify(currentFeature?.properties || defaultProperties))
    }
    currentFeature.properties.route = { "provider": "osrm",
                                        "profile": profile,
                                        "waypoints": waypoints }
 
    // add elevation from openrouteservice
    updateElevation(currentFeature).then(() => {
      updateFeature(currentFeature)
      showFeatureDetails(currentFeature)
    })
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

function updateFeature(feature) {
  let geojsonFeature = geojsonData.features.find(f => f.id === feature.id)
  if (geojsonFeature) {
    // store undo state from unchanged feature
    addUndoState('Track update', geojsonFeature)
    upsert(feature)
    mapChannel.send_message('update_feature', feature)
    // status('Updated track')
  } else {
    addUndoState('Track added', feature)
    upsert(feature)
    mapChannel.send_message('new_feature', feature)
    // status('Added track')
  }
}

export function getDirectionsLayers () {
  let layers = layersFactory()
  // console.log('Directions layers:', layers)
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
  layers.push( Object.assign({}, styles()['line-label-symbol'], {
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
      "text-font": [basemaps()[mapProperties.base_map].font || defaultFont], 
      "text-size": 15,
      "text-offset": [0, 0.05]
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
