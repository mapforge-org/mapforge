import * as functions from 'helpers/functions'

let fadeInterval = null

export function status (text, status = 'info', size = 'medium', duration = 6000) {
  console.log(`Status (${status}): ` + text)
  functions.e('#status-message', e => {
    // Text goes in as plain text, because messages can carry error text from other servers
    text instanceof Node ? e.replaceChildren(text) : (e.textContent = text)
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

function hideStatus () {
  functions.e('#status-container', e => { e.style.opacity = 0 })
  functions.e('#status-message', e => { e.innerHTML = '' })
  if (fadeInterval) { clearInterval(fadeInterval) }
}

export function hideInfoStatus () {
  if (document.querySelector('#status-container')?.classList.contains('status-info')) { hideStatus() }
}

// #status-container sits outside of the map controller, a turbo visit replaces the button
document.addEventListener('click', e => { if (e.target.closest('#status-close')) { hideStatus() } })
