import * as functions from 'helpers/functions'

let fadeInterval = null

export function status (text, status = 'info', size = 'medium', duration = 4000) {
  console.log('Status: ' + text)
  functions.e('#status-message', e => {
    e.innerHTML = text
    e.className = size
  })
  functions.e('#status-container', e => {
    e.style.opacity = 1
    e.className = 'status-' + status
  })
  if (fadeInterval) { clearInterval(fadeInterval) }
  fadeInterval = setInterval(function () {
    functions.e('#status-container', e => { e.style.opacity = 0 })
    functions.e('#status-message', e => { e.innerHTML = '' })
  }, duration)
}
