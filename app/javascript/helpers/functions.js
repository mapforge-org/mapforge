const debounceList = []

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

export function debounce (callback, name, delay = 1500) {
  // console.log('debounce: clearing timeout ' + name)
  clearTimeout(debounceList[name])
  debounceList[name] = setTimeout(() => callback(), delay)
  // console.log('debounce: setting ' + delay + 'ms timeout for ' + name)
}

export function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function arrayRemove (arr, value) {
  return arr.filter(function (ele) {
    return ele !== value
  })
}

// takes array, and reduces it with condition function
// returns reduced array, and array of filtered elements
export function reduceArray (array, condition) {
  const filtered = array.filter(condition)
  filtered.forEach(e => array.splice(array.indexOf(e), 1))
  return filtered
}

export function roundedCoords (coords, precision = 3) {
  return coords.map(coord => parseFloat(coord.toFixed(precision)))
}

export function removeElevation (coords) {
  return coords.map(coord => coord.slice(0, 2))
}

export function isMobileDevice () {
  return (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
}

export function isTouchDevice () {
  return ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0) ||
         (navigator.msMaxTouchPoints > 0) ||
         (window.matchMedia('(pointer: coarse)').matches) ||
         (!!window.DocumentTouch && document instanceof window.DocumentTouch)
}

// takes a css selector and callback method
export function e (selector, callback) {
  const elements = document.querySelectorAll(selector)
  elements.forEach(element => {
    callback(element)
  })
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

export function findCoordinate (coordinates, coordinate) {
  for (let i = 0; i < coordinates.length; i++) {
    if (coordinates[i][0].toFixed(5) === coordinate[0].toFixed(5) &&
          coordinates[i][1].toFixed(5) === coordinate[1].toFixed(5)) {
      return i
    }
  }
  return -1
}
