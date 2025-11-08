import { toggleDrawMode } from 'maplibre/edit'
import * as dom from 'helpers/dom'

export class PolygonControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_polygon" type="button" title="Draw polygon (o)" aria-label="Draw polygon" aria-pressed="false"></button>'
    this._container.onclick = (_e) => { toggleDrawMode('draw_polygon') }
    document.addEventListener('keydown', (e) => {
      // skip key event when typing in input field
      if (dom.isInputElement(e.target)) return
      if (e.key === 'o') { toggleDrawMode('draw_polygon') }
    })
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
