import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { map, layers, upsert, mapProperties, redrawGeojson, removeGeoJSONSource } from 'maplibre/map'
import { initLayersModal, resetControls } from 'maplibre/controls/shared'
import { highlightFeature, uploadImageToFeature, confirmImageLocation } from 'maplibre/feature'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import { loadOverpassLayer, initializeOverpassLayers } from 'maplibre/overpass/overpass'
import { queries } from 'maplibre/overpass/queries'
import { centroid } from "@turf/centroid"

export default class extends Controller {
  upload () {
    const fileInput = document.getElementById('fileInput')
    const file = fileInput.files[0]
    const fileSize = (file.size / 1024).toFixed(2)

    if (fileSize > 1600 && !file.type.startsWith('image/')) {
      status('File exceeds 1.5MB, please consider simplifying it', 'error', 'medium', 8000)
      return
    }

    if (file) {
      const reader = new FileReader()
      reader.onload = function (event) {
        const content = event.target.result
        const parser = new DOMParser()
        let geoJSON

        // https://github.com/mapbox/togeojson?tab=readme-ov-file#api
        // console.log('Reading from file type ' + file.type)
        if (file.type === 'application/gpx+xml') {
          const xmlDoc = parser.parseFromString(content, 'application/xml')
          geoJSON = window.toGeoJSON.gpx(xmlDoc)
        } else if (file.type === 'application/vnd.google-earth.kml+xml') {
          const xmlDoc = parser.parseFromString(content, 'application/xml')
          geoJSON = window.toGeoJSON.kml(xmlDoc)
        } else if (file.type === 'application/geo+json') {
          geoJSON = JSON.parse(content)
        } else if (file.type === 'application/json') {
          // mapforge export file
          const mapforgeJSON = JSON.parse(content)
          if (mapforgeJSON.layers) {
            // mapforge export file, importing only the first geojson layer for now
            geoJSON = mapforgeJSON.layers.find(f => f.type === 'geojson').geojson
          } else {
            // standard geojson file
            geoJSON = mapforgeJSON
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

        if (file.type === 'application/json') {
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
        }

        status('File imported')
        initLayersModal()
      }

      if (file.type === 'application/gpx+xml' ||
        file.type === 'application/vnd.google-earth.kml+xml' ||
        file.type === 'application/geo+json' ||
        file.type === 'application/json') {
        reader.readAsText(file)
      } else if (file.type.startsWith('image/')) {
        this.addImageMarker(file)
      } else {
        console.log('Unsupported file type: ' + file.type)
      }
    }
  }

  async addImageMarker(file) {
    document.getElementById('layers-modal').classList.remove('show')
    const imageLocation = (await confirmImageLocation(file)) || [map.getCenter().lng, map.getCenter().lat]

    let feature = {
      "id": functions.featureId(),
      "type": "Feature",
      "geometry": {
        "coordinates": imageLocation,
        "type": "Point"
      }
    }
    
    uploadImageToFeature(file, feature).then( () => {
      upsert(feature)
      redrawGeojson(false)
      mapChannel.send_message('new_feature', { ...feature })
      status('Added image')
      this.flyToFeature(feature)
      initLayersModal()
    })
  }

  flyToLayerElement () {
    const id = this.element.getAttribute('data-feature-id')
    const source = this.element.getAttribute('data-feature-source')
    const layer = layers.find(l => l?.geojson?.features?.some(f => f.id === id))
    const feature = layer.geojson.features.find(f => f.id === id)
    this.flyToFeature(feature, source)
  }

  flyToFeature(feature, source='geojson-source') {
    // Calculate the centroid
    const center = centroid(feature)
    console.log('Fly to: ' + feature.id + ' ' + center.geometry.coordinates)
    resetControls()
    map.once('moveend', function () {
      highlightFeature(feature, true, source)
    })
    map.flyTo({
      center: center.geometry.coordinates,
      duration: 1000,
      curve: 0.3,
      essential: true
    })
  }

  toggleEdit (event) {
    event.preventDefault()
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    const contentElement = layerElement.querySelector('.layer-content')
    if (contentElement.classList.contains('hidden')) { this.toggleLayerList(event) }
    contentElement.querySelector('.overpass-edit').classList.toggle('hidden')
    const queryTextarea = contentElement.querySelector('.overpass-query')
    queryTextarea.value = layer.query
    contentElement.querySelector('.overpass-name').value = layer.name
    this.resizeQueryField({ target: queryTextarea })
  }

  resizeQueryField (event) {
    const queryTextarea = event.target
    queryTextarea.style.height = 'auto' // Reset height
    queryTextarea.style.height = queryTextarea.scrollHeight + 'px' // Set to content height    
  }

  updateOverpassLayer (event) {
    event.preventDefault()
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    layer.query = layerElement.querySelector('.overpass-query').value
    layer.name = layerElement.querySelector('.overpass-name').value
    event.target.closest('.layer-item').querySelector('.layer-name').innerHTML = layer.name
    const { geojson: _geojson, ...sendLayer } = layer
    mapChannel.send_message('update_layer', sendLayer)
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    initializeOverpassLayers(layerId)
  }

  refreshOverpassLayer (event) {
    event.preventDefault()
    const layerId = event.target.closest('.layer-item').getAttribute('data-layer-id')
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    loadOverpassLayer(layerId).then( () => { initLayersModal() })
  }

  refreshOverpassLayers(event) {
    event.preventDefault()
    initializeOverpassLayers()
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

  createOverpassLayer (event) {
    event.preventDefault()
    let layerId = functions.featureId()
    let queryName = event.target.dataset.queryName
    // empty query for custom
    let query = queries.find(q => q.name === queryName)?.query || ''
    let layer = { "id": layerId, "type":"overpass", "name": queryName, "query": query }
    layers.push(layer)
    mapChannel.send_message('new_layer', layer)
    initLayersModal()
    document.querySelector('#layer-list-' + layerId + ' .reload-icon').classList.add('layer-refresh-animate')
    initializeOverpassLayers(layerId)
    // open edit form for new custom queries
    if (query === '') { 
      new Promise(resolve => setTimeout(resolve, 50)).then(() => { 
        document.querySelector('#layer-list-' + layerId + ' button.layer-edit').click() }) 
      }
  }

  deleteOverpassLayer (event) {
    event.preventDefault()
    if (!confirm('Really delete this layer?')) { return }
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    const { geojson: _geojson, ...sendLayer } = layer
    layers.splice(layers.indexOf(layer), 1)
    removeGeoJSONSource('overpass-source-' + layerId)
    mapChannel.send_message('delete_layer', sendLayer)
    initLayersModal()
    redrawGeojson()
  }

}
