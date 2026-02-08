import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import { map, upsert, mapProperties, removeGeoJSONSource } from 'maplibre/map'
import { initLayersModal } from 'maplibre/controls/shared'
import { uploadImageToFeature, confirmImageLocation } from 'maplibre/feature'
import { status } from 'helpers/status'
import * as functions from 'helpers/functions'
import { initializeOverpassLayers } from 'maplibre/layers/overpass'
import { queries } from 'maplibre/layers/queries'
import { flyToFeature } from 'maplibre/animations'
import { layers, initializeLayerStyles, initializeLayerSources, loadLayerData, loadAllLayerData } from 'maplibre/layers/layers'
import { renderGeoJSONLayer } from 'maplibre/layers/geojson'

export default class extends Controller {
  upload () {
    const fileInput = document.getElementById('fileInput')
    const file = fileInput.files[0]
    const fileSize = (file.size / 1024).toFixed(2) // in KB

    if (fileSize > 2500 && !file.type.startsWith('image/')) {
      status('File exceeds 2.5MB. Please simplify it, for example with mapshaper.org', 'error', 'medium', 8000)
      return
    }

    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
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
            // mapforge export file, TODO: importing only the first geojson layer for now
            geoJSON = mapforgeJSON.layers.find(f => f.type === 'geojson').geojson
            mapforgeJSON.layers.filter(f => f.type !== 'geojson').forEach(layer => {
              this.createLayer(layer.type, layer.name, layer.query)
            })
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
      // redraw first geojson layer
      renderGeoJSONLayer(layers.find(l => l.type === 'geojson').id)
      mapChannel.send_message('new_feature', { ...feature })
      status('Added image')
      flyToFeature(feature)
    })
  }

  flyToLayerElement () {
    const id = this.element.getAttribute('data-feature-id')
    const layer = layers.find(l => l?.geojson?.features?.some(f => f.id === id))
    const feature = layer.geojson.features.find(f => f.id === id)
    flyToFeature(feature)
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
    // TODO: move cluster + heatmap to layer checkboxes 
    const clustered = !layer.query.includes("heatmap=true") &&
      !layer.query.includes("cluster=false") &&
      !layer.query.includes("geom") // clustering breaks lines & geometries
    layer["cluster"] = clustered
    layer["heatmap"] = layer.query.includes("heatmap=true")
    event.target.closest('.layer-item').querySelector('.layer-name').innerHTML = layer.name
    const { geojson: _geojson, ...sendLayer } = layer
    mapChannel.send_message('update_layer', sendLayer)
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    initializeOverpassLayers(layerId)
  }

  refreshLayer (event) {
    event.preventDefault()
    const layerId = event.target.closest('.layer-item').getAttribute('data-layer-id')
    functions.e('#layer-reload', e => { e.classList.add('hidden') })
    functions.e('#layer-loading', e => { e.classList.remove('hidden') })
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    loadLayerData(layerId).then( () => { 
      initLayersModal()
      functions.e('#layer-loading', e => { e.classList.add('hidden') })
      functions.e(`#layer-list-${layerId} .reload-icon`, e => { e.classList.remove('layer-refresh-animate') })
    })
  }

  async refreshLayers(event) {
    event.preventDefault()
    functions.e('#layer-reload', e => { e.classList.add('hidden') })
    functions.e('#layer-loading', e => { e.classList.remove('hidden') })
    await loadAllLayerData()
    functions.e('#layer-loading', e => { e.classList.add('hidden') })
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

  createWikipediaLayer() {
    this.createLayer('wikipedia', 'Wikipedia', '')
  }

  createSelectedOverpassLayer(event) {
    event.preventDefault()
    let queryName = event.target.dataset.queryName
    // empty query for custom
    let query = queries.find(q => q.name === queryName)?.query || ''
    let layerId = this.createLayer('overpass', queryName, query)
    // open edit form for new custom queries
    if (query === '') {
      new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        document.querySelector('#layer-list-' + layerId + ' button.layer-edit').click()
      })
    }
  }

  createLayer(type, name, query) {
    let layerId = functions.featureId()
    // must match server attribute order, for proper comparison in map_channel
    let layer = { "id": layerId, "type": type, "name": name, "heatmap": false, "cluster": true}
    if (type == 'overpass') { 
      layer["query"] = query 
      // TODO: move cluster + heatmap to layer checkboxes 
      const clustered = !layer.query.includes("heatmap=true") &&
        !layer.query.includes("cluster=false") &&
        !layer.query.includes("geom") // clustering breaks lines & geometries
      layer["cluster"] = clustered
      layer["heatmap"] = layer.query.includes("heatmap=true")
    }
    layers.push(layer)
    initializeLayerSources(layerId)
    initializeLayerStyles(layerId)
    mapChannel.send_message('new_layer', layer)
    initLayersModal()
    document.querySelector('#layer-list-' + layerId + ' .reload-icon').classList.add('layer-refresh-animate')
    return layerId
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
  }
}
