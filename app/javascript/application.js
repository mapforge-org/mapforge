// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import '@hotwired/turbo-rails'

// Importing maplibre + controllers early here, because loading them later
// from maplibre.haml caused issues with the turbo:load event which was received
// before the module finished loading
import 'controllers'

import AOS from 'aos'

// for debugging
window.AOS = AOS

// https://github.com/michalsnik/aos
window.addEventListener('turbo:load', function () {
  AOS.init({
    duration: 600,
    easing: 'ease-in-out',
    once: true
  })
})


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