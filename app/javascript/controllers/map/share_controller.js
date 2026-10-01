import { Controller } from '@hotwired/stimulus'
import { sendMessage } from 'channels/map_channel'
import { initTooltips } from 'helpers/dom'
import { copyToClipboard } from 'helpers/clipboard'
import { mapProperties } from 'maplibre/map'

export default class extends Controller {
  static targets = ['qrViewer', 'qrCode', 'qrCaption', 'qrLabel']

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
    sendMessage('update_map', { view_permission: mapProperties['view_permission'] })
  }

  copyOwnershipLink (e) {
    e.preventDefault()
    const ownershipLink = window.location.origin + document.querySelector('#share-ownership-link a').getAttribute('href')
    copyToClipboard(ownershipLink, window.__('Ownership link copied'), e.currentTarget)
  }

  copyEditLink (e) {
    e.preventDefault()
    const editLink = window.location.origin + document.querySelector('#share-edit-link a').getAttribute('href')
    copyToClipboard(editLink, window.__('Edit link copied'), e.currentTarget)
  }

  copyViewLink (e) {
    e.preventDefault()
    const viewLink = window.location.origin + document.querySelector('#share-view-link a').getAttribute('href')
    copyToClipboard(viewLink, window.__('View link copied'), e.currentTarget)
  }

  // A tap lands on the icon or the badge inside the link, so only
  // currentTarget carries the href.
  nativeShare (e) {
    if (!navigator.share) { return }

    e.preventDefault()
    navigator.share({
      title: document.title,
      url: window.location.origin + e.currentTarget.getAttribute('href')
    }).catch((error) => console.log('Error sharing', error))
  }

  async showQr (e) {
    e.preventDefault()
    const { url: path, label } = e.currentTarget.dataset
    const url = window.location.origin + path
    const { default: qrcode } = await import('qrcode-generator')
    // level H restores up to 30% of the code, the logo in the center covers less.
    // Version 7 (45 modules) makes the fixed size corner eyes smaller relative to the code,
    // longer urls fall back to the smallest version that fits
    const make = (version) => {
      const qr = qrcode(version, 'H')
      qr.addData(url)
      qr.make()
      return qr
    }
    let qr
    try { qr = make(7) } catch { qr = make(0) }
    this.qrCodeTarget.innerHTML = qrSvg(qr)
    this.qrCaptionTarget.textContent = (mapProperties || window.gon.map_properties).name || ''
    this.qrLabelTarget.textContent = label
    this.qrViewerTarget.showModal()
  }

  closeQr () {
    this.qrViewerTarget.close()
  }

  // the share modal closes on esc as well, keep it open below the qr code
  stopEsc (e) {
    if (this.qrViewerTarget.open) { e.stopPropagation() }
  }

  copyEmbedCode (e) {
    e.preventDefault()
    const embedCode = this.element.querySelector('.embed-code').value.trim()
    copyToClipboard(embedCode, window.__('Embed code copied'), e.currentTarget)
  }
}

// Mapforge style: round dots, rounded finder eyes in the logo colors, logo in the center.
// The dots touch, a gap between them breaks decoders like jsQR at some render sizes
function qrSvg (qr) {
  const n = qr.getModuleCount()
  const quiet = 3
  const logo = Math.round(n * 0.3)
  const logoStart = (n - logo) / 2
  const isEye = (r, c) => (r < 7 || r >= n - 7) && (c < 7 || c >= n - 7) && !(r >= n - 7 && c >= n - 7)
  const isLogo = (r, c) => [r, c].every((v) => v >= logoStart - 0.5 && v < logoStart + logo + 0.5)

  let dots = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c) && !isEye(r, c) && !isLogo(r, c)) {
        dots += `<circle cx="${c + 0.5}" cy="${r + 0.5}" r="0.52"/>`
      }
    }
  }
  const eyes = [[0, 0], [n - 7, 0], [0, n - 7]].map(([x, y]) =>
    `<rect x="${x + 0.5}" y="${y + 0.5}" width="6" height="6" rx="2" fill="none" stroke="#4D7A9C"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="3" height="3" rx="1" fill="#B85E1E"/>`
  ).join('')
  const center = n / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-quiet} ${-quiet} ${n + 2 * quiet} ${n + 2 * quiet}">` +
    `<rect x="${-quiet}" y="${-quiet}" width="${n + 2 * quiet}" height="${n + 2 * quiet}" rx="3" fill="#fff"/>` +
    `<g fill="#354A51">${dots}</g>${eyes}` +
    `<circle cx="${center}" cy="${center}" r="${logo / 2 + 0.5}" fill="#fff"/>` +
    `<image href="/logo/sticker/mapforge-sticker-256.png" x="${logoStart}" y="${logoStart}" width="${logo}" height="${logo}"/>` +
    '</svg>'
}
