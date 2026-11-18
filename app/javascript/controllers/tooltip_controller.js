import { Controller } from '@hotwired/stimulus'
import { initTooltips } from 'helpers/dom'

export default class extends Controller {
  connect () {
    // bootstrap.bundle loads async, so it can be missing on the first page load
    if (typeof bootstrap === 'undefined') {
      window.addEventListener('load', () => initTooltips(this.element), { once: true })
    } else {
      initTooltips(this.element)
    }
  }
}
