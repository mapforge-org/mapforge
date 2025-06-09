import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { map, layers, upsert, mapProperties } from 'maplibre/map'
import { initLayersModal, resetControls } from 'maplibre/controls/shared'
import { highlightFeature } from 'maplibre/feature'
import { draw } from 'maplibre/edit'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import { loadOverpassLayer } from 'maplibre/overpass/overpass'

export default class extends Controller {
  upload () {
    const fileInput = document.getElementById('fileInput')
    const file = fileInput.files[0]
    const fileSize = (file.size / 1024).toFixed(2)

    if (fileSize > 800) {
      status('File exceeds 800Kb', 'error')
      return
    }

    if (file) {
      const reader = new FileReader()
      reader.onload = function (event) {
        const content = event.target.result
        const parser = new DOMParser()
        let geoJSON

        // https://github.com/mapbox/togeojson?tab=readme-ov-file#api
        if (file.type === 'application/gpx+xml') {
          const xmlDoc = parser.parseFromString(content, 'application/xml')
          geoJSON = window.toGeoJSON.gpx(xmlDoc)
        } else if (file.type === 'application/vnd.google-earth.kml+xml') {
          const xmlDoc = parser.parseFromString(content, 'application/xml')
          geoJSON = window.toGeoJSON.kml(xmlDoc)
        } else if (file.type === 'application/geo+json') {
          geoJSON = JSON.parse(content)
        } else if (file.type === 'application/json') {
          // geojson export file
          const mapforgeJSON = JSON.parse(content)
          if (mapforgeJSON.properties) {
            const props = mapforgeJSON.properties
            mapProperties.base_map = props.base_map
            mapProperties.center = props.center
            mapProperties.zoom = props.zoom
            mapProperties.pitch = props.pitch
            mapProperties.bearing = props.bearing
            mapProperties.name = props.name
            mapChannel.send_message('update_map', mapProperties)
          }
          if (mapforgeJSON.layers) {
            // mapforge export file, importing only the first geojson layer for now
            geoJSON = mapforgeJSON.layers.find(f => f.type === 'geojson').geojson
          }
        }

        let i = 1
        geoJSON.features.forEach(feature => {
          feature.id = functions.featureId()
          feature.properties ||= {}
          upsert(feature)
          mapChannel.send_message('new_feature', feature)
          status('Added feature ' + i++ + '/' + geoJSON.features.length)
        })

        status('File imported')
        initLayersModal()
      }

      if (file.type === 'application/gpx+xml' ||
        file.type === 'application/vnd.google-earth.kml+xml' ||
        file.type === 'application/geo+json' ||
        file.type === 'application/json') {
        reader.readAsText(file)
      } else {
        console.log('Unsupported file type: ' + file.type)
      }
    }
  }

  flyto () {
    const id = this.element.getAttribute('data-feature-id')
    this.element.getAttribute('data-feature-id')
    const layer = layers.find(l => l.geojson.features.some(f => f.id === id))
    const feature = layer.geojson.features.find(f => f.id === id)
    const source = layer.type === 'geojson' ? 'geojson-source' : 'overpass-source'

    // Calculate the centroid
    const centroid = window.turf.centroid(feature)
    console.log('Fly to: ' + feature.id + ' ' + centroid.geometry.coordinates)
    resetControls()
    map.once('moveend', function () {
      if (draw && layer.type === 'geojson') {
        map.fire('draw.selectionchange', { features: [feature]})
      } else {
        highlightFeature(feature, true, source)
      }
    })
    map.flyTo({
      center: centroid.geometry.coordinates,
      duration: 1000,
      curve: 0.3,
      essential: true
    })
  }

  close () {
    resetControls()
  }

  toggleEdit (event) {
    event.preventDefault()

    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    const contentElement = layerElement.querySelector('.layer-content')
    if (contentElement.classList.contains('hidden')) { this.toggleLayerList(event) }
    contentElement.querySelector('.overpass-edit').classList.toggle('hidden')
    contentElement.querySelector('.overpass-query').value = layer.query
  }

  update (event) {
    event.preventDefault()
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    layer.query = layerElement.querySelector('.overpass-query').value
    const { geojson: _geojson, ...sendLayer } = layer
    mapChannel.send_message('update_layer', sendLayer)
    this.refreshOverpassLayer(event)
  }

  refreshOverpassLayer (event) {
    event.preventDefault()
    const layerId = event.target.closest('.layer-item').getAttribute('data-layer-id')
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    loadOverpassLayer(layerId).then( () => { initLayersModal() })
  }

  toggleLayerList (event) {
    event.preventDefault()
    const list = event.target.closest('div').querySelector('.layer-content')
    const icon = event.target.closest('h4').querySelector('span i')
    if (list.classList.contains('hidden')) {
      icon.classList.remove('bi-caret-right-fill')
      icon.classList.add('bi-caret-down-fill')
    } else {
      icon.classList.add('bi-caret-right-fill')
      icon.classList.remove('bi-caret-down-fill')
    }
    list.classList.toggle('hidden')
  }
}
