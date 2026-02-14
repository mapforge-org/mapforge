import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import { mapProperties } from 'maplibre/map'

export default class extends Controller {
  connect () {
    // initializeMaplibreProperties is not yet called yet when rendering _share.haml
    let props = mapProperties || window.gon.map_properties

    if (window.gon.map_mode === "rw") {
      document.querySelector('#map-view-permissions').value = props['view_permission']
      document.querySelector('#map-edit-permissions').value = props['edit_permission']
    }

    // Update share icons for native sharing support
    if (navigator.share) {
      document.querySelector('#share-edit-link i').classList.remove('bi-link-45deg')
      document.querySelector('#share-edit-link i').classList.add('bi-share')

      document.querySelector('#share-view-link i').classList.remove('bi-link-45deg')
      document.querySelector('#share-view-link i').classList.add('bi-share')
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

  nativeShareEditLink (e) {
    if (navigator.share) {
      e.preventDefault()
      navigator.share({
        title: document.querySelector('title').textContent,
        url: window.location.origin + e.target.getAttribute('href'),
      })
    .then(() => console.log('Successful share'))
    .catch((error) => console.log('Error sharing', error))
    }
  }

  nativeShareViewLink (e) {
    if (navigator.share) {
      e.preventDefault()
      navigator.share({
        title: document.querySelector('title').textContent,
        url: window.location.origin + e.target.getAttribute('href'),
      })
    .then(() => console.log('Successful share'))
    .catch((error) => console.log('Error sharing', error))
    }
  }

  copy (_e) {
    const embedCode = document.querySelector('#embed-code').value
    navigator.clipboard.writeText(embedCode).then(function () {
      status("Embed code copied")
    })
  }
}
