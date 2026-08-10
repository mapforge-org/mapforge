import * as functions from 'helpers/functions'
import { getFeature } from 'maplibre/layers/layers'

export function initContextMenu(e) {
  functions.e('#map-context-menu', el => {
    el.innerHTML = ''
    el.classList.add('hidden')
    // Position the context menu
    el.style.left = `${e.point.x}px`
    el.style.top = `${e.point.y}px`
  })
}

export function hideContextMenu() {
  functions.e('#map-context-menu', menu => {
    menu.innerHTML = ''
    menu.classList.add('hidden')
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

  // console.log("vertexIndex", f.properties.coord_path, vertexIndex)
  functions.e('#map-context-menu', el => {
    el.classList.remove('hidden')

    const deleteButton = document.createElement('div')
    deleteButton.classList.add('context-menu-item')
    deleteButton.innerHTML = `<i class="bi bi-dash-circle me-1"></i>${window.__('Delete midpoint')}`
    deleteButton.dataset.action = 'click->map--context-menu#deleteMidpoint'
    deleteButton.dataset.featureId = f.properties.parent
    deleteButton.dataset.index = vertexIndex
    el.appendChild(deleteButton)

    if (feature.geometry.type === 'LineString' &&
      vertexIndex > 0 && vertexIndex < feature.geometry.coordinates.length - 1) {
      const cutButton = document.createElement('div')
      cutButton.classList.add('context-menu-item')
      cutButton.innerHTML = `<i class="bi bi-scissors me-1"></i>${window.__('Divide line here')}`
      cutButton.dataset.action = 'click->map--context-menu#cutLine'
      cutButton.dataset.featureId = f.properties.parent
      cutButton.dataset.index = vertexIndex
      el.appendChild(cutButton)
    }
  })
}

/**
 * If the context click is on a line, add 'Reverse track' option
 */
export function addLineMenuItems(f) {
  console.log(f)
  functions.e('#map-context-menu', el => {
    el.classList.remove('hidden')

    const reverseButton = document.createElement('div')
    reverseButton.classList.add('context-menu-item')
    reverseButton.innerHTML = `<i class="bi bi-arrow-left-right me-1"></i>${window.__('Reverse track')}`
    reverseButton.dataset.action = 'click->map--context-menu#reverseLineString'
    reverseButton.dataset.featureId = f.properties.id
    el.appendChild(reverseButton)
  })
}

/**
 * Add 'Copy' option for any geojson feature
 */
export function addCopyMenuItem(featureId, geometryType = null) {
  functions.e('#map-context-menu', el => {
    el.classList.remove('hidden')

    const copyButton = document.createElement('div')
    copyButton.classList.add('context-menu-item')
    copyButton.innerHTML = `<i class="bi bi-clipboard me-1"></i>${geometryType ? window.__('Copy %{type}').replace('%{type}', geometryType) : window.__('Copy')}`
    copyButton.dataset.action = 'click->map--context-menu#copyFeature'
    copyButton.dataset.featureId = featureId
    el.appendChild(copyButton)
  })
}

/**
 * Add 'Copy to my layer' option for a feature of a non-geojson layer.
 * Takes the feature, not an id: every caller already holds it, and an id plus a layer type
 * would force the controller to look the same feature up a second time. That lookup cannot
 * reach layers outside the 'layers' array, like the search results.
 */
export function addCopyToLayerMenuItem(feature) {
  if (!feature || window.gon.map_mode !== 'rw') { return }
  functions.e('#map-context-menu', el => {
    if (el.querySelector('[data-action*="addToGeojsonLayer"]')) { return }
    el.classList.remove('hidden')

    const copyButton = document.createElement('div')
    copyButton.classList.add('context-menu-item')
    copyButton.innerHTML = `<i class="bi bi-copy me-1"></i>${window.__('Copy to my layer')}`
    copyButton.dataset.action = 'click->map--context-menu#addToGeojsonLayer'
    copyButton.mapFeature = feature
    el.appendChild(copyButton)
  })
}

/**
 * Add 'Delete' option for any geojson feature
 */
export function addDeleteMenuItem(featureId) {
  functions.e('#map-context-menu', el => {
    el.classList.remove('hidden')

    const deleteButton = document.createElement('div')
    deleteButton.classList.add('context-menu-item')
    deleteButton.innerHTML = `<i class="bi bi-trash me-1"></i>${window.__('Delete')}`
    deleteButton.dataset.action = 'click->map--context-menu#deleteFeature'
    deleteButton.dataset.featureId = featureId
    el.appendChild(deleteButton)
  })
}
