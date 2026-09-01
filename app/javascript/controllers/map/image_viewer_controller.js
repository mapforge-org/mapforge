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
    this.element.showModal()
  }

  close () {
    this.element.close()
  }

  // the feature modal closes on esc as well, keep it open below the image
  stopEsc (event) {
    if (this.element.open) { event.stopPropagation() }
  }
}
