import { map } from 'maplibre/map'
import { ControlGroup, MapSettingsControl, MapLayersControl, MapShareControl, revealControls } from 'maplibre/controls/shared'

let viewControlGroup

export function initializeViewControls () {
  viewControlGroup = new ControlGroup(
    [new MapSettingsControl(), new MapLayersControl(), new MapShareControl()])
  map.addControl(viewControlGroup, 'top-left')
  document.querySelector('.maplibregl-ctrl:has(button.maplibregl-ctrl-layers)').classList.add('hidden') // hide for aos animation

  revealControls(['.maplibregl-ctrl:has(button.maplibregl-ctrl-layers)'])
}

export function removeViewControls () {
  if (!viewControlGroup) { return }
  map.removeControl(viewControlGroup)
  viewControlGroup = undefined
}
