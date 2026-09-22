import * as dom from 'helpers/dom'
import { status } from 'helpers/status'

export async function uploadImage(image) {
  const formData = new FormData() // send using multipart/form-data
  formData.append('image', image)
  formData.append('map_id', window.gon.map_id)
  dom.showElements('#preloader')
  try {
    const response = await fetch('/images', {
      method: 'POST',
      body: formData,
      headers: { 'X-CSRF-Token': window.gon.csrf_token }
    })
    if (!response.ok) {
      status(window.__('Error uploading image'), 'error')
      throw response.statusText
    }
    return await response.json()
  } finally {
    dom.hideElements('#preloader')
  }
}

export async function uploadImageToFeature(image, feature) {
  const data = await uploadImage(image)
  feature.properties = feature.properties || {}
  feature.properties['marker-image-url'] = data.icon
  feature.properties['stroke'] = 'transparent'
  feature.properties['marker-color'] = 'transparent'
  const desc = feature.properties.desc?.trim()
  if (!desc || desc.startsWith('[![image]')) {
    feature.properties['desc'] = `[![image](${data.image})](${data.image})\n`
  }
  return data
}

export async function confirmImageLocation(file) {
  let tags
  try {
    // Dynamically import ExifReader (https://github.com/mattiasw/ExifReader)
    const ExifReader = (await import('exif-reader'))
    tags = await ExifReader.load(file, { expanded: true, async: true })
  } catch (error) {
    // ExifReader throws on images without metadata and on containers it cannot parse.
    // Mobile uploads hit this often, iOS strips EXIF when a photo comes from the photo picker.
    console.log('No usable EXIF data: ' + error)
    return false
  }
  const gpsLng = tags?.gps?.Longitude, gpsLat = tags?.gps?.Latitude

  if (gpsLng && gpsLat) {
    return new Promise((resolve) => {
      const yesBtn = document.getElementById('confirmation-yes')
      const noBtn = document.getElementById('confirmation-no')

      const listeners = new AbortController()

      document.getElementById('confirmation-modal').classList.add('show')
      const cleanup = () => {
        listeners.abort()
        document.getElementById('confirmation-modal').classList.remove('show')
      }

      document.getElementById('confirmation-message').innerHTML =
        window.__('The image contains GPS coordinates (<code>%{coordinates}</code>).<br/>Do you want to place the marker there?')
          .replace('%{coordinates}', `${gpsLat.toFixed(6)}, ${gpsLng.toFixed(6)}`)

      yesBtn.addEventListener("click", () => { cleanup(); resolve([gpsLng, gpsLat]) }, { signal: listeners.signal })
      noBtn.addEventListener("click", () => { cleanup(); resolve(false) }, { signal: listeners.signal })
    })
  } else {
    return Promise.resolve(false)
  }
}
