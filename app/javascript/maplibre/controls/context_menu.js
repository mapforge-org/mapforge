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
 * If the context click is on a line/polygon vertex, add "Delete line point" and optionally
 * "Cut line here" items to the context menu.
 */
export function addLineVertexMenuItems(f) {
  const feature = getFeature(f.properties.parent, 'geojson')
  // console.log("addLineVertexMenuItems", feature)
  if (feature.geometry.type === 'LineString' && (feature.geometry.coordinates.length <= 2)) { return }
  if (feature.geometry.type === 'Polygon' && (feature.geometry.coordinates[0].length <= 3)) { return }
  // coord path looks like 0.3 in polygons
  let vertexIndex = parseFloat(f.properties.coord_path, 10)
  if (feature.geometry.type === 'Polygon') { vertexIndex = vertexIndex * 10 }

  console.log("vertexIndex", f.properties.coord_path, vertexIndex)
  functions.e('#map-context-menu', el => {
    el.classList.remove('hidden')

    const deleteButton = document.createElement('div')
    deleteButton.classList.add('context-menu-item')
    deleteButton.innerText = 'Delete point'
    deleteButton.dataset.action = 'click->map--context-menu#deleteMidpoint'
    deleteButton.dataset.featureId = f.properties.parent
    deleteButton.dataset.index = vertexIndex
    el.appendChild(deleteButton)

    if (feature.geometry.type === 'LineString' &&
      vertexIndex > 0 && vertexIndex < feature.geometry.coordinates.length - 1) {
      const cutButton = document.createElement('div')
      cutButton.classList.add('context-menu-item')
      cutButton.innerText = 'Divide line here'
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
