import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { initializeMap, setBackgroundMapLayer, initializeViewMode, initializeStaticMode } from 'maplibre/map'
import { initializeEditMode } from 'maplibre/edit'
import { initializeSocket } from 'channels/map_channel'

export default class extends Controller {
  async connect () {
    functions.e('#map-header nav', e => { e.style.display = 'none' })
    await initializeMap('maplibre-map')
    // static mode is used for screenshots
    if (window.gon.map_mode === 'static') {
      initializeStaticMode()
    } else {
      window.gon.map_mode !== 'rw' ? initializeViewMode() : await initializeEditMode()
      initializeSocket()
    }
    setBackgroundMapLayer()
  }
}
