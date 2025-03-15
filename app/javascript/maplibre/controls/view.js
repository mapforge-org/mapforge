import { ControlGroup, MapLayersControl, MapShareControl } from 'maplibre/controls/shared'
import { animateElement } from 'helpers/dom'

export class MapEditControl {
  constructor (_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-edit" type="button" title="Switch to edit mode" aria-label="Switch to edit mode" aria-pressed="false"><b><i class="bi bi-pencil-square"></i></b></button>'
    this._container.onclick = function (_e) {
      window.location.href = '/m/' + window.gon.edit_id
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

export function initializeViewControls () {
  if (window.gon.edit_id) {
    const controlGroup = new ControlGroup([new MapEditControl()])
    map.addControl(controlGroup, 'top-left')
    document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-edit)').classList.add('hidden') // hide for aos animation
  }

  const controlGroup = new ControlGroup(
    [new MapLayersControl(),
      new MapShareControl()])
  map.addControl(controlGroup, 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-layers)').classList.add('hidden') // hide for aos animation

  map.once('load', function (_e) {
    animateElement('.maplibregl-ctrl:has(button.maplibregl-ctrl-layers)', 'fade-right', 500)
  })
}
