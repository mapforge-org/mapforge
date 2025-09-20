import { Controller } from '@hotwired/stimulus'
import { resetControls } from 'maplibre/controls/shared'
import { draw } from 'maplibre/edit'
import { resetDirections } from 'maplibre/routing/osrm'

export default class extends Controller {
  close() {
    resetControls()
    resetDirections()
    if (draw) { draw.changeMode('simple_select', { featureIds: [] }) }
    // TODO: drop anchor if present 
    window.history.pushState({}, '', `${window.location.pathname}`)
  }
}