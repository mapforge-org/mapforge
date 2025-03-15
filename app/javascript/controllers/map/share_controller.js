import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { mapProperties } from 'maplibre/map'
import { resetControls } from 'maplibre/controls/shared'

export default class extends Controller {
  connect () {
    // initializeMaplibreProperties is not called yet when rendering _share.haml
    let props = mapProperties || window.gon.map_properties

    if (window.gon.map_mode === "rw") {
      document.querySelector('#map-view-permissions').value = props['view_permission']
      document.querySelector('#map-edit-permissions').value = props['edit_permission']
    }
  }

  updateEditPermissions () {
    mapProperties['edit_permission'] = document.querySelector('#map-edit-permissions').value
    mapChannel.send_message('update_map', { edit_permission: mapProperties['edit_permission'] })
  }

  updateViewPermissions () {
    mapProperties['view_permission'] = document.querySelector('#map-view-permissions').value
    mapChannel.send_message('update_map', { view_permission: mapProperties['view_permission'] })
  }

  close () {
    resetControls()
  }
}
