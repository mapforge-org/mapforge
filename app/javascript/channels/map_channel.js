import consumer from 'channels/consumer'
import { createLayerInstance } from 'maplibre/layers/factory'
import { initializeLayerSources, initializeLayerStyles, layers, loadLayerDefinitions, resetLayerInitialization } from 'maplibre/layers/layers'
import {
  destroyFeature,
  initializeMaplibreProperties,
  loadedMapUpdatedAt,
  map,
  mapProperties,
  reloadMapProperties,
  setBackgroundMapLayer,
  setLayerVisibility,
  setLoadedMapUpdatedAt,
  updateMapName,
  upsert
} from 'maplibre/map'


export let mapChannel
let channelStatus
let reloadInProgress = false
let connectionUUID
let remoteCursors = {};

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
      mapChannel = this
      window.mapChannel = mapChannel
      // On reconnect (channelStatus === 'off'), defer the 'online' event
      if (channelStatus === 'off') {
        // Rebuild layers directly (rather than initializeLayers()) to force a refetch and handle
        // a possible basemap change; reset the memoization so a later initializeLayers() re-runs.
        resetLayerInitialization()
        reloadMapProperties().then(() => {
          const propsChanged = initializeMaplibreProperties()
          // Only reload layer data if the map actually changed while we were disconnected.
          // The full reload re-fetches + re-parses the entire map and blocks the main
          // thread, which is what turned a single stale-connection disconnect into an
          // endless disconnect/reload loop on large maps. reloadMapProperties() already
          // refreshed window.gon.map_updated_at from the lightweight /properties endpoint.
          const dataChanged = window.gon.map_updated_at !== loadedMapUpdatedAt
          if (dataChanged && !reloadInProgress) {
            reloadInProgress = true
            // refetch: true forces a fresh pull from the server (bypassing the gon-embedded
            // summaries used on initial load) so we pick up whatever changed while offline.
            loadLayerDefinitions({ refetch: true }).then(async () => {
              // If basemap actually changed, setBackgroundMapLayer() will trigger
              // initializeStyles() via style.load (which re-initializes layer sources/styles).
              // If not, we re-initialize them directly to catch up on any missed updates.
              if (!setBackgroundMapLayer()) {
                initializeLayerSources()
                await initializeLayerStyles()
              }
              map.fire('load', { detail: { message: 'Map re-loaded by map_channel' } })
              map.fire('online', { detail: { message: 'Reconnected to map_channel' } })
            }).catch(error => {
              console.error('Failed to reload map on reconnect:', error)
            }).finally(() => { reloadInProgress = false })
          } else {
            // Nothing changed (or a reload is already running): the map already holds the
            // current data, so skip the heavy reload. Still apply a basemap-only change.
            console.log('Channel reconnect: no data change, no layer reload needed')
            if (propsChanged) { setBackgroundMapLayer() }
            map.fire('online', { detail: { message: 'Reconnected to map_channel' } })
          }
        })
      } else {
        map.fire('online', { detail: { message: 'Connected to map_channel' } })
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
      // Advance the loaded-map version for every applied change — including our own
      // echoed edits, captured here before the self-ignore return below. This keeps
      // loadedMapUpdatedAt current so a later reconnect only does the heavy reload when
      // something changed while we were disconnected. (mouse/connection carry no map_updated_at.)
      if (data.map_updated_at) { setLoadedMapUpdatedAt(data.map_updated_at) }

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
          // update map name if changed
          if (data.map.name) {
            updateMapName(data.map.name)
          }
          // update background if properties changed
          if (initializeMaplibreProperties()) {
            setBackgroundMapLayer()
          }
          break
        case 'update_layer':
          const index = layers.findIndex(l => l.id === data.layer.id)
          if (index > -1) {
            const layerDef = layers[index].toJSON()
            if (JSON.stringify(layerDef) !== JSON.stringify(data.layer)) {
              console.log('Layer updated on server, reloading layer styles', data.layer)
              layers[index].update(data.layer)
              layers[index].applyFeatureOrder(data.layer.feature_order)
              initializeLayerStyles(data.layer.id)
              setLayerVisibility(layers[index].sourceId, data.layer.show !== false)
            }
          } else {
            const newLayer = createLayerInstance(data.layer)
            layers.push(newLayer)
            initializeLayerSources(data.layer.id)
            initializeLayerStyles(data.layer.id)
          }
          break
        case 'delete_layer':
          const delIndex = layers.findIndex(l => l.id === data.layer.id)
          if (delIndex > -1) {
            layers[delIndex].cleanup()
            layers.splice(delIndex, 1)
            // trigger a full map redraw
            setBackgroundMapLayer(mapProperties.base_map, true)
          }
          break
        case 'mouse':
          let cursor = remoteCursors[data.uuid]
          if (cursor) {
            cursor.setLngLat([data.lng, data.lat])
          } else {
            cursor = document.getElementById("remote-cursor-template").cloneNode(true)
            cursor.classList.remove("hidden")
            cursor.id = data.uuid
            if (data.user_image) {
              const img = document.createElement("img")
              img.src = data.user_image
              img.referrerPolicy = "no-referrer"
              img.className = "profile-image remote-cursor-image"
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
      // dropping properties.id before sending to server
      if (payload.properties && payload.properties.id) { delete payload.properties.id }
      if (event !== 'mouse') console.log('Sending: [' + event + '] :', payload)
      // Call the original perform method
      this.perform(event, payload)
    }
  })
}
