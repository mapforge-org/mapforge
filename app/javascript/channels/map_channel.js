import consumer from 'channels/consumer'
import {
  upsert, destroyFeature, setBackgroundMapLayer, mapProperties,
  initializeMaplibreProperties, map, resetGeojsonLayers, loadLayers, reloadMapProperties
} from 'maplibre/map'

export let mapChannel
let channelStatus

['turbo:before-visit'].forEach(function (e) {
  window.addEventListener(e, function () {
    unload()
  })
})

function unload () {
  if (mapChannel) {
    console.log('Unsubscribing from map_channel', mapChannel.identifier)
    mapChannel.unsubscribe(); mapChannel = null; channelStatus = undefined
  }
  map.fire('offline')
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
      // only reload data when there has been a connection before, to avoid double load
      if (channelStatus === 'off') {
        reloadMapProperties().then(() => {
          initializeMaplibreProperties()
          resetGeojsonLayers()
          loadLayers()
          setBackgroundMapLayer(mapProperties.base_map, false)
          map.fire('load', { detail: { message: 'Map re-loaded by map_channel' } })
          // status('Connection to server re-established')
        })
      } else {
        // status('Connection to server established')
      }
      consumer.connection.webSocket.onerror = function (_event) {
        map.fire('offline', { detail: { message: 'Websocket error' } })
        channelStatus = 'off'
      }
      channelStatus = 'on'
    },

    disconnected () {
      // Called when the subscription has been terminated by the server
      console.warn('Disconnected from map_channel ' + window.gon.map_id)
      map.fire('offline', { detail: { message: 'Disconnected from map_channel' } })
      channelStatus = 'off'
      // show error with delay to avoid showing it on unload/refresh
      // setTimeout(function () { status('Connection to server lost', 'error', 'medium', 60 * 60 * 1000) }, 2000)
    },
    rejected() {
      // Called when subscription is rejected by the server
      console.warn('Rejected from map_channel ' + window.gon.map_id)
      map.fire('offline', { detail: { message: 'Rejected from map_channel' } })
      channelStatus = 'off'
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
          // update background if properties changed
          if (initializeMaplibreProperties()) {
            setBackgroundMapLayer()
          }
          break
      }
    },

    send_message (action, feature) {
      // copy feature to avoid mutation
      const data = JSON.parse(JSON.stringify(feature))
      data.map_id = window.gon.map_id
      // dropping properties.id from redrawGeojson() before sending to server
      if (data.properties && data.properties.id) { delete data.properties.id }
      console.log('Sending: [' + action + '] :', data)
      // Call the original perform method
      this.perform(action, data)
    }
  })
}
