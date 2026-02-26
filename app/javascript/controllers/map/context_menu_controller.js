import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import { hideContextMenu } from 'maplibre/controls/context_menu'
import { renderGeoJSONLayers } from 'maplibre/layers/geojson'
import { getFeature } from 'maplibre/layers/layers'
import { addUndoState } from 'maplibre/undo'

export default class extends Controller {

  deleteMidpoint(event) {
    const target = event.currentTarget
    const feature = getFeature(target.dataset.featureId, 'geojson')

    const vertexIndex = target.dataset.index
    const coords = feature.geometry.coordinates.slice()

    addUndoState('LineString point delete', feature)
    coords.splice(vertexIndex, 1)
    feature.geometry = { ...feature.geometry, coordinates: coords }

    renderGeoJSONLayers(true)
    mapChannel.send_message('update_feature', { ...feature })
    status('Midpoint deleted')

    hideContextMenu()
  }
}