import MapLibreGlDirections from "@maplibre/maplibre-gl-directions"
import { MapLibreGlDirectionsWaypointEvent } from "@maplibre/maplibre-gl-directions"

// from https://github.com/maplibre/maplibre-gl-directions/blob/main/demo/src/assets/map/custom-directions.ts
export default class CustomMapLibreGlDirections extends MapLibreGlDirections {
  constructor(map, configuration) {
    super(map, configuration)
  }

  getWaypointsFeatures() {
    return this._waypoints
  }

  setWaypointsFeatures(waypointsFeatures) {
    this._waypoints = waypointsFeatures

    this.assignWaypointsCategories()

    const waypointEvent = new MapLibreGlDirectionsWaypointEvent("setwaypoints", undefined);
    this.fire(waypointEvent)

    this.draw()
  }

  getSnappointsFeatures() {
    return this.snappoints
  }

  setSnappointsFeatures(snappointsFeatures) {
    this.snappoints = snappointsFeatures
    this.draw()
  }

  getRoutelinesFeatures() {
    return this.routelines
  }

  setRoutelinesFeatures(routelinesFeatures) {
    this.routelines = routelinesFeatures
    this.draw()
  }
}
