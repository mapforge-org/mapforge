import MapLibreGlDirections, { MapLibreGlDirectionsNonCancelableEvent, layersFactory } from "@maplibre/maplibre-gl-directions"
import { mapChannel } from 'channels/map_channel'
import * as functions from 'helpers/functions'
import { decodePolyline, encodePolyline } from 'helpers/polyline'
import { status } from 'helpers/status'
import { setSelectedFeature, updateElevation } from 'maplibre/edit'
import { showFeatureDetails } from 'maplibre/feature'
import { getFeature } from 'maplibre/layers/layers'
import { map, mapProperties, upsert } from 'maplibre/map'
import { ORS_EXTRA_INFO, orsBuildRequest, orsFetch, orsProfiles } from 'maplibre/routing/openrouteservice'
import { basemaps, defaultFont } from 'maplibre/styles/basemaps'
import { highlightColor } from 'maplibre/styles/edit_styles'
import { featureColor, styles } from 'maplibre/styles/styles'
import { addUndoState } from 'maplibre/undo'

// https://github.com/maplibre/maplibre-gl-directions
// Examples: https://maplibre.org/maplibre-gl-directions/#/examples
// API: https://maplibre.org/maplibre-gl-directions/api/
//
// Routing backends:
// - OpenRouteService (ORS): https://giscience.github.io/openrouteservice/api-reference/
// - OSRM (fallback): https://project-osrm.org/
//   OSRM server: https://github.com/Project-OSRM/osrm-backend/tree/master
//   FOSSGIS rules: https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/
//
// Set routingBackend to 'ors' or 'osrm' to switch between backends
const routingBackend = 'ors'

// https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options

// CustomMapLibreGlDirections extends the base library to support ORS as a routing backend
// and to customize waypoint/snappoint/routeline feature handling.
// Based on https://github.com/maplibre/maplibre-gl-directions/blob/main/demo/src/assets/map/custom-directions.ts
class CustomMapLibreGlDirections extends MapLibreGlDirections {
  constructor(map, configuration) {
    super(map, configuration)

    // Override buildRequest/fetch for ORS backend; OSRM uses base class defaults
    if (configuration.adapter === 'ors') {
      this.buildRequest = orsBuildRequest
      this.fetch = orsFetch.bind(this)
    }
  }

  getWaypointsFeatures() {
    return this._waypoints
  }

  createWaypointfeature (coords, index) {
    return {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": coords
      },
      "properties": {
        "type": "WAYPOINT",
        "id": functions.featureId(),
        "index": index,
        "label": String.fromCharCode(64 + index+1),
        "highlight": false
      }
    }
  }

  setWaypointsFeatures(waypointsFeatures) {
    this._waypoints = waypointsFeatures

    // assignWaypointsCategories() assigns "undefined" to midpoints.
    // this breaks maplibre-gl 5.13 (https://github.com/maplibre/maplibre-gl-js/issues/6730)
    // this.assignWaypointsCategories()

    const waypointEvent = new MapLibreGlDirectionsNonCancelableEvent("setwaypoints", undefined)
    this.fire(waypointEvent)

    this.draw()
  }

  getSnappointsFeatures() {
    return this.snappoints
  }

  createSnappointsFeatures() {
    return this.getWaypointsFeatures().map((waypoint, _i) =>
      this.buildPoint(waypoint.geometry.coordinates, "SNAPPOINT",
        waypoint.properties)
    )
  }

  setSnappointsFeatures(snappointsFeatures) {
    this.snappoints = snappointsFeatures
    this.draw()
  }

  getRoutelinesFeatures() {
    return this.routelines
  }

  // Recreate Routelines, to enable midpoint changes
  // see https://github.com/maplibre/maplibre-gl-directions/blob/main/src/directions/main.ts#L230
  createRoutelinesFeatures(feature) {
    const routeLines = this.buildRoutelines(
      this.configuration.requestOptions,
      [{
        geometry: encodePolyline(feature.geometry.coordinates),
        "legs": [],
      }],
      0,
      this.getSnappointsFeatures()
    )
    return routeLines
  }

  setRoutelinesFeatures(routeLinesFeatures) {
    // console.log('routeLinesFeatures', routeLinesFeatures)
    // console.log('directions', this)
    this.routelines = routeLinesFeatures
    this.draw()
  }
}

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
  const config = routingBackend === 'ors'
    ? {
        // OpenRouteService backend
        adapter: 'ors',
        api: "https://api.openrouteservice.org/v2/directions",
        apiKey: window.gon.map_keys.openrouteservice,
        profile: orsProfiles[profile]?.profile || profile,
        refreshOnMove: false,
        requestOptions: {
          extra_info: ORS_EXTRA_INFO,
          options: Object.keys(orsProfiles[profile]?.weightings || {}).length > 0
            ? { profile_params: { weightings: orsProfiles[profile].weightings } }
            : undefined
        }
      }
    : {
        // OSRM backend (fallback)
        // api: "https://router.project-osrm.org/route/v1",
        api: "https://routing.openstreetmap.de/routed-" + profile + "/route/v1",
        profile: profile,
        refreshOnMove: false,
        // https://project-osrm.org/docs/v5.24.0/api/#route-service
        requestOptions: {
          alternatives: "false",
          overview: 'full',
          snapping: 'any',
          generate_hints: false
        }
      }

  directions = new CustomMapLibreGlDirections(map, {
    ...config,
    layers: getDirectionsLayers()
  })

  if (currentFeature) {
    let waypoints = currentFeature.properties.route.waypoints
    directions.setWaypointsFeatures(waypoints.map( (coords, index) => directions.createWaypointfeature(coords, index) ))
    // Generate routeline for setting new midpoints
    directions.setSnappointsFeatures(directions.createSnappointsFeatures())
    directions.setRoutelinesFeatures(directions.createRoutelinesFeatures(currentFeature))
  }
  directions.interactive = true

  directions.on("fetchroutesend", async (e) => {
    console.log("fetchroutesend", e)
    if (!e.data?.directions) {
      console.error("fetchroutesend: no directions data (API error?)")
      return
    }

    // use 'snapped' waypoints
    let waypoints = e.data.directions.waypoints.map(wp => wp.location)
    directions.setWaypointsFeatures(waypoints.map((coords, index) => directions.createWaypointfeature(coords, index)))

    let trackColor = "#1a5fb4"
    if (profile === "bike") { trackColor = "#0a870a" }
    if (profile === "foot") { trackColor = "#a51d2d" }
    const defaultProperties = { "fill-extrusion-height": 8,
                                "fill-extrusion-base": 3,
                                "stroke-opacity": 0.65,
                                "fill-extrusion-width": 1.5,
                                "stroke-width": 5,
                                "stroke": trackColor,
                                "stroke-dasharray": true,
                                "show-km-markers": true }
    let coords = decodePolyline(e.data.directions.routes[0].geometry)
    currentFeature = { "type": "Feature", "id": currentFeature?.id || functions.featureId(),
      "geometry": { "coordinates": coords || [], "type": "LineString" },
      // deep clone properties to avoid modifying the original feature
      "properties": JSON.parse(JSON.stringify(currentFeature?.properties || defaultProperties))
    }
    currentFeature.properties.route = { "provider": routingBackend,
                                        "profile": profile,
                                        "waypoints": waypoints }
    if (routingBackend === 'ors') {
      currentFeature.properties.route.extras = e.data.directions.routes[0].extras
      console.log('ORS route extras:', currentFeature.properties.route.extras)
    }

    setSelectedFeature(currentFeature)
    // add elevation from openrouteservice
    updateElevation(currentFeature).then(() => {
      updateTrack(currentFeature)
      showFeatureDetails(currentFeature)
      window.dispatchEvent(new CustomEvent("toggle-edit-feature"))
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

function updateTrack(feature) {
  let geojsonFeature = getFeature(feature.id)
  if (geojsonFeature) {
    // store undo state from unchanged feature
    addUndoState('Track update', geojsonFeature)
    upsert(feature)
    mapChannel.send_message('update_feature', feature)
  } else {
    addUndoState('Track added', feature)
    upsert(feature)
    mapChannel.send_message('new_feature', feature)
  }
}

export function getDirectionsLayers () {
  let layers = layersFactory()
  layers = layers.filter(layer => layer.id !== "maplibre-gl-directions-routeline")
  layers = layers.filter(layer => layer.id !== "maplibre-gl-directions-routeline-casing")

  // display of unselected route is already handled in view styles
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
