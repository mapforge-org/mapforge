import { Controller } from '@hotwired/stimulus'
import { resetControls } from 'maplibre/controls/shared'
import { draw } from 'maplibre/edit'

export default class extends Controller {
  close() {
    resetControls()
    if (draw) { 
      draw.changeMode('simple_select', { featureIds: [] })
      map.fire('draw.modechange')
    }
    // TODO: drop anchor if present 
    window.history.pushState({}, '', `${window.location.pathname}`)
  }
}