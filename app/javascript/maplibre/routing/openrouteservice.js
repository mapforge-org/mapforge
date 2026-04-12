import * as functions from 'helpers/functions'
import { decodePolyline } from 'helpers/polyline'
import { status } from 'helpers/status'
import Openrouteservice from 'openrouteservice-js'

// OpenRouteService adapter for maplibre-gl-directions + elevation APIs
// openrouteservice js lib: https://github.com/GIScience/openrouteservice-js?tab=readme-ov-file
// openrouteservice API: https://giscience.github.io/openrouteservice/api-reference/
//
// Profiles: driving-car, driving-hgv, cycling-regular, cycling-road,
//           cycling-mountain, cycling-electric, foot-walking, foot-hiking, wheelchair
// Short names (car, bike, foot) are mapped in directions.js

// --- Directions adapter (used by CustomMapLibreGlDirections) ---

// Builds ORS-compatible request data from maplibre-gl-directions config
export function orsBuildRequest (config, coordinates, _bearings) {
  const payload = {
    coordinates,
    extra_info: config.requestOptions.extra_info || []
  }
  if (config.requestOptions.options) {
    payload.options = config.requestOptions.options
  }
  return {
    method: 'post',
    url: `${config.api}/${config.profile}`,
    payload
  }
}

// Calls ORS directions API and transforms response to OSRM-compatible format.
// Must be bound to the CustomMapLibreGlDirections instance (for this.abortController, this.configuration)
export async function orsFetch ({ method: _method, url, payload }) {
  // console.log('ORS request:', url, JSON.stringify(payload, null, 2))
  const response = await window.fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': this.configuration.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: this.abortController?.signal
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    console.error('ORS error response:', err)
    status(err.error?.message || `ORS routing error: ${response.status}`, 'error')
    throw new Error(err.error?.message || `ORS error: ${response.status}`)
  }

  const data = await response.json()
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found')
  }

  // Build OSRM-compatible waypoints from route geometry + way_points indices
  const routeCoords = decodePolyline(data.routes[0].geometry)
  const waypoints = payload.coordinates.map((coord, i) => {
    const wpIndex = data.routes[0].way_points[i]
    return {
      location: wpIndex !== undefined
        ? [routeCoords[wpIndex][0], routeCoords[wpIndex][1]]
        : coord
    }
  })

  // Return OSRM-compatible response structure
  return {
    code: "Ok",
    waypoints,
    routes: data.routes.map(route => ({
      geometry: route.geometry,
      legs: [],
      extras: route.extras,
      way_points: route.way_points
    }))
  }
}

// --- Elevation APIs ---

// Return route points including elevation
// The API restricts to 2000 vertexes per request: https://openrouteservice.org/restrictions/
export async function getRouteElevation (waypoints) {
  const BATCH_SIZE = 2000
  const Elevation = new Openrouteservice.Elevation({api_key: window.gon.map_keys.openrouteservice})
  const coords = functions.removeElevation(waypoints)

  // Split into batches of BATCH_SIZE with 1-point overlap
  const batches = []
  for (let i = 0; i < coords.length; i += BATCH_SIZE - 1) {
    batches.push(coords.slice(i, i + BATCH_SIZE))
  }

  try {
    const allCoordinates = []
    for (const [index, batch] of batches.entries()) {
      const response = await Elevation.lineElevation({
        format_in: 'geojson',
        format_out: 'geojson',
        geometry: {
          coordinates: batch,
          type: 'LineString'
        }
      })
      console.log(`Openrouteservice elevation response (batch #${index} ${batch.length}/${coords.length}):`, response)
      const batchCoords = response.geometry.coordinates
      // Drop first point of subsequent batches to avoid duplicates from overlap
      allCoordinates.push(...(index === 0 ? batchCoords : batchCoords.slice(1)))
    }
    return allCoordinates
  } catch (err) {
    // Extract error details from API response
    let errorMessage = 'OpenRouteService elevation error'
    try {
      if (err.response) {
        const errorData = await err.response.json()
        errorMessage = errorData.message || JSON.stringify(errorData)
        status(errorMessage, 'error')
      } else {
        errorMessage = err.message || errorMessage
      }
      console.error("Elevation error:", errorMessage)
    } catch {
      console.error("OpenRouteService error:", err)
      errorMessage = err.message || errorMessage
    }
  }
}

// Fetch elevation for specific points only (used when a few points of a large track are moved)
export async function getPointsElevation (coordinates, changedIndices) {
  const Elevation = new Openrouteservice.Elevation({api_key: window.gon.map_keys.openrouteservice})
  const updatedCoords = [...coordinates]

  const results = await Promise.all(changedIndices.map(async (idx) => {
    const response = await Elevation.pointElevation({
      format_in: 'point',
      format_out: 'point',
      geometry: coordinates[idx].slice(0, 2)
    })
    console.log(`Openrouteservice elevation response (point #${idx}):`, response)
    return { idx, coord: response.geometry }
  }))

  for (const { idx, coord } of results) {
    updatedCoords[idx] = coord
  }
  return updatedCoords
}

// --- Route update ---

// Recalculate route when waypoints are dragged in direct_select mode
export async function getRouteUpdate (originalFeature, updatedFeature) {
  const orsProfileMap = {
    car:  { profile: 'driving-car',     weightings: {} },
    bike: { profile: 'cycling-regular', weightings: { steepness_difficulty: 3 } },
    foot: { profile: 'foot-walking',    weightings: { green: 1, quiet: 1 } }
  }
  const profileKey = updatedFeature.properties.route.profile
  const profile = orsProfileMap[profileKey]?.profile || profileKey
  const weightings = orsProfileMap[profileKey]?.weightings || {}

  const Snap = new Openrouteservice.Snap({ api_key: window.gon.map_keys.openrouteservice })
  const orsDirections = new Openrouteservice.Directions({ api_key: window.gon.map_keys.openrouteservice })

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

  try {
    const snapResponse = await Snap.calculate({
      locations: waypoints,
      radius: 300,
      profile,
      format: 'json'
    })
    waypoints = snapResponse.locations.map(item => item.location)

    const routeOptions = { coordinates: waypoints,
      extra_info: ['steepness', 'surface', 'waycategory', 'waytype', 'suitability', 'traildifficulty', 'green', 'noise'],
      profile }
    if (Object.keys(weightings).length > 0) {
      routeOptions.options = { profile_params: { weightings } }
    }
    const routeResponse = await orsDirections.calculate(routeOptions)
    console.log('route response: ', routeResponse)
    const routeLocations = decodePolyline(routeResponse.routes[0].geometry)

    // don't calculate elevation for car routes
    if (profile.includes('driving')) {
      updatedFeature.geometry.coordinates = routeLocations
    } else {
      const routeLocationsElevation = await getRouteElevation(routeLocations)
      updatedFeature.geometry.coordinates = routeLocationsElevation
    }

    updatedFeature.properties.route.waypoints = waypoints
    updatedFeature.properties.route.extras = routeResponse.routes[0].extras
  } catch (err) {
    console.error('An error occurred: ' + err)
    status('Error building route', 'error')
  }
  return updatedFeature
}
