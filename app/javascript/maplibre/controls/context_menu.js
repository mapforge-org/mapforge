import * as functions from 'helpers/functions'
import { getFeature } from 'maplibre/layers/layers'

export function initContextMenu(e) {
  functions.e('#map-context-menu', el => {
    el.innerHTML = ''
    // Position the context menu
    el.style.left = `${e.point.x}px`
    el.style.top = `${e.point.y}px`
  })
}

/**
 * If the context click is on a line vertex, add "Delete line point" and optionally
 * "Cut line here" items to the context menu. Called after initContextMenu(e).
 * @param {Object} e - Map contextmenu event (e.point used for queryRenderedFeatures)
 * @returns {boolean} - true if menu items were added
 */
export function addLineVertexMenuItems(f) {
  const feature = getFeature(f.properties.parent, 'geojson')
  if (!feature || feature.geometry.type !== 'LineString') { return }
  if (!feature.geometry.coordinates || feature.geometry.coordinates.length <= 2) { return }
  const vertexIndex = f.properties.coord_path

  functions.e('#map-context-menu', el => {
    el.classList.remove('hidden')

    const deleteButton = document.createElement('div')
    deleteButton.classList.add('context-menu-item')
    deleteButton.innerText = 'Delete line point'
    deleteButton.dataset.action = 'click->map--context-menu#deleteMidpoint'
    deleteButton.dataset.featureId = f.properties.parent
    deleteButton.dataset.index = vertexIndex
    el.appendChild(deleteButton)

    if (vertexIndex > 0 && vertexIndex < feature.geometry.coordinates.length - 1) {
      const cutButton = document.createElement('div')
      cutButton.classList.add('context-menu-item')
      cutButton.innerText = 'Cut line here'
      cutButton.dataset.action = 'click->map--context-menu#cutLine'
      cutButton.dataset.featureId = f.properties.parent
      cutButton.dataset.index = vertexIndex
      el.appendChild(cutButton)
    }
  })
}

export function hideContextMenu () {
  functions.e('#map-context-menu', menu => {
    menu.innerHTML = ''
    menu.classList.add('hidden')
  })
}

