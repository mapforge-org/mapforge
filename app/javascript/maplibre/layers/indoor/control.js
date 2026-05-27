import { initTooltips } from 'helpers/dom'

/**
 * Level control UI for indoor maps
 * Displays a vertical stack of buttons for switching between floor levels
 */
export class IndoorLevelControl {
  constructor(layerId, onLevelChange) {
    this.layerId = layerId
    this.onLevelChange = onLevelChange
    this.element = null
    this.currentLevel = null
    this.levels = []
  }

  /**
   * Creates and shows the level control
   */
  create() {
    if (this.element) return

    // Check if a control for this layer already exists
    const existingControl = document.querySelector(`.indoor-level-control[data-layer-id="${this.layerId}"]`)
    if (existingControl) {
      this.element = existingControl
      return
    }

    this.element = document.createElement('div')
    this.element.className = 'indoor-level-control'
    this.element.setAttribute('data-layer-id', this.layerId)

    const mapContainer = document.querySelector('#maplibre-map')
    if (mapContainer) {
      mapContainer.appendChild(this.element)
    }
  }

  /**
   * Disposes all tooltips on buttons in this control
   */
  disposeTooltips() {
    if (!this.element || typeof bootstrap === 'undefined') return

    this.element.querySelectorAll('button').forEach(button => {
      const tooltip = bootstrap.Tooltip.getInstance(button)
      if (tooltip) {
        try {
          tooltip.dispose()
        } catch {
          // Tooltip might be mid-animation when dispose is called
        }
      }
    })
  }

  /**
   * Creates a button for a level
   * @param {string} level - The level value
   * @returns {HTMLButtonElement} The created button
   */
  createButton(level) {
    const button = document.createElement('button')
    button.textContent = level
    button.title = `Level ${level}`
    button.setAttribute('data-level', level)
    button.setAttribute('data-toggle', 'tooltip')
    button.setAttribute('data-bs-trigger', 'hover')
    button.addEventListener('click', () => {
      if (this.onLevelChange) {
        this.onLevelChange(level)
      }
    })
    return button
  }

  /**
   * Updates the control with the given levels
   * @param {string[]} levels - Array of level strings, sorted descending
   * @param {string} currentLevel - The currently active level
   */
  update(levels, currentLevel) {
    if (!this.element) {
      this.create()
    }

    const levelsChanged = JSON.stringify(levels) !== JSON.stringify(this.levels)

    if (levelsChanged) {
      this.levels = levels

      const existingButtons = new Map()
      this.element.querySelectorAll('button').forEach(button => {
        existingButtons.set(button.getAttribute('data-level'), button)
      })

      const newLevelSet = new Set(levels)
      existingButtons.forEach((button, level) => {
        if (!newLevelSet.has(level)) {
          const tooltip = bootstrap.Tooltip.getInstance(button)
          if (tooltip) tooltip.dispose()
          button.remove()
        }
      })

      levels.forEach(level => {
        let button = existingButtons.get(level)
        if (!button) {
          button = this.createButton(level)
        }
        this.element.appendChild(button)
      })

      initTooltips(this.element)
    }

    this.currentLevel = currentLevel
    this.element.querySelectorAll('button').forEach(button => {
      button.classList.toggle('active', button.getAttribute('data-level') === currentLevel)
    })
  }

  /**
   * Removes the control from the DOM
   */
  remove() {
    if (this.element && this.element.parentNode) {
      this.disposeTooltips()
      this.element.parentNode.removeChild(this.element)
    }
    this.element = null
    this.levels = []
    this.currentLevel = null
  }

  /**
   * Shows the control
   */
  show() {
    if (this.element) {
      this.element.style.display = 'flex'
    }
  }

  /**
   * Hides the control
   */
  hide() {
    if (this.element) {
      this.disposeTooltips()
      this.element.style.display = 'none'
    }
  }
}
