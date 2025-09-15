import { undo, redo } from 'maplibre/undo'

export class MapUndoControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-undo" type="button" title="Undo last change" aria-label="Undo last change" aria-pressed="false"><b><i class="bi bi-arrow-counterclockwise"></i></b></button>'
    this._container.onclick = function (_e) {
      undo()
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

export class MapRedoControl {
  constructor(_options) {
    this._container = document.createElement('div')
    this._container.innerHTML = '<button class="maplibregl-ctrl-btn maplibregl-ctrl-redo" type="button" title="Redo last change" aria-label="Redo last change" aria-pressed="false"><b><i class="fw-bold bi bi-arrow-clockwise "></i></b></button>'
    this._container.onclick = function (_e) {
      redo()
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