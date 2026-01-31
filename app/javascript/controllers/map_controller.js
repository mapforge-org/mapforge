import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { initializeMap, setBackgroundMapLayer, initializeViewMode, 
  initializeStaticMode, addFeature } from 'maplibre/map'
import { initializeEditMode } from 'maplibre/edit'
import { initializeSocket, mapChannel } from 'channels/map_channel'
import { addUndoState } from 'maplibre/undo'

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

  // paste feature from clipboard
  async paste(_event) {
    
    if (functions.isFormFieldFocused()) { return }
    if (window.gon.map_mode !== 'rw') { return }
    try {
      const text = await navigator.clipboard.readText()
      const feature = JSON.parse(text)  // just to verify it's valid JSON
      if (feature.type === "Feature") {
        feature.id = functions.featureId()
        addFeature(feature)
        addUndoState('Feature added', feature)
        mapChannel.send_message('new_feature', feature)
      }
    } catch (err) {
      console.warn("Failed to read clipboard:", err)
    }
  } 
}
