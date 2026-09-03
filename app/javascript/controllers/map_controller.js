import { Controller } from '@hotwired/stimulus'
import { initializeSocket, sendMessage } from 'channels/map_channel'
import { parseClipboardFeature, setCopiedFeature } from 'helpers/clipboard'
import * as functions from 'helpers/functions'
import { moveFeatureTo } from 'maplibre/feature'
import { resetInitializationState } from 'maplibre/layers/layers'
import {
  addFeature,
  initializeMap,
  initializeStaticMode,
  initializeViewMode,
  lastMousePosition,
  map,
  setBackgroundMapLayer
} from 'maplibre/map'
import { clearImageState } from 'maplibre/styles/styles'
import { addUndoState, clearUndoHistory } from 'maplibre/undo'

export default class extends Controller {
  async connect () {
    // Clear module-level state from previous map
    resetInitializationState()
    clearImageState()
    clearUndoHistory()

    functions.e('#map-header nav', e => { e.style.display = 'none' })
    if (!await initializeMap('maplibre-map')) { return }
    // static mode is used for screenshots
    if (window.gon.map_mode === 'static') {
      initializeStaticMode()
    } else {
      if (window.gon.map_mode === 'rw') {
        // Lazy-load the edit module so read-only viewers don't pay for mapbox-gl-draw,
        // turf, routing, edit_styles and friends.
        const { initializeEditMode } = await import('maplibre/edit')
        await initializeEditMode()
      } else {
        initializeViewMode()
      }
      initializeSocket()
    }
    setBackgroundMapLayer()
  }

  disconnect() {
    // Clean up when navigating away from the map
    console.log('Map controller disconnecting, cleaning up...')
    resetInitializationState()
    clearImageState()
    clearUndoHistory()

    // Remove the map instance last
    if (window.map) {
      try {
        window.map.remove()
        window.map = null
      } catch (e) {
        console.warn('Error removing map instance:', e)
      }
    }
  }

  // paste feature from clipboard
  paste(event) {
    if (functions.isFormFieldFocused()) { return }
    if (window.gon.map_mode !== 'rw') { return }

    // the paste event carries the data, the clipboard API would ask the user for permission
    const feature = parseClipboardFeature(event.clipboardData?.getData('text'))
    if (!feature) { return }

    setCopiedFeature(feature)
    feature.id = functions.featureId()
    moveFeatureTo(feature, lastMousePosition || map.getCenter())
    addFeature(feature)
    addUndoState('Feature added', feature)
    sendMessage('new_feature', feature)
  }
}
