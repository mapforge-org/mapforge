const debounceList = []
const throttleList = []

export function hexToRgb (hex) {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)

  if (hex.length === 4) {
    r = parseInt(hex.slice(1, 2), 16)
    g = parseInt(hex.slice(2, 3), 16)
    b = parseInt(hex.slice(3, 4), 16)
  }
  return [r, g, b]
}

// <input type="color"> takes #rrggbb only. Firefox silently turns a short hex like '#fff'
// or a name like 'red' into black, so canvas expands it first.
let colorCtx
export function hexColor (color, fallback) {
  colorCtx ||= document.createElement('canvas').getContext('2d')
  colorCtx.fillStyle = fallback
  colorCtx.fillStyle = color // an invalid value leaves the fallback in place
  return /^#[0-9a-f]{6}$/.test(colorCtx.fillStyle) ? colorCtx.fillStyle : fallback
}

export function debounce (callback, name, delay = 1500) {
  // console.log('debounce: clearing timeout ' + name)
  clearTimeout(debounceList[name])
  debounceList[name] = setTimeout(() => callback(), delay)
  // console.log('debounce: setting ' + delay + 'ms timeout for ' + name)
}

export function throttle(callback, name, delay=500) {
  const now = Date.now()
  if (now - (throttleList[name] || 0) >= delay) {
    throttleList[name] = now
    callback()
  }
}

// Runs callback at most once per animation frame, with the arguments of the latest call.
// Unlike throttle(), the last call is never dropped, so a hover ends on the right feature.
export function perFrame (callback) {
  let pending = null
  return (...args) => {
    if (!pending) {
      requestAnimationFrame(() => {
        const latest = pending
        pending = null
        callback(...latest)
      })
    }
    pending = args
  }
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function removeElevation (coords) {
  return coords.map(coord => coord.slice(0, 2))
}

export function isMobileDevice () {
  return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isTouchDevice () {
  return navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
}

// Keep in sync with the bottom sheet media queries in feature.css and modals.css
export function isBottomSheet () {
  return window.matchMedia('(width <= 640px), (height < 410px)').matches
}

export function isApp () {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// takes a css selector and callback method
export function e (selector, callback) {
  document.querySelectorAll(selector).forEach(callback)
}

export function addEventListeners (element, events, callback) {
  events.forEach(event => {
    element.addEventListener(event, callback)
  })
}

export function hasCoordinate (coordinates, coordinate) {
  // console.log("checking " + coordinates + " for " + coordinate)
  return coordinates.some(coord =>
    coord[0].toFixed(5) === coordinate[0].toFixed(5) &&
    coord[1].toFixed(5) === coordinate[1].toFixed(5))
}

export function featureId () {
  return Math.random().toString(36).substring(2, 18)
}

// Text from OSM and from other outside sources can carry markup. The quotes are escaped
// too, so the result is also safe inside a quoted html attribute.
export function escapeHtml (text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// A 'marker-symbol' is either a native emoji, or a path into an icon set (see public/icon-sets).
// The same rule as a maplibre expression sits in maplibre/styles/styles.js, a layout property
// cannot call a function.
export function symbolUrl (symbol) {
  return symbol.includes('/') ? symbol : '/icon-sets/noto/' + symbol + '.png'
}

export function isTestEnvironment() {
  return (window.gon.rails_env === "test")
}

export function toDegreesMinutes (decimal, isLatitude) {
  const abs = Math.abs(decimal)
  const degrees = Math.floor(abs)
  const minutes = (abs - degrees) * 60

  let hemisphere = ''
  if (isLatitude) {
    hemisphere = decimal >= 0 ? 'N' : 'S'
  } else {
    hemisphere = decimal >= 0 ? 'E' : 'W'
  }

  return degrees + '° ' + minutes.toFixed(3) + "' " + hemisphere
}
