import { Controller } from '@hotwired/stimulus'

export default class extends Controller {
  static targets = ['video', 'overlay']

  toggle () {
    if (this.videoTarget.paused) { this.videoTarget.play() } else { this.videoTarget.pause() }
    // the play button can hide with the focus on it, and keyboard users pause from the video
    this.videoTarget.focus()
  }

  // The end of the video also fires 'pause'
  syncOverlay () {
    this.overlayTargets.forEach(e => { e.hidden = !this.videoTarget.paused })
  }
}
