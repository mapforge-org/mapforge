import { initTooltips } from 'helpers/dom'

export class IndoorLevelControl {
  constructor(layerId, onLevelChange) {
    this.layerId = layerId
    this.onLevelChange = onLevelChange
    this.element = null
    this.currentLevel = null
    this.levels = []
  }

  create() {
    if (this.element) return

    // Check if a control for this layer already exists
    const existingControl = document.querySelector(`.indoor-level-control[data-layer-id="${this.layerId}"]`)
    if (existingControl) {
      this.element = existingControl
      return
    }

    this.element = document.createElement('div')
    this.element.className = 'maplibregl-ctrl maplibregl-ctrl-group indoor-level-control'
    this.element.setAttribute('data-layer-id', this.layerId)

    const bottomRight = document.querySelector('.maplibregl-ctrl-bottom-right')
    if (bottomRight) {
      const attrib = bottomRight.querySelector('.maplibregl-ctrl-attrib')
      if (attrib) {
        bottomRight.insertBefore(this.element, attrib)
      } else {
        bottomRight.appendChild(this.element)
      }
    }
  }

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

  update(levels, currentLevel) {
    if (!this.element) {
      this.create()
    }

    const levelsChanged = JSON.stringify(levels) !== JSON.stringify(this.levels)

    if (levelsChanged) {
      this.disposeTooltips()
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

  remove() {
    if (this.element && this.element.parentNode) {
      this.disposeTooltips()
      this.element.parentNode.removeChild(this.element)
    }
    this.element = null
    this.levels = []
    this.currentLevel = null
  }

  show() {
    if (this.element) {
      this.element.style.display = ''
    }
  }

  hide() {
    if (this.element) {
      this.disposeTooltips()
      this.element.style.display = 'none'
    }
  }
}
