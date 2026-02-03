import { map, redrawGeojson, mapProperties } from 'maplibre/map'
import { resetControls } from 'maplibre/controls/shared'
import { highlightFeature } from 'maplibre/feature'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { length } from "@turf/length"
import { point } from "@turf/helpers"
import distance from "@turf/distance"
import { along } from "@turf/along"
import { centroid } from "@turf/centroid"

export class AnimationManager {
  constructor () {
    this.animationId = null
  }

  stopAnimation () {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
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

export class AnimatePointAnimation extends AnimationManager {
  animatePoint = (feature, end, duration = 300) => {
    const starttime = performance.now()
    const start = feature.geometry.coordinates
    console.log('Animating point from: ' + start + ' to ' + end)

    const animate = (timestamp) => {
      let progress = (timestamp - starttime) / duration
      if (progress > 1) { progress = 1 }
      // console.log('progress: ' + progress)
      const newCoordinates = [
        start[0] + (end[0] - start[0]) * progress,
        start[1] + (end[1] - start[1]) * progress
      ]
      feature.geometry.coordinates = newCoordinates
      redrawGeojson(false)
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

    const self = this // for setting animationId
    let step = 0 // iterating coordinates along track
    const lineCoords = line.geometry.coordinates
    line.geometry.coordinates = []

    function animate (_frame) {
      const coordinate = stepCoords[step].geometry.coordinates
      // console.log("Frame #" + _frame + ", distance: " + distance + ", coord: " + coordinate)

      line.geometry.coordinates.push(coordinate)
      redrawGeojson(false)

      // Update camera position
      if (follow) { map.jumpTo({ center: coordinate }) }
      step++

      if (step < steps) {
        self.animationId = requestAnimationFrame(animate)
      } else {
        self.animationId = null
        // reset coords, else line will stay with extrapolated coordinates
        line.geometry.coordinates = lineCoords
      }
    }

    this.animationId = requestAnimationFrame(animate)
  }
}

export class AnimatePolygonAnimation extends AnimationManager {
  run = (polygon) => {
    const height = polygon.properties['fill-extrusion-height']
    console.log('Polygon height: ' + height + 'm')
    const steps = 100
    const self = this
    let counter = 0

    function animate (_timestamp) {
      const progress = counter / steps
      polygon.properties['fill-extrusion-height'] = progress * height
      // console.log('New height: ' + polygon.properties['fill-extrusion-height'])
      redrawGeojson(false)

      counter++

      if (counter <= steps) {
        self.animationId = requestAnimationFrame(animate)
      } else {
        self.animationId = null
      }
    }

    polygon.properties['fill-extrusion-height'] = 0
    redrawGeojson()
    this.animationId = requestAnimationFrame(animate)
  }
}

export function animateViewFromProperties () {
  map.once('moveend', function () { status('Map view updated') })
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

export function flyToFeature(feature, source) {
  // Calculate the centroid
  const center = centroid(feature)
  console.log('Fly to: ' + feature.id + ' ' + center.geometry.coordinates)
  resetControls()
  map.once('moveend', function () {
    highlightFeature(feature, true, source)
  })
  map.flyTo({
    center: center.geometry.coordinates,
    duration: 1000,
    curve: 0.3,
    essential: true
  })
}