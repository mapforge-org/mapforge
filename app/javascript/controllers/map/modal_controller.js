import { Controller } from '@hotwired/stimulus'
import { resetControls } from 'maplibre/controls/shared'
import { draw } from 'maplibre/edit'
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
    if (draw) {
      draw.changeMode('simple_select', { featureIds: [] })
      map.fire('draw.modechange')
    }
    window.history.pushState({}, '', `${window.location.pathname}`)
  }
}