import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { initTooltips } from 'helpers/dom'
import { copyToClipboard } from 'helpers/clipboard'
import { mapProperties } from 'maplibre/map'

export default class extends Controller {
  connect () {
    // initializeMaplibreProperties is not yet called yet when rendering _share.haml
    let props = mapProperties || window.gon.map_properties

    if (window.gon.map_mode === "rw") {
      document.querySelector('#map-gallery-toggle').checked = props['view_permission'] === 'listed'
    }

    // Update share icons for native sharing support
    if (navigator.share) {
      const ownershipLinkIcon = document.querySelector('#share-ownership-link i')
      if (ownershipLinkIcon) {
        ownershipLinkIcon.classList.remove('bi-shield-fill-check')
        ownershipLinkIcon.classList.add('bi-share')
      }

      const editLinkIcon = document.querySelector('#share-edit-link i')
      if (editLinkIcon) {
        editLinkIcon.classList.remove('bi-pencil-square')
        editLinkIcon.classList.add('bi-share')
      }

      const viewLinkIcon = document.querySelector('#share-view-link i')
      if (viewLinkIcon) {
        viewLinkIcon.classList.remove('bi-eye-fill')
        viewLinkIcon.classList.add('bi-share')
      }
    }

    // Initialize tooltips for avatars and copy buttons
    initTooltips(this.element)
  }

  updateGalleryVisibility () {
    const isListed = document.querySelector('#map-gallery-toggle').checked
    mapProperties['view_permission'] = isListed ? 'listed' : 'link'
    mapChannel.send_message('update_map', { view_permission: mapProperties['view_permission'] })
  }

  copyOwnershipLink (e) {
    e.preventDefault()
    const ownershipLink = window.location.origin + document.querySelector('#share-ownership-link a').getAttribute('href')
    copyToClipboard(ownershipLink, "Ownership link copied", e.currentTarget)
  }

  copyEditLink (e) {
    e.preventDefault()
    const editLink = window.location.origin + document.querySelector('#share-edit-link a').getAttribute('href')
    copyToClipboard(editLink, "Edit link copied", e.currentTarget)
  }

  copyViewLink (e) {
    e.preventDefault()
    const viewLink = window.location.origin + document.querySelector('#share-view-link a').getAttribute('href')
    copyToClipboard(viewLink, "View link copied", e.currentTarget)
  }

  nativeShareOwnershipLink (e) {
    if (navigator.share) {
      e.preventDefault()
      navigator.share({
        title: document.querySelector('title').textContent,
        url: window.location.origin + e.target.getAttribute('href'),
      })
    .catch((error) => console.log('Error sharing', error))
    }
  }

  nativeShareEditLink (e) {
    if (navigator.share) {
      e.preventDefault()
      navigator.share({
        title: document.querySelector('title').textContent,
        url: window.location.origin + e.target.getAttribute('href'),
      })
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
    .catch((error) => console.log('Error sharing', error))
    }
  }

  copyEmbedCode (e) {
    e.preventDefault()
    const embedCode = document.querySelector('#embed-code').value
    copyToClipboard(embedCode, "Embed code copied", e.currentTarget)
  }
}
