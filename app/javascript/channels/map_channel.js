import consumer from 'channels/consumer'
import {
  upsert, destroyFeature, setBackgroundMapLayer, mapProperties,
  initializeMaplibreProperties, map, resetGeojsonData, loadGeoJsonData, reloadMapProperties
} from 'maplibre/map'
import { disableEditControls, enableEditControls } from 'maplibre/controls/edit'
import { status } from 'helpers/status'

export let mapChannel
let channelStatus

['turbo:load'].forEach(function (e) {
  window.addEventListener(e, function () {
    unload()
  })
})

function unload () {
  if (mapChannel) { mapChannel.unsubscribe(); mapChannel = null; channelStatus = undefined }
}

export function initializeSocket () {
  unload()
  channelStatus ||= 'init'

  consumer.subscriptions.create({ channel: 'MapChannel', map_id: window.gon.map_id }, {
    connected () {
      // Called when the subscription is ready for use on the server
      console.log('Connected to map_channel ' + window.gon.map_id)
      map.fire('online', { detail: { message: 'Connected to map_channel' } })
      mapChannel = this
      window.mapChannel = mapChannel
      enableEditControls()
      // only reload data when there has been a connection before, to avoid double load
      if (channelStatus === 'off') {
        reloadMapProperties().then(() => {
          initializeMaplibreProperties()
          resetGeojsonData()
          loadGeoJsonData()
          setBackgroundMapLayer(mapProperties.base_map, false)
          map.fire('load', { detail: { message: 'Map re-loaded by map_channel' } })
          status('Connection to server re-established')
        })
      } else {
        // status('Connection to server established')
      }
      channelStatus = 'on'
    },

    disconnected () {
      // Called when the subscription has been terminated by the server
      console.log('Disconnected from map_channel ' + window.gon.map_id)
      map.fire('offline', { detail: { message: 'Disconnected from map_channel' } })
      channelStatus = 'off'
      disableEditControls()
      // show error with delay to avoid showing it on unload/refresh
      setTimeout(function () { status('Connection to server lost', 'error', 'medium', 60 * 60 * 1000) }, 1000)
    },

    received (data) {
      console.log('received from map_channel: ', data)
      switch (data.event) {
        case 'update_feature':
          upsert(data.feature)
          break
        case 'delete_feature':
          destroyFeature(data.feature.id)
          break
        case 'update_map':
          window.gon.map_properties = data.map
          initializeMaplibreProperties()
          setBackgroundMapLayer()
          break
      }
    },

    send_message (action, data) {
      data.map_id = window.gon.map_id
      console.log('Sending: [' + action + '] :', data)
      // Call the original perform method
      this.perform(action, data)
    }
  })
}
