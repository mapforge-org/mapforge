import { resetControls } from 'maplibre/controls/shared'
import { resetEditControls } from 'maplibre/controls/edit'

export class MapSelectControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-select" type="button" title="Select mode" aria-label="Select mode" aria-pressed="false"><b><i class="bi bi-hand-index"></i></b></button>'
    this._container.onclick = function (e) {
      resetControls()
      resetEditControls()
      e.target.closest('button').classList.add('active')
    }
  }
  onAdd (map) {
    map.getCanvas().appendChild(this._container)
    return this._container
  }

  onRemove () {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container)
    }
  }
}