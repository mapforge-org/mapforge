import * as functions from 'helpers/functions'

export function waitForElement (selector, callback, waitTime = 100) {
  const el = document.querySelector(selector)
  if (el) {
    callback(el)
  } else {
    setTimeout(() => waitForElement(selector, callback, waitTime), waitTime)
  }
}

export function showElements (selectors) {
  selectors = Array.isArray(selectors) ? selectors : [selectors]
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector)
    elements.forEach(element => { element.classList.remove('hidden'); element.classList.add('show') })
  })
}

export function hideElements (selectors) {
  selectors = Array.isArray(selectors) ? selectors : [selectors]
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector)
    elements.forEach(element => { element.classList.add('hidden'); element.classList.remove('show') })
  })
}

export function deleteElements(selectors) {
  selectors = Array.isArray(selectors) ? selectors : [selectors]
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector)
    elements.forEach(element => { element.remove() })
  })
}

// effects: the [data-animate] rules in application.css. The animation starts when the
// attribute is set, or again when the element comes back from display: none.
export function animateElement (selector, effect = 'fade-in', delay = 0) {
  functions.e(selector, e => {
    e.style.animationDelay = delay + 'ms'
    e.setAttribute('data-animate', effect)
    e.classList.remove('hidden')
  })
}

// initialize bs5 tooltips
export function initTooltips (root = document) {
  // a touch laptop with a mouse still hovers, isTouchDevice() alone would turn tooltips off there
  const touchOnly = functions.isTouchDevice() && !window.matchMedia('(hover: hover)').matches
  if (!touchOnly) {
    root.querySelectorAll('[data-toggle="tooltip"]').forEach(element => {
      if (typeof bootstrap !== 'undefined') {
        let tooltip = bootstrap.Tooltip.getInstance(element)
        if (!tooltip) {
          // Set default custom class if not already specified
          if (!element.hasAttribute('data-bs-custom-class')) {
            element.setAttribute('data-bs-custom-class', 'maplibregl-ctrl-tooltip')
          }
          new window.bootstrap.Tooltip(element)
        } else {
          tooltip.hide()
        }
      }
    })
  }
}

// A tooltip reads its text from 'data-bs-original-title': Bootstrap moves the title there on
// init and reads the title attribute no more. A title attribute next to it would add the
// tooltip of the browser on top of the Bootstrap one.
export function setTooltip (element, text) {
  element.setAttribute('data-bs-original-title', text)
  element.setAttribute('aria-label', text)
  element.removeAttribute('title')
  const tooltip = typeof bootstrap === 'undefined' ? null : bootstrap.Tooltip.getInstance(element)
  if (tooltip) {
    tooltip.setContent({ '.tooltip-inner': text })
  } else {
    initTooltips(element.parentElement)
  }
}

export function loadStylesheet (href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

export function isInputElement(target) {
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}
