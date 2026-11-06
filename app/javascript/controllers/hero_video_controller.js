import { Controller } from '@hotwired/stimulus'

export default class extends Controller {
  static targets = ['video', 'overlay']

  play () {
    this.videoTarget.play()
    this.overlayTargets.forEach(e => { e.hidden = true })
  }
}
