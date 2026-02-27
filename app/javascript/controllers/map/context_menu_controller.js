import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import { getFeature } from 'maplibre/layers/layers'
import { addFeature } from 'maplibre/map'
import { addUndoState } from 'maplibre/undo'
import { renderGeoJSONLayers } from 'maplibre/layers/geojson'

export default class extends Controller {

  deleteMidpoint(event) {
    const target = event.currentTarget
    const feature = getFeature(target.dataset.featureId, 'geojson')

    const vertexIndex = target.dataset.index
    addUndoState('Feature update', feature)
    feature.geometry.coordinates.splice(vertexIndex, 1)
    renderGeoJSONLayers(true)
    mapChannel.send_message('update_feature', { ...feature })
    status('Midpoint deleted')
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
    renderGeoJSONLayers(true)
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
}