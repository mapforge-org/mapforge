import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { initTooltips } from 'helpers/dom'
import { status } from 'helpers/status'
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
      const editLinkIcon = document.querySelector('#share-edit-link i')
      if (editLinkIcon) {
        editLinkIcon.classList.remove('bi-link-45deg')
        editLinkIcon.classList.add('bi-share')
      }

      const viewLinkIcon = document.querySelector('#share-view-link i')
      if (viewLinkIcon) {
        viewLinkIcon.classList.remove('bi-link-45deg')
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
    this.copyToClipboard(ownershipLink, "Ownership link copied")
  }

  copyEditLink (e) {
    e.preventDefault()
    const editLink = window.location.origin + document.querySelector('#share-edit-link a').getAttribute('href')
    this.copyToClipboard(editLink, "Edit link copied")
  }

  copyViewLink (e) {
    e.preventDefault()
    const viewLink = window.location.origin + document.querySelector('#share-view-link a').getAttribute('href')
    this.copyToClipboard(viewLink, "View link copied")
  }

  copyToClipboard (text, successMessage) {
    // Try modern clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        status(successMessage)
      }).catch(() => {
        this.fallbackCopyToClipboard(text, successMessage)
      })
    } else {
      // Fallback for non-secure contexts
      this.fallbackCopyToClipboard(text, successMessage)
    }
  }

  fallbackCopyToClipboard (text, successMessage) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    try {
      document.execCommand('copy')
      status(successMessage)
    } catch (err) {
      status("Failed to copy link")
      console.error('Fallback copy failed:', err)
    }

    document.body.removeChild(textArea)
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
    this.copyToClipboard(embedCode, "Embed code copied")
  }
}
