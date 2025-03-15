import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { animateElement } from 'helpers/dom'
import { initializeMap, setBackgroundMapLayer, initializeViewMode, initializeStaticMode } from 'maplibre/map'
import { initializeEditMode } from 'maplibre/edit'
import { initializeSocket } from 'channels/map_channel'
import { resetControls } from 'maplibre/controls/shared'

export default class extends Controller {
  connect () {
    functions.e('#map-header', e => { e.style.display = 'none' })
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

  toggleNavigation (_event) {
    if (document.querySelector('#map-header').style.display === 'none') {
      functions.e('#map-header', e => { e.style.display = 'block' })
      resetControls()
      functions.e('#map-nav-toggle', e => {
        e.classList.remove('bi-caret-down')
        e.classList.add('bi-caret-up')
      })
      functions.e('#map-head', e => { e.style.top = '60px' })
      functions.e('.maplibregl-ctrl-top-left', e => { e.style.top = '60px' })
      functions.e('.maplibregl-ctrl-top-right', e => { e.style.top = '60px' })
      animateElement('.navbar', 'fade-down')
    } else {
      functions.e('#map-header', e => { e.style.display = 'none' })
      functions.e('#map-nav-toggle', e => {
        e.classList.remove('bi-caret-up')
        e.classList.add('bi-caret-down')
      })
      functions.e('#map-head', e => { e.style.top = 'unset' })
      functions.e('.maplibregl-ctrl-top-left', e => { e.style.top = '2.4em' })
      functions.e('.maplibregl-ctrl-top-right', e => { e.style.top = 'unset' })
    }
  }
}
