import { along } from "@turf/along"
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import { simplify } from "@turf/simplify"
import { mapChannel } from 'channels/map_channel'
import * as functions from 'helpers/functions'
import { decodePolyline } from 'helpers/polyline'
import { status } from 'helpers/status'
import { showFeatureDetails } from 'maplibre/feature'
import { upsert } from 'maplibre/map'
import { getRouteElevation, ORS_EXTRA_INFO, orsProfiles } from 'maplibre/routing/openrouteservice'
import { addUndoState } from 'maplibre/undo'
import Openrouteservice from 'openrouteservice-js'

// Convert imported GPX track (plain LineString) to routed track with route metadata.
// Creates a new feature alongside the original so user can compare.

/**
 * Extract waypoints from a coordinate array using RDP simplification with adaptive tolerance.
 * Ensures max distance gap between waypoints by inserting intermediate points if needed.
 *
 * @param {Array<Array<number>>} coordinates - Array of [lng, lat] or [lng, lat, elevation] coordinates
 * @param {number} targetCount - Target number of waypoints (default: 35, max: 50 for ORS limit)
 * @returns {Array<Array<number>>} - Simplified waypoint array (elevation removed)
 */
function extractWaypoints(coordinates, targetCount = 35) {
  if (coordinates.length <= targetCount) {
    return functions.removeElevation(coordinates)
  }

  // Remove elevation for simplification (turf uses 2D coordinates)
  const coords2D = functions.removeElevation(coordinates)
  const line = lineString(coords2D)

  // Adaptive tolerance: start with a value that should yield ~targetCount points
  // Use binary search to find the right tolerance
  let minTolerance = 0.00001
  let maxTolerance = 0.1
  let tolerance = 0.001
  let simplified = coords2D
  let attempts = 0
  const maxAttempts = 10

  while (attempts < maxAttempts) {
    simplified = simplify(line, { tolerance, highQuality: true }).geometry.coordinates

    if (simplified.length >= targetCount - 5 && simplified.length <= targetCount + 10) {
      // Good enough
      break
    } else if (simplified.length > targetCount + 10) {
      // Too many points, increase tolerance
      minTolerance = tolerance
      tolerance = (tolerance + maxTolerance) / 2
    } else {
      // Too few points, decrease tolerance
      maxTolerance = tolerance
      tolerance = (minTolerance + tolerance) / 2
    }
    attempts++
  }

  console.log(`RDP simplification: ${coordinates.length} -> ${simplified.length} points (tolerance: ${tolerance})`)

  // Enforce max gap: insert intermediate points if consecutive waypoints are too far apart
  const maxGapKm = 10 // Maximum 10km between waypoints
  const waypointsWithGapFill = []

  for (let i = 0; i < simplified.length - 1; i++) {
    waypointsWithGapFill.push(simplified[i])

    const segmentLine = lineString([simplified[i], simplified[i + 1]])
    const segmentLength = length(segmentLine)

    if (segmentLength > maxGapKm) {
      // Insert intermediate points
      const numIntermediatePoints = Math.floor(segmentLength / maxGapKm)
      for (let j = 1; j <= numIntermediatePoints; j++) {
        const distance = (segmentLength / (numIntermediatePoints + 1)) * j
        const intermediatePoint = along(segmentLine, distance).geometry.coordinates
        waypointsWithGapFill.push(intermediatePoint)
      }
    }
  }
  waypointsWithGapFill.push(simplified[simplified.length - 1])

  console.log(`Gap enforcement: ${simplified.length} -> ${waypointsWithGapFill.length} waypoints`)

  return waypointsWithGapFill
}

/**
 * Convert a GPX track (non-routed LineString) to a routed track.
 * Creates a new feature alongside the original.
 *
 * @param {Object} originalFeature - The imported GPX track feature
 * @param {string} profile - Routing profile: 'car', 'bike', or 'foot'
 */
export async function convertToRoute(originalFeature, profile) {
  if (originalFeature.geometry.type !== 'LineString') {
    status('Only LineString tracks can be converted to routes', 'error')
    return
  }

  if (originalFeature.properties.route?.provider) {
    status('This track is already a routed track', 'error')
    return
  }

  status(`Converting track to ${profile} route...`)

  try {
    // Extract waypoints
    const coordinates = originalFeature.geometry.coordinates
    let waypoints = extractWaypoints(coordinates, 35)

    // Check if we need segmented routing (ORS limit is ~50 waypoints)
    if (waypoints.length > 50) {
      console.log(`Track has ${waypoints.length} waypoints, using segmented routing`)
      return await convertToRouteSegmented(originalFeature, profile, waypoints)
    }

    // Snap waypoints to road network
    const Snap = new Openrouteservice.Snap({ api_key: window.gon.map_keys.openrouteservice })
    const orsProfile = orsProfiles[profile]?.profile || profile

    status('Snapping waypoints to road network...')
    const snapResponse = await Snap.calculate({
      locations: waypoints,
      radius: 300,
      profile: orsProfile,
      format: 'json'
    })

    const snappedWaypoints = snapResponse.locations.map(item => item.location)

    // Check for off-road tracks: if snap moved points significantly, warn user
    const maxSnapDistance = Math.max(...snapResponse.locations.map((loc, idx) => {
      const original = waypoints[idx]
      const snapped = loc.location
      const dx = snapped[0] - original[0]
      const dy = snapped[1] - original[1]
      return Math.sqrt(dx * dx + dy * dy) * 111 // rough conversion to km
    }))

    if (maxSnapDistance > 0.5) {
      console.warn(`Some waypoints snapped ${maxSnapDistance.toFixed(2)}km away - may be off-road`)
    }

    // Route via ORS Directions API
    // Note: weightings (steepness_difficulty, green, quiet) are intentionally omitted
    // because they trigger ORS's 150km route length limit
    status('Calculating route...')
    const orsDirections = new Openrouteservice.Directions({ api_key: window.gon.map_keys.openrouteservice })

    const routeOptions = {
      coordinates: snappedWaypoints,
      extra_info: ORS_EXTRA_INFO,
      profile: orsProfile
    }

    const routeResponse = await orsDirections.calculate(routeOptions)
    let routeCoordinates = decodePolyline(routeResponse.routes[0].geometry)

    // Fetch elevation (skip for car routes)
    if (!orsProfile.includes('driving')) {
      status('Fetching elevation data...')
      routeCoordinates = await getRouteElevation(routeCoordinates)
    }

    // Compare lengths to warn about significant differences
    const originalLength = length(lineString(functions.removeElevation(coordinates)))
    const routedLength = length(lineString(functions.removeElevation(routeCoordinates)))
    const lengthDiff = Math.abs(originalLength - routedLength) / originalLength

    if (lengthDiff > 0.3) {
      console.warn(`Route length differs by ${(lengthDiff * 100).toFixed(0)}% from original (${originalLength.toFixed(1)}km -> ${routedLength.toFixed(1)}km)`)
      status(`Route differs significantly from original track (${originalLength.toFixed(1)}km -> ${routedLength.toFixed(1)}km)`, 'warning')
    }

    // Create new routed feature with default route styling
    const trackColor = profile === 'bike' ? '#0a870a' : profile === 'foot' ? '#a51d2d' : '#1a5fb4'
    const newFeature = {
      type: 'Feature',
      id: functions.featureId(),
      geometry: {
        type: 'LineString',
        coordinates: routeCoordinates
      },
      properties: {
        ...originalFeature.properties,
        // Route-specific styling
        'stroke': trackColor,
        'stroke-opacity': 0.65,
        'stroke-width': 5,
        'stroke-dasharray': true,
        'show-km-markers': true,
        'fill-extrusion-height': 8,
        'fill-extrusion-base': 3,
        'fill-extrusion-width': 1.5,
        // Route metadata
        route: {
          provider: 'ors',
          profile: profile,
          waypoints: snappedWaypoints,
          extras: routeResponse.routes[0].extras
        }
      }
    }

    // Preserve title/description from original if present
    if (originalFeature.properties?.title) {
      newFeature.properties.title = originalFeature.properties.title + ' (routed)'
    }

    // Add to map and persist
    addUndoState('Route created from GPX', newFeature)
    upsert(newFeature)
    mapChannel.send_message('new_feature', newFeature)

    status(`Route created successfully (${routedLength.toFixed(1)}km, ${snappedWaypoints.length} waypoints)`)

    // Show the new routed feature details
    showFeatureDetails(newFeature)

  } catch (err) {
    console.error('Error converting track to route:', err)
    status(`Error converting track: ${err.message || err}`, 'error')
  }
}

/**
 * Convert a long track to a routed track using segmented routing.
 * Splits waypoints into batches, routes each segment, then merges.
 *
 * @param {Object} originalFeature - The imported GPX track feature
 * @param {string} profile - Routing profile
 * @param {Array} waypoints - Pre-extracted waypoints array
 */
async function convertToRouteSegmented(originalFeature, profile, waypoints) {
  const SEGMENT_SIZE = 49 // ORS limit is ~50
  const segments = []

  // Split into segments with 1-point overlap
  for (let i = 0; i < waypoints.length; i += SEGMENT_SIZE - 1) {
    segments.push(waypoints.slice(i, i + SEGMENT_SIZE))
  }

  console.log(`Routing ${segments.length} segments...`)

  const Snap = new Openrouteservice.Snap({ api_key: window.gon.map_keys.openrouteservice })
  const orsDirections = new Openrouteservice.Directions({ api_key: window.gon.map_keys.openrouteservice })
  const orsProfile = orsProfiles[profile]?.profile || profile

  const allCoordinates = []
  let allExtras = null

  for (const [index, segment] of segments.entries()) {
    status(`Routing segment ${index + 1}/${segments.length}...`)

    // Snap
    const snapResponse = await Snap.calculate({
      locations: segment,
      radius: 300,
      profile: orsProfile,
      format: 'json'
    })
    const snappedSegment = snapResponse.locations.map(item => item.location)

    // Route (weightings omitted to avoid 150km limit)
    const routeOptions = {
      coordinates: snappedSegment,
      extra_info: ORS_EXTRA_INFO,
      profile: orsProfile
    }

    const routeResponse = await orsDirections.calculate(routeOptions)
    const segmentCoords = decodePolyline(routeResponse.routes[0].geometry)

    // Merge coordinates (skip first point of subsequent segments to avoid duplicates)
    if (index === 0) {
      allCoordinates.push(...segmentCoords)
      allExtras = routeResponse.routes[0].extras
    } else {
      allCoordinates.push(...segmentCoords.slice(1))
      // Merge extras: shift indices and append
      const offset = allCoordinates.length - segmentCoords.length + 1
      for (const [key, values] of Object.entries(routeResponse.routes[0].extras || {})) {
        if (allExtras[key]) {
          const shiftedValues = values.map(([start, end, value]) => [start + offset, end + offset, value])
          allExtras[key].push(...shiftedValues)
        }
      }
    }

    // Rate limiting: wait 1 second between requests
    if (index < segments.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  // Fetch elevation for the entire merged route
  let finalCoordinates = allCoordinates
  if (!orsProfile.includes('driving')) {
    status('Fetching elevation data...')
    finalCoordinates = await getRouteElevation(allCoordinates)
  }

  // Reconstruct snapped waypoints from segment boundaries
  const finalWaypoints = []
  let coordIndex = 0
  for (const segment of segments) {
    if (finalWaypoints.length === 0) {
      finalWaypoints.push(finalCoordinates[0])
    }
    coordIndex += segment.length - 1
    if (coordIndex < finalCoordinates.length) {
      finalWaypoints.push(functions.removeElevation([finalCoordinates[coordIndex]])[0])
    }
  }
  finalWaypoints.push(functions.removeElevation([finalCoordinates[finalCoordinates.length - 1]])[0])

  // Create new routed feature
  const trackColor = profile === 'bike' ? '#0a870a' : profile === 'foot' ? '#a51d2d' : '#1a5fb4'
  const routedLength = length(lineString(functions.removeElevation(finalCoordinates)))

  const newFeature = {
    type: 'Feature',
    id: functions.featureId(),
    geometry: {
      type: 'LineString',
      coordinates: finalCoordinates
    },
    properties: {
      ...originalFeature.properties,
      'stroke': trackColor,
      'stroke-opacity': 0.65,
      'stroke-width': 5,
      'stroke-dasharray': true,
      'show-km-markers': true,
      'fill-extrusion-height': 8,
      'fill-extrusion-base': 3,
      'fill-extrusion-width': 1.5,
      route: {
        provider: 'ors',
        profile: profile,
        waypoints: finalWaypoints,
        extras: allExtras
      }
    }
  }

  if (originalFeature.properties?.title) {
    newFeature.properties.title = originalFeature.properties.title + ' (routed)'
  }

  addUndoState('Route created from GPX', newFeature)
  upsert(newFeature)
  mapChannel.send_message('new_feature', newFeature)

  status(`Route created successfully (${routedLength.toFixed(1)}km, ${segments.length} segments)`)
  showFeatureDetails(newFeature)
}
