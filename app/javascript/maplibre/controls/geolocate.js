import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import maplibregl from 'maplibre-gl'
import { map } from 'maplibre/map'

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

  geolocate.on('error', e => {
    console.warn('Error detecting location', e)
    status('Error detecting location', 'warning')
  })

  geolocate.on('geolocate', () => {
    pitchCompassView()
  })

  // follow mode
  geolocate.on('trackuserlocationstart', () => {
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
    wakeLock.release()
    wakeLock = null
    // probably mapbox draw bug: map can lose drag capabilities
    map.dragPan.enable()
  })

  map.addControl(geolocate, 'top-right')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-geolocate)').classList.add('hidden')

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
  if (dot) {
    let heading
    const screen_angle = (screen?.orientation?.angle || 0)
    if (86 < Math.abs(event.beta) && Math.abs(event.beta) < 94) {
      // when the phone is around vertical, alpha is unreliable
    } else {
      // console.log('Device Angles', event.alpha, event.beta, event.gamma)
      // console.log('Device Orientation', screen_angle)
      heading = event.alpha - screen_angle
      heading += map.getBearing() // adjust to map rotation
      heading = (heading + 360) % 360
      console.log('Heading', heading)
      dot.style.setProperty('--user-dot-rotation', `rotate(-${heading}deg)`)
    }
  }
}