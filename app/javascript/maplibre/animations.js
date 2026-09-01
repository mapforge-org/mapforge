import { along } from "@turf/along"
import { centroid } from "@turf/centroid"
import distance from "@turf/distance"
import { point } from "@turf/helpers"
import { length } from "@turf/length"
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { resetControls } from 'maplibre/controls/shared'
import { highlightFeature } from 'maplibre/feature'
import { getFeatureSource, renderLayers, updateAnimatedFeature } from 'maplibre/layers/layers'
import { map, mapProperties } from 'maplibre/map'

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
    let frameCounter = 0
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
      updateAnimatedFeature(feature, frameCounter)
      frameCounter++
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

export class AnimateLineAnimation extends AnimationManager {
  run = (line, follow = true, steps=750) => {

    const lineLength = length(line, { units: "kilometers" })
    const stepLength = lineLength / (steps - 1)
    console.log('Line length: ' + lineLength + ' km, step length: ' + stepLength + ' km')
    const stepCoords = Array.from({ length: steps }, (_, i) =>
      along(line, i * stepLength, { units: "kilometers" })
    )

    let step = 0 // iterating coordinates along track
    const lineCoords = line.geometry.coordinates
    line.geometry.coordinates = []

    const finish = () => {
      this.stopAnimation()
      // reset coords, else line will stay with extrapolated coordinates
      line.geometry.coordinates = lineCoords
      renderLayers('geojson', false)
    }

    const animate = (_frame) => {
      const coordinate = stepCoords[step].geometry.coordinates
      // console.log("Frame #" + _frame + ", distance: " + distance + ", coord: " + coordinate)

      line.geometry.coordinates.push(coordinate)
      updateAnimatedFeature(line, step)

      // Update camera position
      if (follow) { map.jumpTo({ center: coordinate }) }
      step++

      if (step < steps) {
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
  run = (polygon) => {
    const height = polygon.properties['fill-extrusion-height']
    console.log('Polygon height: ' + height + 'm')
    const steps = 100
    let counter = 0

    const finish = () => {
      this.stopAnimation()
      // Escape leaves the polygon part-grown, so restore the full height
      polygon.properties['fill-extrusion-height'] = height
      renderLayers('geojson', false)
    }

    const animate = (_timestamp) => {
      const progress = counter / steps
      polygon.properties['fill-extrusion-height'] = progress * height
      // console.log('New height: ' + polygon.properties['fill-extrusion-height'])
      updateAnimatedFeature(polygon, counter)

      counter++

      if (counter <= steps) {
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
    center: mapProperties.center || mapProperties.default_center,
    zoom: mapProperties.zoom || mapProperties.default_zoom,
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