import { resetControls } from 'maplibre/controls/shared'
import { resetHighlightedFeature } from 'maplibre/feature'
import { draw } from 'maplibre/edit'

export class PolygonControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_polygon" type="button" title="Draw polygon (o)" aria-label="Draw polygon" aria-pressed="false"></button>'
    this._container.onclick = (e) => { this.toggleDrawPolygon(e) }
    document.addEventListener('keydown', (e) => {
      // skip key event when typing in input field
      const t = e.target
      const isTextInput = (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (isTextInput) return
      if (e.key === 'o') { this.toggleDrawPolygon(e) }
    })
  }

  toggleDrawPolygon(e) {
    e.preventDefault()
    resetHighlightedFeature()
    const button = document.querySelector('.mapbox-gl-draw_polygon')
    if (draw.getMode() === 'draw_polygon') {
      button.classList.remove('active')
      draw.changeMode('simple_select')
    } else {
      resetControls()
      button.classList.add('active')
      draw.changeMode('draw_polygon')
    }
    map.fire('draw.modechange')
  }

  onAdd(map) {
    map.getCanvas().appendChild(this._container)
    return this._container
  }

  onRemove() {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container)
    }
  }
}
