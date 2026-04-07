import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import maplibregl from 'maplibre-gl'
import { map, mapProperties } from 'maplibre/map'

let isInFollowMode = false
let isInCompassMode = false
let lastHeading = null
let geolocateControl = null

export function isGeolocateFollowModeActive() {
  return isInFollowMode
}

export function isGeolocateCompassModeActive() {
  return isInCompassMode
}

export function initializeGeoLocateControl() {
  // https://maplibre.org/maplibre-gl-js/docs/API/classes/GeolocateControl
  // css: .maplibregl-user-location-dot
  // Note: This works only via https in modern browsers
  const geolocate = new maplibregl.GeolocateControl({
    // https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition#options
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 60000,
      maximumAge: 30000
    },
    showAccuracyCircle: true,
    showUserLocation: true,
    trackUserLocation: functions.isMobileDevice()
  })
  geolocateControl = geolocate

  geolocate.on('error', e => {
    console.warn('Error detecting location', e)
    status('Error detecting location', 'warning')
  })

  geolocate.on('geolocate', (position) => {
    const coords = position.coords
    console.log('geolocate event', coords)
    if (coords) {
      window.dispatchEvent(new CustomEvent('gps-position', {
        detail: { lng: coords.longitude, lat: coords.latitude }
      }))
    }
  })

  // follow mode
  geolocate.on('trackuserlocationstart', () => {
    isInFollowMode = true
    requestWakeLock()

    if (!('ondeviceorientationabsolute' in window)) {
      status('Device Orientation not supported', 'info')
      // hiding the direction view
      const dot = document.querySelector('.maplibregl-user-location-dot')
      dot.style.setProperty('--display-view', 'none')
      return
    }

    // Some mobile browsers (iOS Safari) require permission to access device orientation
    if (
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener('deviceorientationabsolute', setLocationOrientation)
          }
        })
        .catch(console.error)
    } else {
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientationabsolute_event
      window.addEventListener('deviceorientationabsolute', setLocationOrientation)
    }
  })

  geolocate.on('trackuserlocationend', () => {
    isInFollowMode = false
    if (isInCompassMode) {
      deactivateCompassMode()
    }
    wakeLock.release()
    wakeLock = null
    // probably mapbox draw bug: map can lose drag capabilities
    map.dragPan.enable()
    // trackuserlocationend is send as soon as auto-follow is off
    // only send event when tracking is fully turned off
    if (geolocate._watchState === 'OFF') {
      window.dispatchEvent(new CustomEvent('gps-position', { detail: null }))
    }
  })

  map.addControl(geolocate, 'top-right')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-geolocate)').classList.add('hidden')

  // Intercept clicks to inject compass mode between ACTIVE_LOCK and OFF
  const geolocateButton = document.querySelector('button.maplibregl-ctrl-geolocate')
  geolocateButton.addEventListener('click', (e) => {
    if (!isInCompassMode && geolocateControl._watchState === 'ACTIVE_LOCK') {
      // Enter compass mode instead of turning off
      e.stopImmediatePropagation()
      activateCompassMode()
    } else if (isInCompassMode) {
      // Exit compass mode and turn off tracking
      e.stopImmediatePropagation()
      deactivateCompassMode()
      geolocateControl.trigger()
    }
  }, true) // capture phase

  // Exit compass mode when user manually rotates the map
  map.on('rotatestart', (e) => {
    if (isInCompassMode && e.originalEvent) {
      deactivateCompassMode()
    }
  })
}

function activateCompassMode() {
  isInCompassMode = true

  const btn = document.querySelector('button.maplibregl-ctrl-geolocate')
  btn.classList.add('maplibregl-ctrl-geolocate-compass')

  // Hide compass cone on dot (the map itself rotates now)
  // const dot = document.querySelector('.maplibregl-user-location-dot')
  // if (dot) {
  //   dot.style.setProperty('--display-view', 'none')
  // }

  // Apply current heading immediately if available
  if (lastHeading !== null) {
    map.transform.bearing = -lastHeading
    map.triggerRepaint()
  }
}

function deactivateCompassMode() {
  isInCompassMode = false

  const btn = document.querySelector('button.maplibregl-ctrl-geolocate')
  btn.classList.remove('maplibregl-ctrl-geolocate-compass')

  // Re-show compass cone on dot
  // const dot = document.querySelector('.maplibregl-user-location-dot')
  // if (dot) {
  //   dot.style.setProperty('--display-view', 'block')
  // }

  // Reset bearing and pitch to defaults
  map.easeTo({
    bearing: mapProperties.bearing || 0,
    pitch: mapProperties.pitch || 0,
    duration: 500
  })
}

// turn on screen wake lock when tracking position
// https://developer.chrome.com/docs/capabilities/web-apis/wake-lock
let wakeLock = null
const requestWakeLock = async () => {
  if (!('wakeLock' in navigator)) {
    console.warn('Screen Wake Lock API not supported')
    return
  }
  try {
    wakeLock = await navigator.wakeLock.request()
    console.log('Screen Wake Lock aquired:', wakeLock.released)
    wakeLock.addEventListener('release', () => {
      console.log('Screen Wake Lock released:', wakeLock.released)
      wakeLock = null
    })
  } catch (err) {
    console.error(`Screen Wake Lock error: ${err.name}, ${err.message}`)
    wakeLock = null
  }
}

function setLocationOrientation(event) {
  // event.alpha: 0-360 (compass direction)
  // event.beta: -180 to 180 (front to back tilt)
  // event.gamma: -90 to 90 (left to right tilt)

  // some browsers respond to deviceorientationabsolute with non-absolute values
  if (!event.absolute) {
    // hiding the direction view
    const dot = document.querySelector('.maplibregl-user-location-dot')
    dot.style.setProperty('--display-view', 'none')
    return
  }

  const dot = document.querySelector('.maplibregl-user-location-dot')
  if (!dot) return

  const screen_angle = (screen?.orientation?.angle || 0)
  if (86 < Math.abs(event.beta) && Math.abs(event.beta) < 94) {
    // when the phone is around vertical, alpha is unreliable
    return
  }

  // Raw heading: degrees clockwise from north
  lastHeading = (event.alpha - screen_angle + 360) % 360

  if (isInCompassMode) {
    // Set bearing directly on transform to avoid firing movestart,
    // which would cause GeolocateControl to exit ACTIVE_LOCK
    map.transform.bearing = -lastHeading
    map.triggerRepaint()
  } else {
    // Rotate the cone indicator on the dot
    let heading = lastHeading
    heading += map.getBearing() // adjust to map rotation
    heading = (heading + 360) % 360
    dot.style.setProperty('--user-dot-rotation', `rotate(-${heading}deg)`)
  }
}
