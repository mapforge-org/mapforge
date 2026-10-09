// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import '@hotwired/turbo-rails'

import 'stimulus-controllers-index'

// Note: Don't import map js here for faster frontpage load times

// Turbo 8 turns same-page anchor links into a full visit, so the view transition cross-fades
// the page instead of scrolling. Cancel those, the browser scrolls to the anchor itself.
document.addEventListener('turbo:click', function (event) {
  const url = new URL(event.detail.url)
  if (url.hash && url.pathname === location.pathname && url.search === location.search) {
    event.preventDefault()
  }
})

// Firefox fires input/change events when it restores form values on reload and session restore.
// Those handlers then save stale values (map name) or act on a feature that is not selected.
// A real edit always follows a user activation (click, key press), a restore comes before one.
for (const type of ['input', 'change']) {
  document.addEventListener(type, (event) => {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) { event.stopImmediatePropagation() }
  }, true)
}

if ('serviceWorker' in navigator) {
  // Register the service worker
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function (registration) {
        console.log('Service Worker registered with scope:', registration.scope)
      })
      .catch(function (error) {
        console.log('Service Worker registration failed:', error)
      })
  })
}

// Add a class to the HTML element if the browser is Chrome on mobile
if (/Chrome/.test(navigator.userAgent) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('chrome-mobile')
}

Turbo.StreamActions.remove_class = function () {
  const className = this.getAttribute("target")
  document.querySelectorAll(`.${className}`).forEach(el => el.remove())
}