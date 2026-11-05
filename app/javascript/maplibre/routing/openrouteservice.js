import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import * as functions from 'helpers/functions'
import { decodePolyline, encodePolyline } from 'helpers/polyline'
import { status } from 'helpers/status'
import Openrouteservice from 'openrouteservice-js'

// OpenRouteService adapter for maplibre-gl-directions + elevation APIs
// openrouteservice js lib: https://github.com/GIScience/openrouteservice-js?tab=readme-ov-file
// openrouteservice API: https://giscience.github.io/openrouteservice/api-reference/
//
// Profiles: driving-car, driving-hgv, cycling-regular, cycling-road,
//           cycling-mountain, cycling-electric, foot-walking, foot-hiking, wheelchair
// Short names (car, bike, foot) are mapped below

// allowed steepness_difficulty (cycling only): 0 Novice, 1 Moderate, 2 Amateur, 3 Pro
// green (foot only): 0 normal, 1 prefer green areas
// quiet (foot only): 0 normal, 1 prefer quiet ways
export const orsProfiles = {
  car:  { profile: 'driving-car',     weightings: { } },
  bike: { profile: 'cycling-regular', weightings: { } },
  foot: { profile: 'foot-hiking',     weightings: { green: 0.6, quiet: 0.3 } }
}

// Routing needs an ORS API key, see README.md#environment-variables. Without it
// the routing UI stays hidden, because every request would fail.
export function routingEnabled () {
  return Boolean(window.gon?.map_keys?.openrouteservice)
}

// ORS route extras to request
export const ORS_EXTRA_INFO = ['steepness', 'surface', 'waycategory', 'waytype', 'suitability', 'traildifficulty']

// include elevation data in routing API request
export const ORS_ELEVATION_IN_ROUTE = true

// --- Directions adapter (used by CustomMapLibreGlDirections) ---

// Builds ORS-compatible request data from maplibre-gl-directions config
export function orsBuildRequest (config, coordinates, _bearings) {
  const payload = {
    coordinates,
    extra_info: config.requestOptions.extra_info || [],
    elevation: ORS_ELEVATION_IN_ROUTE
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
  // Use api_key query parameter to avoid CORS preflight issues with Authorization header
  const urlWithKey = `${url}?api_key=${encodeURIComponent(this.configuration.apiKey)}`
  const response = await window.fetch(urlWithKey, {
    method: 'POST',
    headers: {
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
    throw new Error(window.__('No route found'))
  }

  // Build waypoints from route geometry + way_points indices for maplibre-gl-directions
  const routeCoords = decodePolyline(data.routes[0].geometry, ORS_ELEVATION_IN_ROUTE)
  const offTerrain = await offTerrainExtra(routeCoords, data.routes[0].extras)

  const waypoints = payload.coordinates.map((coord, i) => {
    const wpIndex = data.routes[0].way_points[i]
    return {
      location: wpIndex !== undefined
        ? [routeCoords[wpIndex][0], routeCoords[wpIndex][1]]
        : [coord[0], coord[1]]
    }
  })

  // Return response structure expected by maplibre-gl-directions
  return {
    code: "Ok",
    waypoints,
    routes: data.routes.map(route => ({
      // Re-encode as 2D polyline so maplibre-gl-directions can decode it correctly
      geometry: ORS_ELEVATION_IN_ROUTE ? encodePolyline(routeCoords, false) : route.geometry,
      // Pass decoded coordinates (with elevation) so directions.js can use them directly
      decodedCoordinates: routeCoords,
      legs: [],
      extras: { ...route.extras, off_terrain: offTerrain },
      way_points: route.way_points
    }))
  }
}

// --- Elevation APIs ---

// openrouteservice-js defaults the service to 'elevation/line' and 'elevation/point', which this host
// does not have, so every request passes service 'line' or 'point'
// Upstream fix, not merged yet: https://github.com/GIScience/openrouteservice-js/pull/113
const ELEVATION_HOST = 'https://api.heigit.org/openelevationservice/v0'

// Return route points including elevation
// The API restricts to 2000 vertexes per request: https://openrouteservice.org/restrictions/
export async function getRouteElevation (waypoints) {
  const BATCH_SIZE = 2000
  const Elevation = new Openrouteservice.Elevation({
    api_key: window.gon.map_keys.openrouteservice,
    host: ELEVATION_HOST
  })
  const coords = functions.removeElevation(waypoints)

  // Split into batches of BATCH_SIZE with 1-point overlap
  const batches = []
  for (let i = 0; i < coords.length; i += BATCH_SIZE - 1) {
    batches.push(coords.slice(i, i + BATCH_SIZE))
  }

  try {
    const allCoordinates = []
    for (const [index, batch] of batches.entries()) {
      let batchCoords
      try {
        const response = await Elevation.lineElevation({
          service: 'line',
          format_in: 'geojson',
          format_out: 'geojson',
          geometry: {
            coordinates: batch,
            type: 'LineString'
          }
        })
        console.log(`Openrouteservice elevation response (batch #${index} ${batch.length}/${coords.length}):`, response)
        batchCoords = response.geometry.coordinates
      } catch (err) {
        const errorMessage = await orsErrorMessage(err)
        if (!isOutsideSrtm(errorMessage)) {
          if (errorMessage) status(errorMessage, 'error')
          throw err
        }
        // ponytail: one sea point zeroes the whole batch, land points included.
        // Per point lookups would fix that, at one request per point.
        batchCoords = batch.map(c => [c[0], c[1], 0])
      }
      // Drop first point of subsequent batches to avoid duplicates from overlap
      allCoordinates.push(...(index === 0 ? batchCoords : batchCoords.slice(1)))
    }
    return allCoordinates.filter(c => c != null)
  } catch (err) {
    console.error("Elevation error:", err)
  }
}

// The route elevation and the SRTM terrain disagree by 40 m and more on some open mountain roads. A small
// bridge or a shallow tunnel stays below this height, but its wall is only a little off.
const OFF_TERRAIN_HEIGHT = 20
// A shorter tunnel or bridge is a mismatch of the elevation data
const OFF_TERRAIN_MIN_LENGTH = 25
// ORS interpolates between the ends of a bridge or tunnel, so its inner vertices stay on a straight line. The
// share of the length allows for the bends of a long tunnel that consists of several OSM ways.
const STRAIGHT_TOLERANCE = 2
const STRAIGHT_TOLERANCE_SHARE = 0.01
// ORS surface values: Dirt, Ground, Ice, Sand, Grass
const NATURAL_SURFACES = [11, 12, 13, 15, 17]
// ORS traildifficulty value of sac_scale=mountain_hiking and mtb:scale=1
const MOUNTAIN_TRAIL_DIFFICULTY = 2
// ORS waytype values: Path, Track, Footway
const TRAIL_WAY_TYPES = [4, 5, 7]
// ORS surface values: Paved, Asphalt, Concrete, Cobblestone, Metal, Wood, Paving Stones
const BUILT_SURFACES = [1, 3, 4, 5, 6, 7, 14]
// On steep trails the two elevations differ by more than 30 m without a structure. A higher global height
// is no option, because it drops the shallow tunnels of paved cycleways. The values separate 2 hikes from
// a car and a bike route, measured in November 2026.
const TRAIL_MIN_HEIGHT = 40
const TRAIL_MIN_LENGTH = 50

// ORS interpolates the route elevation through tunnels and over bridges, the Elevation API returns the SRTM
// terrain. Where the two differ at the middle of an edge, the route leaves the terrain: -1 below it (tunnel),
// 1 above it (bridge). The result has the format of an ORS extra, so the route walls can skip it (see
// extrusion.js) and a reversed route keeps it.
// On steep ground the two elevations also differ without a bridge or tunnel, so a difference is only a candidate.
// ORS has no bridge or tunnel extra for the foot profiles, see onStraightLine, onNaturalTrail and onTrail for the filters.
export async function offTerrainExtra (coords, extras) {
  if (coords.length < 2 || coords[0].length < 3) return { values: [] }
  const midpoints = coords.slice(1).map((c, i) => [(coords[i][0] + c[0]) / 2, (coords[i][1] + c[1]) / 2])
  const terrain = await getRouteElevation(midpoints)
  if (terrain?.length !== midpoints.length) return { values: [] }
  return { values: offTerrainValues(coords, terrain.map(c => c[2]), extras) }
}

export function offTerrainValues (coords, midpointTerrain, extras) {
  const values = []
  const heights = []
  midpointTerrain.forEach((terrain, i) => {
    const route = (coords[i][2] + coords[i + 1][2]) / 2
    heights.push(Math.abs(route - terrain))
    if (heights[i] < OFF_TERRAIN_HEIGHT) return
    const value = Math.sign(route - terrain)
    const last = values.at(-1)
    if (last?.[1] === i && last[2] === value) { last[1] = i + 1 } else { values.push([i, i + 1, value]) }
  })
  return values.filter(([from, to]) => {
    const meters = length(lineString(coords.slice(from, to + 1)), { units: 'meters' })
    const edge = Math.floor((from + to) / 2)
    const trail = onTrail(extras, edge)
    return meters >= (trail ? TRAIL_MIN_LENGTH : OFF_TERRAIN_MIN_LENGTH) &&
      (!trail || Math.max(...heights.slice(from, to)) >= TRAIL_MIN_HEIGHT) &&
      onStraightLine(coords, from, to) && !onNaturalTrail(extras, edge)
  })
}

// A range often starts inside its bridge or tunnel, so the check runs from portal to portal. ORS returns a whole
// meter at the end of a way and smoothed decimals inside it. This is measured on route data, ORS does not document it.
// ponytail: if ORS changes this, a range runs to the route ends and no bridge or tunnel passes. A way boundary extra
// from a self-hosted ORS instance is the upgrade path.
function onStraightLine (coords, rangeFrom, rangeTo) {
  let from = rangeFrom
  let to = rangeTo
  while (from > 0 && !Number.isInteger(coords[from][2])) { from-- }
  while (to < coords.length - 1 && !Number.isInteger(coords[to][2])) { to++ }
  const range = coords.slice(from, to + 1)
  const distances = [0]
  for (let i = 1; i < range.length; i++) {
    distances.push(distances[i - 1] + length(lineString(range.slice(i - 1, i + 1)), { units: 'meters' }))
  }
  const total = distances.at(-1)
  const tolerance = Math.max(STRAIGHT_TOLERANCE, total * STRAIGHT_TOLERANCE_SHARE)
  const start = range[0][2]
  const climb = range.at(-1)[2] - start
  return range.every((c, i) => Math.abs(c[2] - (start + climb * distances[i] / total)) <= tolerance)
}

// A bridge or tunnel is normally its own OSM way, so the tags of the middle edge are the tags of the structure.
// ponytail: this and the trail limits also drop a real tunnel on a dirt path. It then gets a wall on the terrain
// and no label. Cross-route terrain samples from the Elevation API can tell these apart, if that becomes a problem.
function onNaturalTrail (extras, edge) {
  return NATURAL_SURFACES.includes(extraAtEdge(extras?.surface, edge)) ||
    extraAtEdge(extras?.traildifficulty, edge) >= MOUNTAIN_TRAIL_DIFFICULTY
}

function onTrail (extras, edge) {
  return TRAIL_WAY_TYPES.includes(extraAtEdge(extras?.waytype, edge)) &&
    !BUILT_SURFACES.includes(extraAtEdge(extras?.surface, edge))
}

// An edge starts at the vertex with its index, so a segment [from, to, value] holds the edges from to to - 1
function extraAtEdge (extra, edge) {
  return extra?.values?.find(([from, to]) => edge >= from && edge < to)?.[2]
}

// ORS rejects a geometry with any point outside SRTM. SRTM has no data over the sea,
// so these points get elevation 0.
function isOutsideSrtm (errorMessage) {
  return Boolean(errorMessage?.includes('outside the bounds of srtm'))
}

// openrouteservice-js attaches the fetch response, its body can be read only once
async function orsErrorMessage (err) {
  if (!err.response) return null
  return err.response.json()
    .then(data => data.message || JSON.stringify(data))
    .catch(() => null)
}

// Fetch elevation for specific points only (used when a few points of a large track are moved)
export async function getPointsElevation (coordinates, changedIndices) {
  const Elevation = new Openrouteservice.Elevation({
    api_key: window.gon.map_keys.openrouteservice,
    host: ELEVATION_HOST
  })
  const updatedCoords = [...coordinates]

  const results = await Promise.all(changedIndices.map(async (idx) => {
    try {
      const response = await Elevation.pointElevation({
        service: 'point',
        format_in: 'point',
        format_out: 'point',
        geometry: coordinates[idx].slice(0, 2)
      })
      console.log(`Openrouteservice elevation response (point #${idx}):`, response)
      return { idx, coord: response.geometry || coordinates[idx] }
    } catch (err) {
      if (!isOutsideSrtm(await orsErrorMessage(err))) throw err
      return { idx, coord: [coordinates[idx][0], coordinates[idx][1], 0] }
    }
  }))

  for (const { idx, coord } of results) {
    updatedCoords[idx] = coord
  }
  return updatedCoords
}

// Fetch elevation from openrouteservice. Coords without elevation (length 2)
// are detected automatically — moved/added points lose their 3rd element via
// mapbox-gl-draw's updateCoordinate(). When only a few points lack elevation,
// fetches just those individually instead of re-fetching the entire track.
export function updateElevation(feature) {
  if (!window.gon.map_keys.openrouteservice) {
    console.warn('Skipping elevation, no openrouteservice key set')
    return Promise.resolve()
  }

  // MultiLineString coordinates are nested per-segment; getRouteElevation expects
  // a flat point array. Skip elevation fetching for these.
  if (feature.geometry.type === 'MultiLineString') return Promise.resolve()

  const coords = feature.geometry.coordinates
  const missing = []
  for (let i = 0; i < coords.length; i++) {
    if (coords[i].length < 3) missing.push(i)
  }

  if (missing.length === 0) return Promise.resolve()

  if (missing.length <= 10) {
    return getPointsElevation(coords, missing)
      .then(updated => { feature.geometry.coordinates = updated })
      .catch(() => fullElevation(feature))
  }

  return fullElevation(feature)
}

function fullElevation(feature) {
  return getRouteElevation(feature.geometry.coordinates)
    .then(coords => { if (coords) feature.geometry.coordinates = coords })
    .catch(err => console.error("Elevation update failed:", err))
}

// --- Route update ---

// Recalculate route when waypoints are dragged in direct_select mode
export async function getRouteUpdate (originalFeature, updatedFeature) {
  const profileKey = updatedFeature.properties.route.profile
  const profile = orsProfiles[profileKey]?.profile || profileKey
  const weightings = orsProfiles[profileKey]?.weightings || {}

  const Snap = new Openrouteservice.Snap({
    api_key: window.gon.map_keys.openrouteservice,
    host: 'https://api.heigit.org/openrouteservice'
  })
  const orsDirections = new Openrouteservice.Directions({
    api_key: window.gon.map_keys.openrouteservice,
    host: 'https://api.heigit.org/openrouteservice'
  })

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
      extra_info: ORS_EXTRA_INFO,
      elevation: ORS_ELEVATION_IN_ROUTE,
      profile }
    if (Object.keys(weightings).length > 0) {
      routeOptions.options = { profile_params: { weightings } }
    }
    const routeResponse = await orsDirections.calculate(routeOptions)
    console.log('route response: ', routeResponse)
    const routeLocations = decodePolyline(routeResponse.routes[0].geometry, ORS_ELEVATION_IN_ROUTE)

    updatedFeature.geometry.coordinates = routeLocations

    updatedFeature.properties.route.waypoints = waypoints
    updatedFeature.properties.route.extras = { ...routeResponse.routes[0].extras,
      off_terrain: await offTerrainExtra(routeLocations, routeResponse.routes[0].extras) }
  } catch (err) {
    console.error('An error occurred: ' + err)
    status(window.__('Error building route'), 'error')
  }
  return updatedFeature
}
