import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import { getFeature, renderLayers } from 'maplibre/layers/layers'
import { addFeature } from 'maplibre/map'
import { addUndoState } from 'maplibre/undo'

export default class extends Controller {

  deleteMidpoint(event) {
    const target = event.currentTarget
    const feature = getFeature(target.dataset.featureId, 'geojson')

    const vertexIndex = target.dataset.index
    addUndoState('Feature update', feature)
    if (feature.geometry.type === 'LineString') { feature.geometry.coordinates.splice(vertexIndex, 1) }
    if (feature.geometry.type === 'Polygon') { feature.geometry.coordinates[0].splice(vertexIndex, 1) }
    renderLayers('geojson', true)
    mapChannel.send_message('update_feature', { ...feature })
    status('Point deleted')
    hideContextMenu()
  }

  cutLine(event) {
    const target = event.currentTarget
    const feature = getFeature(target.dataset.featureId, 'geojson')

    const vertexIndex = parseInt(target.dataset.index, 10)
    const coords = feature.geometry.coordinates
    const firstCoords = coords.slice(0, vertexIndex + 1)
    const secondCoords = coords.slice(vertexIndex)

    // Keep original feature, shorten it to the first segment
    addUndoState('Feature update', feature)
    feature.geometry.coordinates = firstCoords
    renderLayers('geojson', true)
    mapChannel.send_message('update_feature', { ...feature })

    const secondFeature = {
      type: 'Feature',
      id: functions.featureId(),
      geometry: { type: 'LineString', coordinates: secondCoords },
      properties: JSON.parse(JSON.stringify(feature.properties || {}))
    }
    addUndoState('Feature added', secondFeature)
    addFeature(secondFeature)
    mapChannel.send_message('new_feature', secondFeature)

    status('Line cut into 2 segments')
    hideContextMenu()
  }

  // Reverse the direction of a LineString or route
  // For routes, this also reverses waypoints and updates route extras indices
  reverseLineString(event) {
    const target = event.currentTarget
    const feature = getFeature(target.dataset.featureId, 'geojson')

    if (feature.geometry.type !== 'LineString') { return }
    addUndoState('Feature update', feature)

    // Reverse coordinates
    feature.geometry.coordinates.reverse()

    // Reverse route waypoints if they exist
    if (feature.properties.route?.waypoints) {
      feature.properties.route.waypoints.reverse()
    }

    // Update route extras indices if they exist (e.g., steepness, surface, green, noise)
    // Extras are stored as [startIdx, endIdx, value] arrays that reference coordinate indices
    if (feature.properties.route?.extras) {
      const coordsLength = feature.geometry.coordinates.length
      Object.keys(feature.properties.route.extras).forEach(extrasType => {
        const extrasData = feature.properties.route.extras[extrasType]
        if (extrasData?.values) {
          // Reverse the values array and transform indices to match reversed coordinates
          extrasData.values = extrasData.values.map(([startIdx, endIdx, value]) => {
            const newStartIdx = coordsLength - 1 - endIdx
            const newEndIdx = coordsLength - 1 - startIdx
            return [newStartIdx, newEndIdx, value]
          }).reverse()
        }
      })
    }

    renderLayers('geojson', true)
    mapChannel.send_message('update_feature', { ...feature })
    status('Track reversed')
    hideContextMenu()
  }

  addToGeojsonLayer(event) {
    const target = event.currentTarget
    const layerType = target.dataset.layerType || 'basemap'
    const feature = getFeature(target.dataset.featureId, layerType)
    if (!feature) {
      console.error('Feature not found:', target.dataset.featureId, layerType)
      hideContextMenu()
      return
    }
    addFeature(feature)
    addUndoState('Feature added', feature)
    mapChannel.send_message('new_feature', feature)
    hideContextMenu()
  }
}