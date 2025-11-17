import MapLibreGlDirections from "@maplibre/maplibre-gl-directions"
import { MapLibreGlDirectionsNonCancelableEvent } from "@maplibre/maplibre-gl-directions"
import * as functions from 'helpers/functions'
import { encodePolyline } from 'helpers/polyline'

// from https://github.com/maplibre/maplibre-gl-directions/blob/main/demo/src/assets/map/custom-directions.ts
export default class CustomMapLibreGlDirections extends MapLibreGlDirections {
  constructor(map, configuration) {
    super(map, configuration)
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
        "index": 0,
        "label": String.fromCharCode(64 + index+1),
        "highlight": false
      }
    }
  }

  setWaypointsFeatures(waypointsFeatures) {
    this._waypoints = waypointsFeatures

    this.assignWaypointsCategories()

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
    // console.log(snappointsFeatures)
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
    // console.log("routeLines", routeLines)
    return routeLines
  }

  setRoutelinesFeatures(routeLinesFeatures) {
    console.log('routeLinesFeatures', routeLinesFeatures)
    console.log('directions', this)
    this.routelines = routeLinesFeatures
    this.draw()
  }
}
