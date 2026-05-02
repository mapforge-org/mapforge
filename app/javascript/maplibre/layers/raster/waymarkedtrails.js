import { toMercator, toWgs84 } from '@turf/projection'
import { featureId } from 'helpers/functions'

const tileCache = new Map()
const routeDetailsCache = new Map()

// Extracts the activity theme (hiking, cycling, mtb, slopes) from a waymarkedtrails tile URL
export function extractTheme(tileUrl) {
  const match = tileUrl.match(/waymarkedtrails\.org\/([^/]+)\//)
  return match ? match[1] : null
}

// Converts WGS84 coordinates to slippy map tile indices (https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames)
export function lngLatToTile(lng, lat, zoom) {
  const n = 2 ** zoom
  const x = Math.floor(((lng + 180) / 360) * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  return { x, y }
}

// Minimum distance from a point to a polyline, in EPSG:3857 Mercator units
function distanceToLine(point, lineCoords) {
  let minDist = Infinity
  for (let i = 0; i < lineCoords.length - 1; i++) {
    const segStart = lineCoords[i]
    const segEnd = lineCoords[i + 1]
    const dist = pointToSegmentDistance(point, segStart, segEnd)
    if (dist < minDist) {
      minDist = dist
    }
  }
  return minDist
}

// Perpendicular distance from point p to line segment a-b, clamped to segment bounds
function pointToSegmentDistance(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    const dpx = p[0] - a[0]
    const dpy = p[1] - a[1]
    return Math.sqrt(dpx * dpx + dpy * dpy)
  }

  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq))
  const projX = a[0] + t * dx
  const projY = a[1] + t * dy
  const dpx = p[0] - projX
  const dpy = p[1] - projY
  return Math.sqrt(dpx * dpx + dpy * dpy)
}

export async function fetchNearestRoute(theme, lng, lat) {
  const zoom = 12
  const { x, y } = lngLatToTile(lng, lat, zoom)
  const url = `https://${theme}.waymarkedtrails.org/api/v1/tiles/${zoom}/${x}/${y}.json`

  try {
    let geojson = tileCache.get(url)

    if (!geojson) {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`Failed to fetch waymarkedtrails tile: ${response.status}`)
        return null
      }
      geojson = await response.json()
      tileCache.set(url, geojson)
    }

    if (!geojson.features || geojson.features.length === 0) {
      return null
    }

    // Convert click point to EPSG:3857 for distance calculation
    const clickPointMercator = toMercator([lng, lat])

    let nearestRoute = null
    let minDistance = Infinity

    for (const feature of geojson.features) {
      if (!feature.geometry) continue

      let distance = Infinity
      if (feature.geometry.type === 'LineString') {
        distance = distanceToLine(clickPointMercator, feature.geometry.coordinates)
      } else if (feature.geometry.type === 'MultiLineString') {
        distance = Math.min(
          ...feature.geometry.coordinates.map(line => distanceToLine(clickPointMercator, line))
        )
      }

      if (distance < minDistance) {
        minDistance = distance
        const relationId = feature.properties.top_relations?.[0]
        if (relationId) {
          nearestRoute = {
            id: relationId,
            name: feature.properties.name,
            distance
          }
        }
      }
    }

    // Threshold ~500m in Mercator units (roughly 560 at equator)
    if (nearestRoute && minDistance < 560) {
      return nearestRoute
    }

    return null
  } catch (error) {
    console.error('Error fetching waymarkedtrails tile:', error)
    return null
  }
}

export async function fetchRouteDetails(theme, routeId) {
  const cacheKey = `${theme}-${routeId}`
  const cached = routeDetailsCache.get(cacheKey)
  if (cached) return cached

  const detailsUrl = `https://${theme}.waymarkedtrails.org/api/v1/details/relation/${routeId}`

  try {
    const response = await fetch(detailsUrl)

    if (!response.ok) {
      console.warn('Failed to fetch waymarkedtrails route details:', response.status)
      return null
    }

    const details = await response.json()
    const geometry = extractGeometry(details.route)

    if (!geometry) {
      console.warn('No geometry found in route details')
      return null
    }

    const feature = {
      type: 'Feature',
      id: featureId(),
      geometry,
      properties: {
        title: details.name || details.ref || 'Unnamed route',
        desc: buildDescription(details, theme, routeId),
        stroke: determineRouteColor(details, theme),
        waymarkedtrailsId: routeId
      }
    }

    routeDetailsCache.set(cacheKey, feature)
    return feature
  } catch (error) {
    console.error('Error fetching waymarkedtrails route details:', error)
    return null
  }
}

function extractGeometry(route) {
  if (!route?.main) return null

  const lineStrings = []
  extractLineStringsRecursive(route.main, lineStrings)

  if (lineStrings.length === 0) return null

  if (lineStrings.length === 1) {
    return {
      type: 'LineString',
      coordinates: lineStrings[0]
    }
  }

  return {
    type: 'MultiLineString',
    coordinates: lineStrings
  }
}

function extractLineStringsRecursive(segments, lineStrings) {
  for (const segment of segments) {
    if (segment.ways) {
      for (const way of segment.ways) {
        if (way.geometry?.type === 'LineString') {
          const convertedGeometry = toWgs84(way.geometry)
          lineStrings.push(convertedGeometry.coordinates)
        } else if (way.geometry?.type === 'MultiLineString') {
          const convertedGeometry = toWgs84(way.geometry)
          lineStrings.push(...convertedGeometry.coordinates)
        }
      }
    }

    if (segment.main) {
      extractLineStringsRecursive(segment.main, lineStrings)
    }
  }
}

function buildDescription(details, theme, routeId) {
  let desc = ''

  if (details.ref) {
    desc += `**Ref:** ${details.ref}\n\n`
  }

  if (details.tags?.network) {
    desc += `**Network:** ${details.tags.network}\n\n`
  }

  if (details.route?.length) {
    const km = (details.route.length / 1000).toFixed(1)
    desc += `**Length:** ${km} km\n\n`
  }

  if (details.group) {
    desc += `**Group:** ${details.group}\n\n`
  }

  const baseUrl = `https://${theme}.waymarkedtrails.org`
  desc += `\nView on [Waymarked Trails](${baseUrl}/#route?id=${routeId})`
  desc += ` | [OpenStreetMap](https://www.openstreetmap.org/relation/${routeId})`

  return desc
}

function determineRouteColor(details, theme) {
  if (details.tags?.colour && /^#[0-9A-Fa-f]{6}$/.test(details.tags.colour)) {
    return details.tags.colour
  }

  if (theme === 'cycling' && details.tags?.network) {
    const network = details.tags.network
    if (network === 'icn') return '#FF0080'
    if (network === 'ncn') return '#FF0000'
    if (network === 'rcn') return '#8B4513'
    if (network === 'lcn') return '#0000FF'
  }

  if (theme === 'hiking' && details.tags?.network) {
    const network = details.tags.network
    if (network === 'iwn') return '#FF0080'
    if (network === 'nwn') return '#FF0000'
    if (network === 'rwn') return '#FF6600'
    if (network === 'lwn') return '#0000FF'
  }

  const themeColors = {
    hiking: '#d63e2a',
    cycling: '#3388ff',
    mtb: '#ff8800',
    slopes: '#0066ff'
  }

  return themeColors[theme] || '#3388ff'
}
