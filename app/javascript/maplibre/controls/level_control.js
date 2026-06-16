import { initTooltips } from 'helpers/dom'

function levelLabel(level) {
  const n = parseFloat(level)
  if (isNaN(n)) return level
  if (!Number.isInteger(n)) return `Level ${level}`
  if (n === 0) return 'Ground'
  if (n < 0) return `Basement ${Math.abs(n)}`

  const abs = Math.abs(n)
  const mod100 = abs % 100
  const suffix = (mod100 >= 11 && mod100 <= 13) ? 'th' : (['th', 'st', 'nd', 'rd'][abs % 10] || 'th')
  return `${abs}${suffix} Floor`
}

function levelIcon(level) {
  const n = parseFloat(level)
  if (n === 0 || isNaN(n)) return 'bi-building'
  return n < 0 ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle'
}

export class LevelControl {
  constructor(layerId, onLevelChange, cssClass = 'level-control') {
    this.layerId = layerId
    this.onLevelChange = onLevelChange
    this.cssClass = cssClass
    this.element = null
    this.currentLevel = null
    this.levels = []
  }

  create() {
    if (this.element) return

    const existingControl = document.querySelector(`.${this.cssClass}[data-layer-id="${this.layerId}"]`)
    if (existingControl) {
      this.element = existingControl
      return
    }

    this.element = document.createElement('div')
    this.element.className = `maplibregl-ctrl ${this.cssClass}`
    this.element.setAttribute('data-layer-id', this.layerId)

    const header = document.createElement('div')
    header.className = 'level-control-header'
    header.textContent = 'Levels'
    this.element.appendChild(header)

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
        try { tooltip.dispose() } catch { /* noop */ }
      }
    })
  }

  createButton(level) {
    const label = levelLabel(level)
    const icon = levelIcon(level)

    const button = document.createElement('button')
    button.className = 'level-control-btn'
    button.setAttribute('data-level', level)
    button.setAttribute('aria-label', `Level ${level} – ${label}`)

    const iconEl = document.createElement('i')
    iconEl.className = `bi ${icon} level-control-icon`
    button.appendChild(iconEl)

    const info = document.createElement('span')
    info.className = 'level-control-info'

    const numberEl = document.createElement('span')
    numberEl.className = 'level-control-number'
    numberEl.textContent = level
    info.appendChild(numberEl)

    const labelEl = document.createElement('span')
    labelEl.className = 'level-control-label'
    labelEl.textContent = label
    info.appendChild(labelEl)

    button.appendChild(info)

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
