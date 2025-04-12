import { map, redrawGeojson, mapProperties } from 'maplibre/map'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'

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
    const turf = window.turf
    const coordinates = path.geometry.coordinates
    console.log('Animating ' + feature.id + ' along ' + path.id)
    // Loop over the coordinates
    for (let i = 0; i < coordinates.length - 1; i++) {
      const distance = turf.distance(turf.point(coordinates[i]),
        turf.point(coordinates[i + 1]), { units: 'meters' })
      const speed = 0.6 // ~ 500m/s
      const duration = Math.round(distance) / speed
      this.animatePoint(feature, coordinates[i + 1], duration)
      await functions.sleep(duration)
      // if the animation was cancelled break path loop
      if (this.animationId === null) { break }
    }
  }
}

export class AnimateLineAnimation extends AnimationManager {
  run = (line) => {
    map.setZoom(15)
    map.setPitch(60)
    const path = {
      type: line.type,
      geometry: {
        type: line.geometry.type,
        coordinates: [...line.geometry.coordinates]
      }
    }
    const lineDistance = window.turf.lineDistance(path, 'kilometers')
    console.log('Line length: ' + lineDistance + ' km')
    const steps = 500
    let counter = 0

    function animate (_frame) {
      const progress = counter / steps
      const distance = progress * lineDistance
      const coordinate = window.turf.along(path, distance, 'kilometers').geometry.coordinates
      // console.log("Frame #" + _frame + ", distance: " + distance + ", coord: " + coordinate)

      line.geometry.coordinates.push(coordinate)
      // console.log("New line coords: " + line.geometry.coordinates)
      redrawGeojson(false)

      // Update camera position
      map.setCenter(coordinate)
      // map.setBearing(map.getBearing() + 1)
      counter++

      if (counter <= steps) {
        requestAnimationFrame(animate)
      }
    }

    line.geometry.coordinates = []
    //redrawGeojson(false)
    animate(0)
  }
}

export class AnimatePolygonAnimation extends AnimationManager {
  run = (polygon) => {
    const height = polygon.properties['fill-extrusion-height']
    console.log('Polygon height: ' + height + 'm')
    const steps = 100
    let counter = 0

    function animate (_timestamp) {
      const progress = counter / steps
      polygon.properties['fill-extrusion-height'] = progress * height
      // console.log('New height: ' + polygon.properties['fill-extrusion-height'])
      redrawGeojson(false)

      counter++

      if (counter <= steps) {
        requestAnimationFrame(animate)
      }
    }

    polygon.properties['fill-extrusion-height'] = 0
    redrawGeojson()
    animate(0)
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
