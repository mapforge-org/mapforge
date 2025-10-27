import consumer from 'channels/consumer'
import {
  upsert, destroyFeature, setBackgroundMapLayer, mapProperties,
  initializeMaplibreProperties, map, resetGeojsonLayers, loadLayers, reloadMapProperties
} from 'maplibre/map'

export let mapChannel
let channelStatus
let connectionUUID
let remoteCursors = new Set();

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
      if (data.uuid && data.uuid === connectionUUID) {
        // console.log(`ignore message from self ('${data.uuid}')`)
        return
      }
      if (!data.event.startsWith('mouse')) console.log('received from map_channel: ', data)
      switch (data.event) {
        case 'connection':
          connectionUUID = data.uuid
          break
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
        case 'mouse':
          let cursor = remoteCursors[data.uuid]
          if (cursor) {
            cursor.setLngLat([data.lng, data.lat])
          } else {
            cursor = document.getElementById("remote-cursor-template").cloneNode(true)
            cursor.classList.remove("hidden")
            cursor.id = data.uid
            if (data.user_image) {
              const img = document.createElement("img")
              img.src = data.user_image
              img.className = "profile-image remote-cursor-image"
              img.crossOrigin = "anonymous"
              cursor.appendChild(img)
            }
            remoteCursors[data.uuid] = new maplibregl.Marker({ element: cursor })
              .setLngLat([data.lng, data.lat]).addTo(map)
          }
          break
        case 'mouse_disconnect':
          // console.log('disconnect cursor ' + data.uuid)
          remoteCursors[data.uuid]?.remove()
          delete remoteCursors[data.uuid]
      }
    },

    send_message (event, data) {
      // copy feature to avoid mutation
      const payload = JSON.parse(JSON.stringify(data))
      payload.map_id = window.gon.map_id
      payload.user_id = window.gon.user_id
      payload.uuid = connectionUUID
      // dropping properties.id from redrawGeojson() before sending to server
      if (payload.properties && payload.properties.id) { delete payload.properties.id }
      if (event !== 'mouse') console.log('Sending: [' + event + '] :', payload)
      // Call the original perform method
      this.perform(event, payload)
    }
  })
}
