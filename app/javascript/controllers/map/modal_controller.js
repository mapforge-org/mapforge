import { Controller } from '@hotwired/stimulus'
import { resetControls } from 'maplibre/controls/shared'
import { changeMode, draw } from 'maplibre/edit'
import { descriptionHiddenKey } from 'maplibre/map'

export default class extends Controller {
  hideDescription(event) {
    if (event.target.checked) {
      localStorage.setItem(descriptionHiddenKey(), '1')
    } else {
      localStorage.removeItem(descriptionHiddenKey())
    }
  }

  close() {
    resetControls()
    if (draw) { changeMode('simple_select', { featureIds: [] }) }
    window.history.pushState({}, '', `${window.location.pathname}`)
  }
}