import { bearing } from "@turf/bearing"
import { centroid } from "@turf/centroid"
import distance from "@turf/distance"
import { point } from "@turf/helpers"
import { simplify } from "@turf/simplify"
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { resetControls } from 'maplibre/controls/shared'
import { highlightFeature } from 'maplibre/feature'
import { hasKmMarkers, removeMovingEndMarker, showMovingEndMarker } from 'maplibre/layers/geojson/km_markers'
import { hasRouteExtras } from 'maplibre/layers/geojson/route_extras'
import { getFeatureSource, getLayer, renderLayers, updateAnimatedFeature } from 'maplibre/layers/layers'
import { initialView, map, mapProperties } from 'maplibre/map'

export class AnimationManager {
  constructor () {
    this.animationId = null
  }

  // Escape runs the same cleanup as a completed animation.
  cancelOnEscape (cleanup) {
    this.escapeHandler = (event) => {
      if (event.key !== 'Escape' || functions.isFormFieldFocused()) { return }
      cleanup()
    }
    document.addEventListener('keydown', this.escapeHandler)
  }

  stopAnimation () {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler)
      this.escapeHandler = null
    }
  }
}

export class RotateCameraAnimation extends AnimationManager {
  // Using arrow function because they do not have their own this context,
  // they inherit this from the enclosing AnimationManager instance,
  // so that 'this' keeps pointing to the class instance
  run = (timestamp = 0) => {
    // clamp the rotation between 0-360 degrees
    // Divide timestamp by 100 to slow rotation to ~10 degrees / sec
    map.rotateTo((timestamp / 400) % 360, { duration: 0 })
    this.animationId = requestAnimationFrame(this.run)
  }
}

// A marker interpolating over seconds crawls a few pixels per frame, so drawing every frame of a
// 60-144Hz display re-tiles the source for moves nobody can see. Progress is time-based, so
// dropping frames only costs smoothness, and at this rate there is none to see.
const POINT_ANIMATION_FPS = 30

export class AnimatePointAnimation extends AnimationManager {
  // Remote updates arrive at whatever rate the source sends (2s from animation:path, 15s from
  // trains:live, seconds apart from a GPS tracker), so interpolate over the observed gap rather
  // than a fixed duration - otherwise the marker races ahead of the data and then waits.
  animateTo = (feature, end) => {
    const now = performance.now()
    const duration = this.lastUpdate ? Math.min(Math.max(now - this.lastUpdate, 100), 15000) : 300
    this.lastUpdate = now
    this.stopAnimation()
    this.animatePoint(feature, end, duration)
  }

  animatePoint = (feature, end, duration = 300) => {
    const starttime = performance.now()
    const start = feature.geometry.coordinates
    console.log('Animating point from: ' + start + ' to ' + end)
    let lastFrame = -Infinity

    const animate = (timestamp) => {
      let progress = (timestamp - starttime) / duration
      if (progress > 1) { progress = 1 }
      // console.log('progress: ' + progress)
      if (progress < 1 && timestamp - lastFrame < 1000 / POINT_ANIMATION_FPS) {
        this.animationId = requestAnimationFrame(animate)
        return
      }
      lastFrame = timestamp
      const newCoordinates = [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ]
      feature.geometry.coordinates = newCoordinates
      updateAnimatedFeature(feature)
      if (progress < 1) { this.animationId = requestAnimationFrame(animate) }
    }
    this.animationId = requestAnimationFrame(animate)
  }

  async animatePointPath (feature, path) {
    const coordinates = path.geometry.coordinates
    console.log('Animating ' + feature.id + ' along ' + path.id)
    // Loop over the coordinates
    for (let i = 0; i < coordinates.length - 1; i++) {
      const pointDistance = distance(point(coordinates[i]),
        point(coordinates[i + 1]), { units: 'meters' })
      const speed = 0.6 // ~ 500m/s
      const duration = Math.round(pointDistance) / speed
      this.animatePoint(feature, coordinates[i + 1], duration)
      await functions.sleep(duration)
      // if the animation was cancelled break path loop
      if (this.animationId === null) { break }
    }
  }
}

const lerp = (from, to, t) => from + (to - from) * t
// shortest turn, so the camera never spins the long way around 0/360
const angleDelta = (from, to) => ((to - from + 540) % 360) - 180
// Exponential smoothing by elapsed time, so the camera eases the same at 30fps and 144fps
const smoothing = (dt, tauMs) => 1 - Math.exp(-dt / tauMs)
const CAMERA_TAU_MS = 300
const BEARING_TAU_MS = 1000
// The camera path averages the line over this much travel time on each side, so the camera
// glides through curves and zigzags instead of swinging left and right with them
const CAMERA_WINDOW_MS = 1000
const CAMERA_PATH_SAMPLES = 1000
// Without a duration the line moves at a fixed speed on the screen: it crosses the visible map
// width in this time, so short and long lines look the same at any zoom. The limits keep a
// tiny line from ending in a blink and a long line at a high zoom from running for many minutes.
const SCREEN_CROSSING_MS = 8000
const MIN_LINE_DURATION_MS = 5000
const MAX_LINE_DURATION_MS = 180000
// Each drawn update moves the animation on by the real time since the last one, but by no more
// than one frame at this rate. A browser that draws fewer updates slows the animation down
// instead of letting the line jump ahead.
const MIN_FPS = 30
// A source that never reports loaded (an errored tile) must not stall the animation
const DRAW_TIMEOUT_MS = 1000
// Dense GPS tracks carry far more points than the screen can show, and every update hands the
// drawn part to the MapLibre worker again, so the animation draws a copy simplified to this
// many pixels at the start zoom
const SIMPLIFY_PIXELS = 0.5
// The main source gets the line as a short tail plus chunks frozen after this much travel time.
// A frozen chunk never changes, so an update re-sends and re-tiles only the tail. Neighboring
// round caps overlap, which shows as a darker dot at each seam on translucent lines until
// finish() puts the whole line back.
const CHUNK_MS = 2000

function screenWidthKm () {
  const { clientWidth, clientHeight } = map.getContainer()
  const left = map.unproject([0, clientHeight / 2]).toArray()
  const right = map.unproject([clientWidth, clientHeight / 2]).toArray()
  return distance(point(left), point(right))
}

// Tolerance in degrees: the 512 px wide MapLibre world spans 360° at zoom 0, and Mercator draws
// a degree of latitude longer by 1 / cos(lat), so latitude needs the smaller tolerance
function simplifiedCoords (line) {
  const lat = line.geometry.coordinates[0][1]
  const tolerance = SIMPLIFY_PIXELS * 360 / (512 * 2 ** map.getZoom()) * Math.cos(lat * Math.PI / 180)
  return simplify(line, { tolerance }).geometry.coordinates
}

export class AnimateLineAnimation extends AnimationManager {
  run = (line, { follow = true, heading = false, duration } = {}) => {
    // the speed comes from the zoom, so wait until the zoom-in after map load is done
    if (!duration && map.isMoving()) {
      map.once('moveend', () => this.run(line, { follow, heading }))
      return
    }
    const originalCoords = line.geometry.coordinates
    const layer = getLayer(line.id)
    if (originalCoords.length < 2 || !layer?.updateAnimatedFeature) { return }
    // Route extras address the original points by index, and km markers measure along them,
    // so those lines keep all of them. A km marker line shows the distance at its tip.
    const kmCounter = hasKmMarkers(line)
    const lineCoords = hasRouteExtras(line) || kmCounter ? originalCoords : simplifiedCoords(line)
    if (lineCoords.length < 2) { return }

    // One pass instead of an along() per step, which walks the line from its start every time
    const cumDist = [0]
    for (let i = 1; i < lineCoords.length; i++) {
      cumDist.push(cumDist[i - 1] + distance(point(lineCoords[i - 1]), point(lineCoords[i])))
    }
    const lineLength = cumDist.at(-1)
    console.log('Line length: ' + lineLength + ' km')
    if (lineLength === 0) { return }
    duration ||= Math.min(Math.max(lineLength / screenWidthKm() * SCREEN_CROSSING_MS,
      MIN_LINE_DURATION_MS), MAX_LINE_DURATION_MS)
    console.log('Animation duration: ' + Math.round(duration / 1000) + ' s')

    // Distances only grow, so each lookup continues from the segment the last one found
    const segmentAt = (dist, from) => {
      let i = from
      while (i < lineCoords.length - 2 && cumDist[i + 1] <= dist) { i++ }
      return i
    }
    const pointAt = (dist, i) => {
      const segLength = cumDist[i + 1] - cumDist[i]
      const t = segLength > 0 ? Math.min((dist - cumDist[i]) / segLength, 1) : 0
      return lineCoords[i].map((c, n) => lerp(c, lineCoords[i + 1][n] ?? c, t))
    }

    // Camera path: the line resampled evenly, with prefix sums for a moving average in O(1)
    const sampleStep = lineLength / (CAMERA_PATH_SAMPLES - 1)
    let sampleSegment = 0
    const samples = Array.from({ length: CAMERA_PATH_SAMPLES }, (_, i) => {
      sampleSegment = segmentAt(i * sampleStep, sampleSegment)
      return pointAt(i * sampleStep, sampleSegment)
    })
    const prefix = [0, 1].map(n => samples.reduce((sums, s) => { sums.push(sums.at(-1) + s[n]); return sums }, [0]))
    const windowDist = lineLength * CAMERA_WINDOW_MS / duration
    const half = Math.max(1, Math.round(windowDist / sampleStep))
    const last = CAMERA_PATH_SAMPLES - 1
    // A window that reaches past an end repeats the end point, so the camera starts and stops on it
    const cameraTarget = (dist) => {
      const i = Math.round(Math.min(Math.max(dist, 0), lineLength) / sampleStep)
      const lo = Math.max(i - half, 0)
      const hi = Math.min(i + half, last)
      return [0, 1].map(n => (prefix[n][hi + 1] - prefix[n][lo] +
        (half - i + lo) * samples[0][n] + (i + half - hi) * samples[last][n]) / (2 * half + 1))
    }

    // Zoom and pitch stay as the URL hash, the map properties or the user set them. The camera
    // starts from the current map state each frame, so a user drag or rotation becomes the new
    // starting point that eases back toward the line.
    // jumpTo() stops running gestures and eases, so the camera waits for them. A drag only counts
    // as a gesture after it moved a few pixels, and a jumpTo() in between resets it, so the
    // camera also waits while any pointer is down.
    const pointers = new Set()
    const onPointerDown = (e) => pointers.add(e.pointerId)
    const onPointerUp = (e) => pointers.delete(e.pointerId)
    map.getCanvasContainer().addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    const moveCamera = (dist, dt) => {
      if (pointers.size || map.isMoving()) { return }
      const k = smoothing(dt, CAMERA_TAU_MS)
      const center = map.getCenter().toArray()
      const target = cameraTarget(dist)
      const camera = { center: [0, 1].map(n => lerp(center[n], target[n], k)) }

      if (heading) {
        const targetBearing = bearing(point(cameraTarget(dist - windowDist)), point(cameraTarget(dist + windowDist)))
        const current = map.getBearing()
        camera.bearing = current + angleDelta(current, targetBearing) * smoothing(dt, BEARING_TAU_MS)
      }

      map.jumpTo(camera)
    }

    const finish = () => {
      this.stopAnimation()
      map.getCanvasContainer().removeEventListener('pointerdown', onPointerDown, { capture: true })
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      // reset coords, else line will stay with the part drawn so far, and the
      // full render drops the chunks from the source
      line.geometry.coordinates = originalCoords
      if (kmCounter) {
        showMovingEndMarker(line, originalCoords.at(-1), lineLength)
        removeMovingEndMarker(line)
      }
      renderLayers('geojson', false)
      if (startTime === null) { return }
      const seconds = (performance.now() - startTime) / 1000
      console.log(`Animation: ${updates} updates in ${seconds.toFixed(1)} s (${Math.round(updates / seconds)}/s), ` +
        `planned ${(duration / 1000).toFixed(1)} s`)
    }

    // An update can redraw the line in the main source and in its companions (route extras
    // colors, 3D wall, km markers), so it counts as drawn once all of them are
    const drawSources = [layer.sourceId, layer.routeExtrasSourceId, layer.extrusionSourceId, layer.kmMarkerSourceId]
      .filter(id => map.getSource(id))

    // No label: each chunk would place its own copy. No route: large, and no style reads it.
    // onclick false: hover and click skip chunks, they are not features of the layer.
    const { label: _label, route: _route, ...chunkProperties } = line.properties
    const chunkFeature = (coordinates, n) => {
      const id = `${line.id}-chunk-${n}`
      return {
        type: 'Feature', id, properties: { ...chunkProperties, id, onclick: false },
        geometry: { type: 'LineString', coordinates }
      }
    }

    // MapLibre builds GeoJSON updates in a worker, so the drawn line trails the data sent. The
    // next update waits until the last one is drawn, which keeps the worker from piling up, and
    // the camera follows the drawn tip instead of one the map does not show yet.
    let sentDist = 0
    let sentTip = null
    let drawnDist = 0
    let drawing = false
    let segment = 0
    let animTime = 0
    let chunkStart = 0
    let chunkTime = 0
    let chunks = 0
    let startTime = null
    let lastSend = null
    let lastTime = null
    let updates = 0

    const send = (timestamp) => {
      animTime += Math.min(timestamp - (lastSend ?? timestamp), 1000 / MIN_FPS)
      lastSend = timestamp
      sentDist = Math.min(animTime / duration, 1) * lineLength
      segment = segmentAt(sentDist, segment)
      // the companions read the whole drawn part from the layer feature
      const drawn = [...lineCoords.slice(0, segment + 1), pointAt(sentDist, segment)]
      line.geometry.coordinates = drawn
      sentTip = drawn.at(-1)

      const sourceFeatures = []
      if (animTime - chunkTime > CHUNK_MS && segment > chunkStart) {
        sourceFeatures.push(chunkFeature(lineCoords.slice(chunkStart, segment + 1), chunks++))
        chunkStart = segment
        chunkTime = animTime
      }
      sourceFeatures.push({ ...line, geometry: { type: 'LineString', coordinates: drawn.slice(chunkStart) } })
      layer.updateAnimatedFeature(line, sourceFeatures)
      updates++
      drawing = true
    }

    const animate = (timestamp) => {
      startTime ??= timestamp
      if (drawing && (drawSources.every(id => map.isSourceLoaded(id)) ||
        timestamp - lastSend > DRAW_TIMEOUT_MS)) {
        drawing = false
        drawnDist = sentDist
        if (kmCounter) { showMovingEndMarker(line, sentTip, drawnDist) }
      }
      if (!drawing) { send(timestamp) }
      if (follow) { moveCamera(drawnDist, timestamp - (lastTime ?? timestamp)) }
      lastTime = timestamp

      if (sentDist < lineLength) {
        this.animationId = requestAnimationFrame(animate)
      } else {
        finish()
      }
    }

    this.cancelOnEscape(finish)
    this.animationId = requestAnimationFrame(animate)
  }
}

export class AnimatePolygonAnimation extends AnimationManager {
  run = (polygon, { duration = 1700 } = {}) => {
    const height = polygon.properties['fill-extrusion-height']
    console.log('Polygon height: ' + height + 'm')
    let startTime = null

    const finish = () => {
      this.stopAnimation()
      // Escape leaves the polygon part-grown, so restore the full height
      polygon.properties['fill-extrusion-height'] = height
      renderLayers('geojson', false)
    }

    const animate = (timestamp) => {
      startTime ??= timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      polygon.properties['fill-extrusion-height'] = progress * height
      updateAnimatedFeature(polygon)

      if (progress < 1) {
        this.animationId = requestAnimationFrame(animate)
      } else {
        finish()
      }
    }

    polygon.properties['fill-extrusion-height'] = 0
    renderLayers('geojson', true)
    this.cancelOnEscape(finish)
    this.animationId = requestAnimationFrame(animate)
  }
}

export function animateViewFromProperties () {
  map.once('moveend', function () { status(window.__('Map view updated')) })
  map.flyTo({
    center: initialView().center,
    zoom: initialView().zoom,
    pitch: mapProperties.pitch,
    bearing: mapProperties.bearing || 0,
    curve: 0.3,
    essential: true,
    duration: 2000
  })
}

export function flyToFeature(feature) {
  const source = getFeatureSource(feature.id)
  // Calculate the centroid
  const center = centroid(feature)
  console.log('Fly to: ' + feature.id + ' ' + center.geometry.coordinates)
  resetControls()
  map.once('moveend', function () {
    if (feature.properties?.onclick !== false) {
      highlightFeature(feature, true, source)
    }
  })
  map.flyTo({
    center: center.geometry.coordinates,
    duration: 1000,
    curve: 0.3,
    essential: true
  })
}