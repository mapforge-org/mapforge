import { Controller } from '@hotwired/stimulus'
import { mapChannel } from 'channels/map_channel'
import * as dom from 'helpers/dom'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { flyToFeature } from 'maplibre/animations'
import { initLayersModal } from 'maplibre/controls/shared'
import { confirmImageLocation, uploadImageToFeature } from 'maplibre/feature'
import { createLayerInstance } from 'maplibre/layers/factory'
import { initializeLayerSources, initializeLayerStyles, layers, loadAllLayerData, loadLayerData, renderLayer } from 'maplibre/layers/layers'
import { queries } from 'maplibre/layers/queries'
import { map, mapProperties, removeGeoJSONSource, setLayerVisibility, updateMapName, upsert } from 'maplibre/map'
import { addUndoState } from 'maplibre/undo'
import toGeoJSON from 'togeojson'

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
          geoJSON = toGeoJSON.gpx(xmlDoc)
        } else if (file.type === 'application/vnd.google-earth.kml+xml') {
          const xmlDoc = parser.parseFromString(content, 'application/xml')
          geoJSON = toGeoJSON.kml(xmlDoc)
        } else if (file.type === 'application/geo+json') {
          geoJSON = JSON.parse(content)
        } else if (file.type === 'application/json') {
          const mapforgeJSON = JSON.parse(content)
          if (mapforgeJSON.layers) {
            // mapforge export file
            mapforgeJSON.layers.forEach(layer => {
              // reset feature ids
              if (layer.geojson?.features) {
                layer.geojson.features.forEach(f => { f.id = functions.featureId() })
              }
              this.createLayer(layer.type, layer.name, layer.query, layer.geojson)
            })
          } else {
            // standard geojson file
            geoJSON = mapforgeJSON
          }
        }

        let i = 1
        geoJSON?.features?.forEach(feature => {
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
            updateMapName(props.name)
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
      renderLayer(layers.find(l => l.type === 'geojson').id)
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
    addUndoState('Layer updated', { ...layer.toJSON(), geojson: layer.geojson })

    layer.query = layerElement.querySelector('.overpass-query').value
    layer.name = layerElement.querySelector('.overpass-name').value
    // TODO: move cluster + heatmap to layer checkboxes
    const clustered = !layer.query.includes("heatmap=true") &&
      !layer.query.includes("cluster=false") &&
      !layer.query.includes("geom") // clustering breaks lines & geometries
    layer["cluster"] = clustered
    layer["heatmap"] = layer.query.includes("heatmap=true")
    event.target.closest('.layer-item').querySelector('.layer-name').innerHTML = layer.name
    mapChannel.send_message('update_layer', layer.toJSON())
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    layer.initialize().then(() => { initLayersModal() })
  }

  refreshLayer (event) {
    event.preventDefault()
    const layerId = event.target.closest('.layer-item').getAttribute('data-layer-id')
    functions.e('#layer-reload', e => { e.classList.add('hidden') })
    functions.e('#layer-loading', e => { e.classList.remove('hidden') })
    loadLayerData(layerId).then( () => {
      initLayersModal()
      functions.e('#layer-loading', e => { e.classList.add('hidden') })
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
    const list = event.target.closest('.layer-item').querySelector('.layer-content')
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

  toggleLayerVisibility (event) {
    event.preventDefault()
    dom.initTooltips()
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(l => l.id === layerId)
    const wasVisible = layer.show !== false
    if (window.gon.map_mode === "rw") { addUndoState('Layer updated', { ...layer.toJSON(), geojson: layer.geojson }) }

    layer.show = !wasVisible
    setLayerVisibility(layer.sourceId, layer.show)

    // update UI (both desktop and mobile visibility buttons)
    layerElement.querySelectorAll('button.layer-visibility i, button.layer-visibility-mobile i').forEach(icon => {
      if (layer.show) {
        icon.classList.replace('bi-eye', 'bi-eye-slash')
      } else {
        icon.classList.replace('bi-eye-slash', 'bi-eye')
      }
    })
    const visBtn = layerElement.querySelector('button.layer-visibility')
    const visBtnMobile = layerElement.querySelector('button.layer-visibility-mobile')
    const newText = layer.show ? 'Hide layer' : 'Show layer'
    visBtn.setAttribute('title', newText)
    visBtnMobile.querySelector('.layer-visibility-text').textContent = newText
    // show/hide refresh and edit buttons based on visibility
    const hideAction = layer.show ? 'remove' : 'add'
    if (layer.type !== 'geojson') {
      layerElement.querySelectorAll('button.layer-refresh, button.layer-refresh-mobile').forEach(btn => btn.classList[hideAction]('hidden'))
    }
    if (layer.type === 'overpass' && window.gon.map_mode === 'rw') {
      layerElement.querySelectorAll('button.layer-edit, button.layer-edit-mobile').forEach(btn => btn.classList[hideAction]('hidden'))
    }
    if (layer.show) {
      layerElement.classList.remove('layer-dimmed')
    } else {
      layerElement.classList.add('layer-dimmed')
    }

    // when showing: initialize styles (and load data for overpass/wikipedia if needed)
    if (layer.show) { initializeLayerStyles(layerId) }
    // sync to server only in rw mode
    if (window.gon.map_mode === "rw") { mapChannel.send_message('update_layer', layer.toJSON()) }
  }

  createWikipediaLayer() {
    this.createLayer('wikipedia', 'Wikipedia')
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

  createBaseMapLayer(_event) {
    this.createLayer('basemap', 'Basemap layer')
  }

  createLayer(type, name, query=null, geojson=null) {
    let layerId = functions.featureId()
    // must match server attribute order, for proper comparison in map_channel
    let layerData = { "id": layerId, "type": type, "name": name,
      "heatmap": false, "cluster": false, "show": true, "geojson": geojson}
    if (type == 'overpass') {
      layerData["query"] = query
      // TODO: move cluster + heatmap to layer checkboxes
      const clustered = !layerData.query.includes("heatmap=true") &&
        !layerData.query.includes("cluster=false") &&
        !layerData.query.includes("geom") // clustering breaks lines & geometries
      layerData["cluster"] = clustered
      layerData["heatmap"] = layerData.query.includes("heatmap=true")
    }
    let layer = createLayerInstance(layerData)
    layers.push(layer)

    addUndoState('Layer added', layerData)
    initLayersModal()
    initializeLayerSources(layerId)
    initializeLayerStyles(layerId)
    mapChannel.send_message('new_layer', layerData)
    return layerId
  }

  deleteLayer (event) {
    event.preventDefault()
    if (!confirm('Really delete this layer?')) { return }
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)

    addUndoState('Layer deleted', { ...layer.toJSON(), geojson: layer.geojson })
    layer.cleanup()
    layers.splice(layers.indexOf(layer), 1)
    removeGeoJSONSource(layer.sourceId)
    mapChannel.send_message('delete_layer', layer.toJSON())
    initLayersModal()
  }
}
