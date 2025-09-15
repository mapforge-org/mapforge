import { resetControls } from 'maplibre/controls/shared'
import { resetHighlightedFeature } from 'maplibre/feature'
import { draw } from 'maplibre/edit'

export class PointControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="mapbox-gl-draw_ctrl-draw-btn mapbox-gl-draw_point" type="button" title="Draw point" aria-label="Draw point" aria-pressed="false"></button>'
    this._container.onclick = function (e) {
      resetHighlightedFeature()
      if (draw.getMode() === 'draw_point') {
        e.target.closest('button').classList.remove('active')
        draw.changeMode('simple_select')
      } else {
        resetControls()
        e.target.closest('button').classList.add('active')
        draw.changeMode('draw_point')
      }
      map.fire('draw.modechange')
    }
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