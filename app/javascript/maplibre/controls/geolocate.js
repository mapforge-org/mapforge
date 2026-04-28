import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import maplibregl from 'maplibre-gl'
import { map, mapProperties } from 'maplibre/map'

let isInFollowMode = false
let isInCompassMode = false
let userHasZoomed = false
let hasFoundFirstPosition = false
let lastHeading = null
let lastAppliedHeading = null
let geolocateControl = null
// Cache DOM element — querySelector in a 20 Hz loop is wasteful
let cachedDot = null
// Track orientation listener for cleanup
let orientationListener = null
let orientationEventName = null

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
  // Test: https://jbmoelker.github.io/Full-Tilt/examples/
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
    status('Error detecting location: ' + e.message, 'warning')
  })

  geolocate.on('geolocate', (position) => {
    const coords = position.coords
    console.log('geolocate event', coords)
    if (coords) {
      if (!hasFoundFirstPosition && isInFollowMode) {
        hasFoundFirstPosition = true
        status('Following position', 'info')
      }
      window.dispatchEvent(new CustomEvent('gps-position', {
        detail: { lng: coords.longitude, lat: coords.latitude }
      }))
    }
  })

  // follow mode
  geolocate.on('trackuserlocationstart', () => {
    isInFollowMode = true
    hasFoundFirstPosition = false
    status('Searching position', 'info')
    requestWakeLock()

    cachedDot = document.querySelector('.maplibregl-user-location-dot')
    // Hide cone initially — only show it once valid heading data arrives
    if (cachedDot) cachedDot.style.setProperty('--display-direction-view', 'none')

    const isIOS = typeof DeviceOrientationEvent !== 'undefined'
      && typeof DeviceOrientationEvent.requestPermission === 'function'

    if (!isIOS && !('ondeviceorientationabsolute' in window)) {
      status('Device Orientation not supported', 'info')
      return
    }

    // Throttle to 20 Hz — device orientation fires at 60-100 Hz,
    // each setBearing triggers a full map re-render
    orientationListener = (event) => {
      functions.throttle(() => setLocationOrientation(event), 'compass', 50)
    }

    // iOS Safari: uses deviceorientation with webkitCompassHeading for absolute heading
    // (deviceorientationabsolute is not supported on iOS)
    if (isIOS) {
      orientationEventName = 'deviceorientation'
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            window.addEventListener(orientationEventName, orientationListener)
          }
        })
        .catch(console.error)
    } else {
      // https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientationabsolute_event
      orientationEventName = 'deviceorientationabsolute'
      window.addEventListener(orientationEventName, orientationListener)
    }
  })

  geolocate.on('trackuserlocationend', () => {
    isInFollowMode = false
    userHasZoomed = false
    if (isInCompassMode) {
      deactivateCompassMode()
    }
    // probably mapbox draw bug: map can lose drag capabilities
    map.dragPan.enable()
    // trackuserlocationend is sent as soon as auto-follow is off
    // only fully clean up when tracking is completely turned off
    if (geolocate._watchState === 'OFF') {
      cachedDot = null
      if (orientationListener && orientationEventName) {
        window.removeEventListener(orientationEventName, orientationListener)
        orientationListener = null
        orientationEventName = null
      }
      status('Tracking off', 'info')
      // reset geolocate button icon to default state
      const btn = document.querySelector('button.maplibregl-ctrl-geolocate')
      btn.classList.remove('maplibregl-ctrl-geolocate-compass')
      if (wakeLock) {
        wakeLock.release()
        wakeLock = null
      }
      window.dispatchEvent(new CustomEvent('gps-position', { detail: null }))
    } else {
      status('Tracking position', 'info')
    }
  })

  map.addControl(geolocate, 'top-right')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-geolocate)').classList.add('hidden')

  // Geolocate button click cycle: OFF → Follow → Compass → OFF
  // 1. OFF: click triggers default MapLibre behavior → enters follow mode (ACTIVE_LOCK)
  // 2. Follow (ACTIVE_LOCK): intercept click → enter compass mode (map rotates with device heading)
  // 3. Compass: intercept click → deactivate compass, trigger() to turn off tracking
  const geolocateButton = document.querySelector('button.maplibregl-ctrl-geolocate')
  geolocateButton.addEventListener('click', (e) => {
    if (!isInCompassMode && geolocateControl._watchState === 'ACTIVE_LOCK') {
      e.stopImmediatePropagation()
      activateCompassMode()
    } else if (isInCompassMode) {
      e.stopImmediatePropagation()
      deactivateCompassMode()
      // Ensure ACTIVE_LOCK so trigger() follows the ACTIVE_LOCK → OFF path
      geolocateControl._watchState = 'ACTIVE_LOCK'
      geolocateControl.trigger()
    }
  }, true) // capture phase

  // Intercept zoom buttons to ensure they work in all geolocation modes (follow and compass).
  // geolocateSource flag prevents GeolocateControl from exiting tracking mode on user zoom.
  document.querySelector('button.maplibregl-ctrl-zoom-in')?.addEventListener('click', (e) => {
    if (isInFollowMode) {
      e.stopImmediatePropagation()
      lockUserZoom()
      map.easeTo({ zoom: map.getZoom() + 1, duration: 200 }, { geolocateSource: true })
    }
  }, true)
  document.querySelector('button.maplibregl-ctrl-zoom-out')?.addEventListener('click', (e) => {
    if (isInFollowMode) {
      e.stopImmediatePropagation()
      lockUserZoom()
      map.easeTo({ zoom: map.getZoom() - 1, duration: 200 }, { geolocateSource: true })
    }
  }, true)

  // In compass mode, ignore small rotations (e.g. from two-finger pitch gestures)
  // but exit on deliberate rotation. Device heading updates at 20 Hz will
  // continuously correct incidental drift.
  map.on('rotate', (e) => {
    if (isInCompassMode && e.originalEvent && lastHeading !== null) {
      const expectedBearing = -lastHeading
      const drift = Math.abs(map.getBearing() - expectedBearing)
      if (drift > 10) {
        deactivateCompassMode()
      }
    }
  })
}

// After the first manual zoom in follow/compass mode, override GeolocateControl's
// _updateCamera to only update center — preventing fitBounds from resetting zoom.
function lockUserZoom() {
  if (userHasZoomed) return
  userHasZoomed = true
  geolocateControl._updateCamera = (position) => {
    const center = [position.coords.longitude, position.coords.latitude]
    map.easeTo({ center, bearing: map.getBearing(), duration: 200 }, { geolocateSource: true })
  }
}

function activateCompassMode() {
  isInCompassMode = true
  status('Compass mode', 'info')

  // Disable map dragging and rotation in compass mode — map orientation follows device heading
  map.dragPan.disable()
  map.dragRotate.disable()
  map.touchZoomRotate.disableRotation()

  const btn = document.querySelector('button.maplibregl-ctrl-geolocate')
  btn.classList.add('maplibregl-ctrl-geolocate-compass')

  // Apply current heading with smooth transition if available
  if (lastHeading !== null) {
    // geolocateSource flag prevents GeolocateControl from exiting ACTIVE_LOCK on movestart
    map.easeTo({
      bearing: -lastHeading,
      duration: 500,
    }, { geolocateSource: true })
  }
}

function deactivateCompassMode() {
  isInCompassMode = false
  lastAppliedHeading = null

  // Re-enable map dragging and rotation
  map.dragPan.enable()
  map.dragRotate.enable()
  map.touchZoomRotate.enableRotation()

  const btn = document.querySelector('button.maplibregl-ctrl-geolocate')
  btn.classList.remove('maplibregl-ctrl-geolocate-compass')

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
  const dot = cachedDot || document.querySelector('.maplibregl-user-location-dot')
  if (!dot) return

  // device orientation
  const screen_angle = screen?.orientation?.angle || 0

  // iOS Safari: webkitCompassHeading provides absolute heading via deviceorientation
  // webkitCompassAccuracy is -1 when compass hardware is unavailable (e.g. iPad without compass)
  if (event.webkitCompassAccuracy !== undefined && event.webkitCompassAccuracy <= 0) return
  // if (event.webkitCompassHeading === 0) return

  // iOS device with compass heading available
  if (event.webkitCompassHeading >= 0) {
    // webkitCompassHeading is CW from north; convert to alpha convention (CCW)
    // so the existing -lastHeading usage produces the correct CW bearing
    lastHeading = (360 - event.webkitCompassHeading - screen_angle + 720) % 360
    // status('ios heading: ' + event.webkitCompassHeading + ' computed: ' + lastHeading)
  } else {
    // non-iOS: deviceorientationabsolute with event.alpha
    if (!event.absolute) {
      return
    }
    if (89 < Math.abs(event.beta) && Math.abs(event.beta) < 91) {
      // when the phone is around vertical, alpha is unreliable (gimbal lock)
      return
    }
    lastHeading = (360 - event.alpha - screen_angle + 720) % 360
    // status('android heading: ' + event.alpha + ' computed: ' + lastHeading)
  }

  // Show cone now that we have valid heading data
  dot.style.setProperty('--display-direction-view', 'block')

  if (isInCompassMode) {
    // Skip imperceptible heading changes (< 1°) to avoid redundant map re-renders
    if (lastAppliedHeading !== null && Math.abs(lastHeading - lastAppliedHeading) < 1) return
    lastAppliedHeading = lastHeading
    // geolocateSource flag prevents GeolocateControl from exiting ACTIVE_LOCK on movestart
    map.setBearing(-lastHeading, { geolocateSource: true })
    // Cone points upward in compass mode since the map itself is rotated
    dot.style.setProperty('--user-dot-rotation', 'rotate(0deg)')
  } else {
    // Rotate the cone indicator on the dot
    let heading = lastHeading
    heading += map.getBearing() // adjust to map rotation
    heading = (heading + 360) % 360
    dot.style.setProperty('--user-dot-rotation', `rotate(-${heading}deg)`)
  }
}
