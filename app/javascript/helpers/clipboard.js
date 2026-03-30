import { status } from 'helpers/status'

/**
 * Copy text to clipboard using modern API with fallback
 * @param {string} text - Text to copy
 * @param {string} successMessage - Message to show on success
 * @param {HTMLElement|null} iconElement - Optional icon element for visual feedback
 */
export function copyToClipboard (text, successMessage, iconElement = null) {
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      status(successMessage)
      if (iconElement) {
        showCopySuccess(iconElement)
      }
    }).catch(() => {
      fallbackCopyToClipboard(text, successMessage, iconElement)
    })
  } else {
    // Fallback for non-secure contexts
    fallbackCopyToClipboard(text, successMessage, iconElement)
  }
}

/**
 * Fallback copy method using execCommand (for non-secure contexts)
 * @param {string} text - Text to copy
 * @param {string} successMessage - Message to show on success
 * @param {HTMLElement|null} iconElement - Optional icon element for visual feedback
 */
export function fallbackCopyToClipboard (text, successMessage, iconElement = null) {
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
    if (iconElement) {
      showCopySuccess(iconElement)
    }
  } catch (err) {
    status('Failed to copy')
    console.error('Fallback copy failed:', err)
  }

  document.body.removeChild(textArea)
}

/**
 * Show visual feedback on icon element after successful copy
 * @param {HTMLElement} iconElement - Icon element to animate
 */
export function showCopySuccess (iconElement) {
  // Find the actual icon element
  const icon = iconElement.querySelector('i') || iconElement

  // Store original classes
  const wasCheck = icon.classList.contains('bi-check2')

  // Don't animate if already showing success
  if (wasCheck) return

  // Change to checkmark with success styling
  icon.classList.remove('bi-copy')
  icon.classList.add('bi-check2', 'copy-success')

  // Revert after 2 seconds
  setTimeout(() => {
    icon.classList.remove('bi-check2', 'copy-success')
    icon.classList.add('bi-copy')
  }, 2000)
}
