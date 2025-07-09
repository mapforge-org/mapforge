import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { initializeMap, setBackgroundMapLayer, initializeViewMode, initializeStaticMode } from 'maplibre/map'
import { initializeEditMode } from 'maplibre/edit'
import { initializeSocket } from 'channels/map_channel'

export default class extends Controller {
  connect () {
    functions.e('#map-header nav', e => { e.style.display = 'none' })
    initializeMap('maplibre-map')
    // static mode is used for screenshots + frontpage
    if (window.gon.map_mode === 'static') {
      initializeStaticMode()
    } else {
      initializeSocket()
      window.gon.map_mode !== 'rw' ? initializeViewMode() : initializeEditMode()
    }
    setBackgroundMapLayer()
  }
}
