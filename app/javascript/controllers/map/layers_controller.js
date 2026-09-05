import { Controller } from '@hotwired/stimulus'
import { centroid } from '@turf/centroid'
import { sendMessage } from 'channels/map_channel'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { flyToFeature } from 'maplibre/animations'
import { initLayersModal } from 'maplibre/controls/shared'
import { updateElevation } from 'maplibre/edit'
import { confirmImageLocation, uploadImageToFeature } from 'maplibre/feature'
import { importFile } from 'maplibre/import/kml'
import { createLayerInstance } from 'maplibre/layers/factory'
import { initializeLayerSources, initializeLayerStyles, layers, loadAllLayerData, loadLayerData, renderLayer } from 'maplibre/layers/layers'
import { queries } from 'maplibre/layers/overpass/queries'
import { map, mapProperties, removeGeoJSONSource, setLayerVisibility, updateMapName, upsert } from 'maplibre/map'
import { addUndoState } from 'maplibre/undo'

// Browsers report an empty file.type for these when the platform mime database
// does not know them, so the extension decides as well.
function fileFormat (file) {
  const name = file.name.toLowerCase()
  if (file.type === 'application/gpx+xml' || name.endsWith('.gpx')) { return 'xml' }
  if (file.type === 'application/vnd.google-earth.kml+xml' || name.endsWith('.kml')) { return 'xml' }
  if (file.type === 'application/vnd.google-earth.kmz' || name.endsWith('.kmz')) { return 'kmz' }
  if (file.type === 'application/geo+json' || name.endsWith('.geojson')) { return 'geojson' }
  if (file.type === 'application/json' || name.endsWith('.json')) { return 'json' }
  if (file.type.startsWith('image/')) { return 'image' }
  return null
}

function readFile (file, format) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target.result)
    reader.onerror = () => reject(reader.error)
    if (format === 'kmz') { reader.readAsArrayBuffer(file) } else { reader.readAsText(file) }
  })
}

export default class extends Controller {
  async upload () {
    const fileInput = document.getElementById('fileInput')
    const file = fileInput.files[0]
    if (!file) { return }
    const fileSize = (file.size / 1024).toFixed(2) // in KB
    const format = fileFormat(file)

    // a KMZ is a zip of a KML plus its icons, so its payload is much smaller than the limit
    if (fileSize > 2500 && format !== 'image' && format !== 'kmz') {
      status(window.__('File exceeds 2.5MB. Please simplify it, for example with mapshaper.org'), 'error', 'medium', 8000)
      return
    }

    if (format === 'image') { this.addImageMarker(file); return }
    if (!format) { console.log('Unsupported file type: ' + file.type); return }

    const content = await readFile(file, format)
    let geoJSON
    let kmlMap = {}

    if (format === 'xml' || format === 'kmz') {
      let imported
      try {
        imported = await importFile(file, content)
      } catch (error) {
        status(window.__('Could not read the file: %{error}').replace('%{error}', error.message), 'error', 'medium', 8000)
        return
      }
      // Every KML <Folder> becomes its own layer. new_layer persists the features server side,
      // so those skip updateElevation() below, same as the mapforge json import.
      imported.layers.forEach(layer => {
        layer.geojson.features.forEach(f => { f.id = functions.featureId() })
        this.createLayer(layer)
      })
      kmlMap = imported.map
      geoJSON = { type: 'FeatureCollection', features: imported.features }
    } else if (format === 'geojson') {
      geoJSON = JSON.parse(content)
    } else if (format === 'json') {
      const mapforgeJSON = JSON.parse(content)
      if (mapforgeJSON.layers) {
        // mapforge export file
        mapforgeJSON.layers.forEach(layer => {
          // reset feature ids
          if (layer.geojson?.features) {
            layer.geojson.features.forEach(f => { f.id = functions.featureId() })
          }
          this.createLayer(layer)
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
      if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
        updateElevation(feature).finally(() => {
          sendMessage('new_feature', feature)
        })
      } else {
        sendMessage('new_feature', feature)
      }
      status(window.__('Added feature %{index}/%{total}')
        .replace('%{index}', i++).replace('%{total}', geoJSON.features.length))
    })

    // A KML <LookAt> frames the import better than its centroid does.
    if (kmlMap.center) {
      const view = { center: kmlMap.center, pitch: kmlMap.pitch, bearing: kmlMap.bearing }
      if (kmlMap.zoom !== undefined) { view.zoom = kmlMap.zoom }
      map.flyTo({ ...view, duration: 1000, curve: 0.3, essential: true })
    } else if (geoJSON?.features?.length > 0) {
      const center = centroid(geoJSON)
      map.flyTo({
        center: center.geometry.coordinates,
        duration: 1000,
        curve: 0.3,
        essential: true
      })
    }

    if (kmlMap.name || kmlMap.description) {
      if (kmlMap.center) {
        mapProperties.center = kmlMap.center
        mapProperties.pitch = kmlMap.pitch
        mapProperties.bearing = kmlMap.bearing
        if (kmlMap.zoom !== undefined) { mapProperties.zoom = kmlMap.zoom }
      }
      if (kmlMap.name && !mapProperties.name) { updateMapName(kmlMap.name) }
      if (kmlMap.description && !mapProperties.description) { mapProperties.description = kmlMap.description }
      sendMessage('update_map', mapProperties)
    }

    if (format === 'json') {
      const mapforgeJSON = JSON.parse(content)
      if (mapforgeJSON.properties) {
        const props = mapforgeJSON.properties
        mapProperties.base_map = props.base_map
        mapProperties.center = props.center
        mapProperties.zoom = props.zoom
        mapProperties.pitch = props.pitch
        mapProperties.bearing = props.bearing
        if (!mapProperties.name) { updateMapName(props.name) }
        if (!mapProperties.description) { mapProperties.description = props.description }
        sendMessage('update_map', mapProperties)
      }
    }

    status(window.__('File imported'))
    initLayersModal()
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
      sendMessage('new_feature', { ...feature })
      status(window.__('Added image'))
      flyToFeature(feature)
    })
  }

  flyToLayerElement (event) {
    // Ignore clicks on the drag handle so reordering never selects/flies to a feature
    if (event?.target?.closest('.feature-drag-handle')) { return }
    const id = this.element.getAttribute('data-feature-id')
    const layer = layers.find(l => l?.geojson?.features?.some(f => f.id === id))
    const feature = layer.geojson.features.find(f => f.id === id)
    // flyToFeature highlights + opens details on moveend, once the animation settles
    flyToFeature(feature)
  }

  toggleEdit (event) {
    event.preventDefault()
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    const contentElement = layerElement.querySelector('.layer-content')
    if (contentElement.classList.contains('hidden')) { this.toggleLayerList(event) }

    if (layer.type === 'overpass') {
      contentElement.querySelector('.overpass-edit').classList.toggle('hidden')
      const queryTextarea = contentElement.querySelector('.overpass-query')
      queryTextarea.value = layer.query || ''
      contentElement.querySelector('.overpass-name').value = layer.name
      this.resizeQueryField({ target: queryTextarea })
    } else if (layer.type === 'raster') {
      contentElement.querySelector('.raster-edit').classList.toggle('hidden')
      contentElement.querySelector('.raster-url').value = layer.query || ''
      contentElement.querySelector('.raster-name').value = layer.name
    }
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
    sendMessage('update_layer', layer.toJSON())
    event.target.closest('.layer-item').querySelector('.reload-icon').classList.add('layer-refresh-animate')
    layer.initialize().then(() => { initLayersModal() })
  }

  updateRasterLayer (event) {
    event.preventDefault()
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)
    addUndoState('Layer updated', { ...layer.toJSON(), geojson: layer.geojson })

    layer.query = layerElement.querySelector('.raster-url').value
    layer.name = layerElement.querySelector('.raster-name').value
    event.target.closest('.layer-item').querySelector('.layer-name').textContent = layer.name
    sendMessage('update_layer', layer.toJSON())

    removeGeoJSONSource(layer.sourceId)
    initializeLayerSources(layerId)
    initializeLayerStyles(layerId).then(() => { initLayersModal() })
  }

  refreshLayer (event) {
    event.preventDefault()
    const layerId = event.target.closest('.layer-item').getAttribute('data-layer-id')
    functions.e('#layer-reload', e => { e.classList.add('hidden') })
    functions.e('#layer-loading', e => { e.classList.remove('hidden') })
    loadLayerData(layerId).then( (result) => {
      initLayersModal()
      functions.e('#layer-loading', e => { e.classList.add('hidden') })
      // keep the reload frame open on failure so the user can retry
      if (result === false) { functions.e('#layer-reload', e => { e.classList.remove('hidden') }) }
    })
  }

  async refreshLayers(event) {
    event.preventDefault()
    functions.e('#layer-reload', e => { e.classList.add('hidden') })
    functions.e('#layer-loading', e => { e.classList.remove('hidden') })
    const anyFailed = await loadAllLayerData()
    functions.e('#layer-loading', e => { e.classList.add('hidden') })
    // keep the reload frame open on failure so the user can retry
    if (anyFailed) { functions.e('#layer-reload', e => { e.classList.remove('hidden') }) }
  }

  toggleLayerList (event) {
    event.preventDefault()
    const list = event.target.closest('.layer-item').querySelector('.layer-content')
    const icon = event.target.closest('.layer-item-header').querySelector('span i')
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
        icon.classList.replace('bi-eye-slash', 'bi-eye')
      } else {
        icon.classList.replace('bi-eye', 'bi-eye-slash')
      }
    })
    const visBtn = layerElement.querySelector('button.layer-visibility')
    const visBtnMobile = layerElement.querySelector('button.layer-visibility-mobile')
    const newText = layer.show ? window.__('Hide layer') : window.__('Show layer')

    // Update tooltip title attributes
    visBtn.setAttribute('title', newText)
    visBtn.setAttribute('data-bs-original-title', newText)
    visBtn.setAttribute('aria-label', newText)
    visBtnMobile.querySelector('.layer-visibility-text').textContent = newText

    // Update Bootstrap tooltip content if it exists
    if (typeof bootstrap !== 'undefined' && visBtn) {
      const tooltip = bootstrap.Tooltip.getInstance(visBtn)
      if (tooltip) {
        tooltip.setContent({ '.tooltip-inner': newText })
      }
    }
    // show/hide refresh and edit buttons based on visibility
    const hideAction = layer.show ? 'remove' : 'add'
    if (layer.type === 'overpass' || layer.type === 'wikipedia') {
      layerElement.querySelectorAll('button.layer-refresh, button.layer-refresh-mobile').forEach(btn => btn.classList[hideAction]('hidden'))
    }
    if ((layer.type === 'overpass' || layer.type === 'raster') && window.gon.map_mode === 'rw') {
      layerElement.querySelectorAll('button.layer-edit, button.layer-edit-mobile').forEach(btn => btn.classList[hideAction]('hidden'))
    }
    // hide global "Load for this area" button if no visible overpass/wikipedia layers remain
    if (!layer.show) {
      const hasVisibleReloadLayer = layers.some(l => l.reloadAfterMapMove() === 'ondemand' && l.show !== false && l.id !== layerId)
      if (!hasVisibleReloadLayer) {
        functions.e('#layer-reload', e => { e.classList.add('hidden') })
      }
    }
    if (layer.show) {
      layerElement.classList.remove('layer-dimmed')
    } else {
      layerElement.classList.add('layer-dimmed')
    }

    // when showing: initialize styles (and load data for overpass/wikipedia if needed)
    if (layer.show) { initializeLayerStyles(layerId) }
    // sync to server only in rw mode
    if (window.gon.map_mode === "rw") { sendMessage('update_layer', layer.toJSON()) }
  }

  createWikipediaLayer() {
    this.createLayer({ type: 'wikipedia', name: 'Wikipedia' })
  }

  createRasterLayer() {
    const layerId = this.createLayer({ type: 'raster', name: 'Raster layer', query: '' })
    new Promise(resolve => setTimeout(resolve, 50)).then(() => {
      document.querySelector('#layer-list-' + layerId + ' button.layer-edit').click()
    })
  }

  createHikingWaymarkedtrailsLayer() {
    this.createLayer({ type: 'raster', name: 'waymarkedtrails.org: hiking',
      query: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png' })
  }

  createCyclingWaymarkedtrailsLayer() {
    this.createLayer({ type: 'raster', name: 'waymarkedtrails.org: cycling',
      query: 'https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png' })
  }

  createMtbWaymarkedtrailsLayer() {
    this.createLayer({ type: 'raster', name: 'waymarkedtrails.org: mtb',
      query: 'https://tile.waymarkedtrails.org/mtb/{z}/{x}/{y}.png' })
  }

  createSlopesWaymarkedtrailsLayer() {
    this.createLayer({ type: 'raster', name: 'waymarkedtrails.org: slopes',
      query: 'https://tile.waymarkedtrails.org/slopes/{z}/{x}/{y}.png' })
  }

  createSelectedOverpassLayer(event) {
    event.preventDefault()
    let queryName = event.target.dataset.queryName
    // empty query for custom
    let query = queries.find(q => q.name === queryName)?.query || ''
    let layerId = this.createLayer({ type: 'overpass', name: queryName, query: query })
    // open edit form for new custom queries
    if (query === '') {
      new Promise(resolve => setTimeout(resolve, 50)).then(() => {
        document.querySelector('#layer-list-' + layerId + ' button.layer-edit').click()
      })
    }
  }

  createBaseMapLayer(_event) {
    this.createLayer({ type: 'basemap', name: 'Basemap layer' })
  }

  createOsmLayer(_event) {
    this.createLayer({ type: 'osm', name: 'OSM layer' })
  }

  createIndoorLayer(_event) {
    this.createLayer({ type: 'indoor', name: 'Indoor map' })
  }

  // 'layer' is a layer definition: { type, name, query, geojson, heatmap, cluster, show }
  createLayer(layer) {
    let layerId = functions.featureId()
    // must match server attribute order, for proper comparison in map_channel
    let layerData = { "id": layerId, "type": layer.type, "name": layer.name,
      "heatmap": layer.heatmap ?? false, "cluster": layer.cluster ?? false,
      "show": layer.show ?? true, "geojson": layer.geojson ?? null }
    if (layer.query != null) { layerData.query = layer.query }
    if (layer.type == 'overpass') {
      // TODO: move cluster + heatmap to layer checkboxes
      const clustered = !layerData.query.includes("heatmap=true") &&
        !layerData.query.includes("cluster=false") &&
        !layerData.query.includes("geom") // clustering breaks lines & geometries
      layerData["cluster"] = clustered
      layerData["heatmap"] = layerData.query.includes("heatmap=true")
    }
    const layerInstance = createLayerInstance(layerData)
    layerInstance.localData = true // renders from memory, see GeoJSONLayer.loadData
    layers.push(layerInstance)

    addUndoState('Layer added', layerData)
    initLayersModal()
    initializeLayerSources(layerId)
    initializeLayerStyles(layerId)
    sendMessage('new_layer', layerData)
    return layerId
  }

  deleteLayer (event) {
    event.preventDefault()
    if (!confirm(window.__('Really delete this layer?'))) { return }
    const layerElement = event.target.closest('.layer-item')
    const layerId = layerElement.getAttribute('data-layer-id')
    const layer = layers.find(f => f.id === layerId)

    addUndoState('Layer deleted', { ...layer.toJSON(), geojson: layer.geojson })
    layer.cleanup()
    layers.splice(layers.indexOf(layer), 1)
    removeGeoJSONSource(layer.sourceId)
    sendMessage('delete_layer', layer.toJSON())
    initLayersModal()
  }
}
