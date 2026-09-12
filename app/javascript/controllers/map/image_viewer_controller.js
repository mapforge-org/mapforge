import { Controller } from '@hotwired/stimulus'
import { isApp } from 'helpers/functions'

// In the PWA / TWA an image link stays inside the app window, and the way back
// reloads the whole map. Show the image in a dialog instead: it lives in the top
// layer, and on Android the system back button closes it like any browser dialog.
export default class extends Controller {
  static targets = ['image']

  open (event) {
    const link = event.target.closest('a[href^="/image/"]')
    if (!link || !isApp() || this.element.open) { return }
    event.preventDefault()
    this.imageTarget.src = link.getAttribute('href')
    this.allowZoom()
    this.element.showModal()
  }

  close () {
    this.element.close()
  }

  // the feature modal closes on esc as well, keep it open below the image
  stopEsc (event) {
    if (this.element.open) { event.stopPropagation() }
  }

  get viewport () {
    return document.querySelector('meta[name="viewport"]')
  }

  // the page forbids zoom for the map gestures, let the browser pinch zoom the image
  allowZoom () {
    this.pageViewport = this.viewport.content
    this.viewport.content = this.pageViewport.replace(/,\s*(maximum-scale|user-scalable)=[^,]*/g, '')
  }

  // runs on the close event, so the system back button and a click on the image
  // both restore the page. Chrome keeps the pinch scale when the page viewport
  // comes back, the locked scale below zooms the page out first
  forbidZoom () {
    if (!this.pageViewport) { return }
    this.viewport.content = 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no'
    requestAnimationFrame(() => { this.viewport.content = this.pageViewport })
  }
}
