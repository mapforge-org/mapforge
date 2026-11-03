import { Controller } from '@hotwired/stimulus'

export default class extends Controller {
  static targets = ['image', 'overlay']

  play () {
    this.imageTarget.src = this.imageTarget.dataset.src
    this.overlayTargets.forEach(e => { e.hidden = true })
  }
}
