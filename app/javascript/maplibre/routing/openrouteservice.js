import { status } from 'helpers/status'
import { decodePolyline } from 'helpers/polyline'
import * as functions from 'helpers/functions'
import Openrouteservice from 'openrouteservice-js'

// profiles are: driving-car, driving-hgv(heavy goods vehicle), cycling-regular,
//               cycling-road, cycling-mountain, cycling-electric, foot-walking,
//               foot-hiking,wheelchair
// openrouteservice js lib: https://github.com/GIScience/openrouteservice-js?tab=readme-ov-file
// openrouteservice API: https://giscience.github.io/openrouteservice/api-reference/
export async function getRouteFeature (feature, waypoints, profile) {
  const Snap = new Openrouteservice.Snap({ api_key: window.gon.map_keys.openrouteservice })
  const orsDirections = new Openrouteservice.Directions({ api_key: window.gon.map_keys.openrouteservice })

  console.log('get ' + profile + ' route for: ', waypoints)
  try {
    const snapResponse = await Snap.calculate({
      locations: waypoints,
      radius: 300,
      profile,
      format: 'json'
    })
    console.log('snap response: ', snapResponse)
    waypoints = snapResponse.locations.map(item => item.location)
    console.log('snapped values: ', waypoints)

    const routeResponse = await orsDirections.calculate({
      coordinates: waypoints,
      // extra_info: ['waytype', 'surface'],
      profile
    })
    console.log('route response: ', routeResponse)
    const routeLocations = decodePolyline(routeResponse.routes[0].geometry)
    console.log('routeLocations: ', routeLocations)

    // don't calculate elevation for car routes
    if (profile.includes('driving')) {
      feature.geometry.coordinates = routeLocations
    } else {
      const routeLocationsElevation = await getRouteElevation(routeLocations)
      feature.geometry.coordinates = routeLocationsElevation
    }

    // store waypoint indexes as strings in coordinate for style highlight
    const waypointIndexes = routeResponse.routes[0].way_points.map(item => item.toString())
    feature.properties.route = { "provider": "ors", profile, waypoints }
    // extras: routeResponse.routes[0].extras }

    feature.properties.waypointIndexes = waypointIndexes
  } catch (err) {
    console.error('An error occurred: ' + err)
    status('Error building route', 'error')
  }
  return feature
}

// return route points including elevation
export async function getRouteElevation (waypoints) {
  try {
    const Elevation = new Openrouteservice.Elevation({api_key: window.gon.map_keys.openrouteservice})
    let response = await Elevation.lineElevation({
    format_in: 'geojson',
    format_out: 'geojson',
    geometry: {
      coordinates: functions.removeElevation(waypoints),
      type: 'LineString'
    }
  })
  return response.geometry.coordinates
  } catch (err) {
    console.log("An error occurred:", err)
  }
}

export async function getRouteUpdate (originalFeature, updatedFeature) {
  // new waypoints are start, end, changed point and current waypoints that are still in the feature
  let waypoints = [updatedFeature.geometry.coordinates[0]]
  // Track coordinate changes
  updatedFeature.geometry.coordinates.slice(1, -1).forEach((coord, index) => {
    if (coord[0] !== originalFeature.geometry.coordinates[index + 1][0] ||
        coord[1] !== originalFeature.geometry.coordinates[index + 1][1]) {
      waypoints.push(coord)
    } else if (functions.hasCoordinate(updatedFeature.properties.route.waypoints, coord)) {
      waypoints.push(coord)
    }
  })
  waypoints.push(updatedFeature.geometry.coordinates.at(-1))
  waypoints = functions.removeElevation(waypoints)
  updatedFeature = await getRouteFeature(updatedFeature, waypoints, updatedFeature.properties.route.profile)
  return updatedFeature
}


