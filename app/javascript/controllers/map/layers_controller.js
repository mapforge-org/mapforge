import { Controller } from '@hotwired/stimulus'
import { centroid } from '@turf/centroid'
import { sendMessage } from 'channels/map_channel'
import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { flyToFeature } from 'maplibre/animations'
import { initLayersModal } from 'maplibre/controls/shared'
import { updateElevation } from 'maplibre/routing/openrouteservice'
import { confirmImageLocation, uploadImageToFeature } from 'maplibre/feature/image_upload'
import { importFile } from 'maplibre/import/kml'
import { activeLayer, applyLayerVisibility, createLayerInstance, getFeature, initializeLayerSources, initializeLayerStyles, layers, loadAllLayerData, loadLayerData, removeLayer, setActiveLayer, setLayerLoading, upsert } from 'maplibre/layers/layers'
import { overpassClusterSettings } from 'maplibre/layers/overpass/overpass'
import { queries } from 'maplibre/layers/overpass/queries'
import { map, mapProperties, sortLayers, updateMapName } from 'maplibre/map'
import { addUndoState, layerPlacement, layerSettings } from 'maplibre/undo'

// Browsers report an empty file.type for these when the platform mime database
// does not know them, so the extension decides as well.
function fileFormat (file) {
  const name = file.name.toLowerCase()
  if (file.type === 'application/gpx+xml' || name.endsWith('.gpx')) { return 'gpx' }
  if (file.type === 'application/vnd.google-earth.kml+xml' || name.endsWith('.kml')) { return 'kml' }
  if (file.type === 'application/vnd.google-earth.kmz' || name.endsWith('.kmz')) { return 'kmz' }
  if (file.type === 'application/geo+json' || name.endsWith('.geojson')) { return 'geojson' }
  if (file.type === 'application/json' || name.endsWith('.json')) { return 'json' }
  if (file.type.startsWith('image/')) { return 'image' }
  return null
}

// the .layer-item around the event target, and its layer
function layerItem (event) {
  const layerElement = event.target.closest('.layer-item')
  const layerId = layerElement.getAttribute('data-layer-id')
  return { layerElement, layer: layers.find(l => l.id === layerId) }
}

export default class extends Controller {
  pickFile (event) {
    const fileInput = document.getElementById('fileInput')
    fileInput.accept = event.currentTarget.dataset.accept
    fileInput.click()
  }

  async upload () {
    const fileInput = document.getElementById('fileInput')
    const file = fileInput.files[0]
    if (!file) { return }
    const format = fileFormat(file)

    // a KMZ is a zip of a KML plus its icons, so its payload is much smaller than the limit
    if (file.size > 2500 * 1024 && format !== 'image' && format !== 'kmz') {
      status(window.__('File exceeds 2.5MB. Please simplify it, for example with mapshaper.org'), 'error', 'medium', 8000)
      return
    }

    if (format === 'image') { this.addImageMarker(file); return }
    if (!format) { console.log('Unsupported file type: ' + file.type); return }

    const content = format === 'kmz' ? await file.arrayBuffer() : await file.text()
    let geoJSON
    let mapProps

    // createLayer persists the features of a KML <Folder> or an export layer in one new_layer
    // message, so only the loose features in geoJSON go through updateElevation() below.
    if (['gpx', 'kml', 'kmz'].includes(format)) {
      let imported
      try {
        imported = await importFile(format, content)
      } catch (error) {
        status(window.__('Could not read the file: %{error}').replace('%{error}', error.message), 'error', 'medium', 8000)
        return
      }
      imported.layers.forEach(layer => this.createLayer(layer))
      mapProps = imported.map
      geoJSON = { type: 'FeatureCollection', features: imported.features }
    } else {
      const json = JSON.parse(content)
      if (json.layers) {
        json.layers.forEach(layer => this.createLayer(layer))
        mapProps = json.properties
      } else {
        geoJSON = json
      }
    }

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
    })

    // flyTo reads a present but undefined zoom as NaN
    const view = Object.fromEntries(['center', 'zoom', 'pitch', 'bearing']
      .filter(key => mapProps?.[key] != null).map(key => [key, mapProps[key]]))
    // A KML <LookAt> or the export view frames the import better than its centroid does.
    if (view.center) {
      map.flyTo({ ...view, duration: 1000, curve: 0.3, essential: true })
    } else if (geoJSON?.features?.length > 0) {
      map.flyTo({ center: centroid(geoJSON).geometry.coordinates, duration: 1000, curve: 0.3, essential: true })
    }

    if (mapProps && Object.keys(mapProps).length) {
      Object.assign(mapProperties, view)
      if (mapProps.base_map) { mapProperties.base_map = mapProps.base_map }
      if (mapProps.name && !mapProperties.name) { updateMapName(mapProps.name) }
      if (mapProps.description && !mapProperties.description) { mapProperties.description = mapProps.description }
      sendMessage('update_map', mapProperties)
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
      sendMessage('new_feature', { ...feature })
      status(window.__('Added image'))
      flyToFeature(feature)
    })
  }

  flyToLayerElement (event) {
    // Ignore clicks on the drag handle so reordering never selects/flies to a feature
    if (event?.target?.closest('.feature-drag-handle')) { return }
    const id = this.element.getAttribute('data-feature-id')
    const feature = getFeature(id)
    // flyToFeature highlights + opens details on moveend, once the animation settles
    flyToFeature(feature)
  }

  toggleEdit (event) {
    event.preventDefault()
    const { layerElement, layer } = layerItem(event)
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
    const { layerElement, layer } = layerItem(event)
    addUndoState('Layer updated', layerSettings(layer))

    layer.query = layerElement.querySelector('.overpass-query').value
    layer.name = layerElement.querySelector('.overpass-name').value
    Object.assign(layer, overpassClusterSettings(layer.query))
    layerElement.querySelector('.layer-name').textContent = layer.name
    sendMessage('update_layer', layer.toJSON())
    layerElement.querySelector('.reload-icon').classList.add('layer-refresh-animate')
    layer.initialize().then(() => { sortLayers(); initLayersModal() })
  }

  updateRasterLayer (event) {
    event.preventDefault()
    const { layerElement, layer } = layerItem(event)
    addUndoState('Layer updated', layerSettings(layer))

    layer.update({ query: layerElement.querySelector('.raster-url').value, name: layerElement.querySelector('.raster-name').value })
    layerElement.querySelector('.layer-name').textContent = layer.name
    sendMessage('update_layer', layer.toJSON())
    applyLayerVisibility(layer).then(initLayersModal)
  }

  renameLayer (event) {
    event.preventDefault()
    const { layerElement, layer } = layerItem(event)
    const input = document.createElement('input')
    input.type = 'text'
    input.classList.add('form-control', 'd-inline-block', 'me-2', 'mapforge-font', 'layer-name-input')
    input.placeholder = window.__('Layer elements')
    input.value = layer.name || ''
    let cancelled = false
    // the header toggles the layer list on click, and Escape on window closes the modal
    input.addEventListener('click', e => e.stopPropagation())
    input.addEventListener('keydown', e => {
      e.stopPropagation()
      if (e.key === 'Escape') { cancelled = true }
      if (e.key === 'Enter' || e.key === 'Escape') { input.blur() }
    })
    input.addEventListener('blur', () => {
      const name = input.value.trim()
      if (!cancelled && name && name !== layer.name) {
        addUndoState('Layer updated', layerSettings(layer))
        layer.name = name
        sendMessage('update_layer', layer.toJSON())
      }
      initLayersModal()
    })
    layerElement.querySelector('.layer-name').replaceWith(input)
    input.focus()
    input.select()
  }

  refreshLayer (event) {
    event.preventDefault()
    const layerId = event.target.closest('.layer-item').getAttribute('data-layer-id')
    setLayerLoading(true)
    loadLayerData(layerId).then( (result) => {
      initLayersModal()
      setLayerLoading(false, result === false)
    })
  }

  async refreshLayers(event) {
    event.preventDefault()
    setLayerLoading(true)
    setLayerLoading(false, await loadAllLayerData())
  }

  toggleLayerList (event) {
    event.preventDefault()
    const list = event.target.closest('.layer-item').querySelector('.layer-content')
    const icon = event.target.closest('.layer-item-header').querySelector('span i')
    const hidden = list.classList.toggle('hidden')
    icon.classList.toggle('bi-caret-right-fill', hidden)
    icon.classList.toggle('bi-caret-down-fill', !hidden)
  }

  toggleLayerVisibility (event) {
    event.preventDefault()
    const { layerElement, layer } = layerItem(event)
    const wasVisible = layer.show !== false
    const previousActiveLayer = activeLayer()
    if (window.gon.map_mode === "rw") { addUndoState('Layer updated', layerSettings(layer)) }

    layer.show = !wasVisible

    const visBtn = layerElement.querySelector('button.layer-visibility')
    const icon = visBtn.querySelector('i')
    icon.classList.toggle('bi-eye', layer.show)
    icon.classList.toggle('bi-eye-slash', !layer.show)
    const newText = layer.show ? window.__('Hide layer') : window.__('Show layer')

    // Update tooltip title attributes
    visBtn.setAttribute('title', newText)
    visBtn.setAttribute('data-bs-original-title', newText)
    visBtn.setAttribute('aria-label', newText)

    // Update Bootstrap tooltip content if it exists
    if (typeof bootstrap !== 'undefined') {
      const tooltip = bootstrap.Tooltip.getInstance(visBtn)
      if (tooltip) {
        tooltip.setContent({ '.tooltip-inner': newText })
      }
    }
    // show/hide refresh and edit buttons based on visibility
    if (layer.type === 'overpass' || layer.type === 'wikipedia') {
      layerElement.querySelector('button.layer-refresh').classList.toggle('hidden', !layer.show)
    }
    if ((layer.type === 'overpass' || layer.type === 'raster') && window.gon.map_mode === 'rw') {
      layerElement.querySelector('button.layer-edit').classList.toggle('hidden', !layer.show)
    }
    // hide global "Load for this area" button if no visible overpass/wikipedia layers remain
    if (!layer.show) {
      const hasVisibleReloadLayer = layers.some(l => l.reloadAfterMapMove() === 'ondemand' && l.show !== false && l !== layer)
      if (!hasVisibleReloadLayer) {
        functions.e('#layer-reload', e => { e.classList.add('hidden') })
      }
    }
    layerElement.classList.toggle('layer-dimmed', !layer.show)

    // when showing: initialize styles (and load data for overpass/wikipedia if needed).
    // A geojson layer keeps its style layers and data while hidden, so a full rebuild is only
    // needed when they don't exist yet (hidden at page load, replaced by setStyle, or dropped by
    // a settings change while hidden, see applyLayerVisibility).
    applyLayerVisibility(layer, layer.show && (layer.type !== 'geojson' || !layer.getStyleLayerIds().length))
    sendMessage('update_layer', layer.toJSON())

    if (window.gon.map_mode === 'rw' && layer.type === 'geojson') {
      if (activeLayer() !== previousActiveLayer) { setActiveLayer(activeLayer().id) }
      initLayersModal()
    }
  }

  activateLayer (event) {
    event.preventDefault()
    event.stopPropagation()
    setActiveLayer(layerItem(event).layer.id)
    initLayersModal()
  }

  createGeojsonLayer() {
    const layerId = this.createLayer({ type: 'geojson', name: window.__('New layer'),
      geojson: { type: 'FeatureCollection', features: [] } }, { first: true })
    setActiveLayer(layerId)
    initLayersModal()
  }

  createRasterLayer() {
    const layerId = this.createLayer({ type: 'raster', name: 'Raster layer', query: '' })
    functions.sleep(50).then(() => {
      document.querySelector('#layer-list-' + layerId + ' button.layer-edit').click()
    })
  }

  // for the layer types that need no setup: the button carries type, name and query
  addLayer(event) {
    const { layerType, layerName, layerQuery } = event.currentTarget.dataset
    this.createLayer({ type: layerType, name: layerName, query: layerQuery })
  }

  createSelectedOverpassLayer(event) {
    event.preventDefault()
    let queryName = event.target.dataset.queryName
    // empty query for custom
    let query = queries.find(q => q.name === queryName)?.query || ''
    let layerId = this.createLayer({ type: 'overpass', name: queryName, query: query })
    // open edit form for new custom queries
    if (query === '') {
      functions.sleep(50).then(() => {
        document.querySelector('#layer-list-' + layerId + ' button.layer-edit').click()
      })
    }
  }

  // 'layer' is a layer definition: { type, name, query, geojson, heatmap, cluster, show }
  // first: the layer becomes the first layer of the map, on the server and in the list
  createLayer(layer, { first = false } = {}) {
    let layerId = functions.featureId()
    // an import keeps the feature ids of its source map otherwise
    layer.geojson?.features?.forEach(f => { f.id = functions.featureId() })
    // must match server attribute order, for proper comparison in map_channel
    let layerData = { "id": layerId, "type": layer.type, "name": layer.name,
      "heatmap": layer.heatmap ?? false, "cluster": layer.cluster ?? false,
      "show": layer.show ?? true, "geojson": layer.geojson ?? null }
    if (layer.query != null) { layerData.query = layer.query }
    if (layer.type == 'overpass') { Object.assign(layerData, overpassClusterSettings(layerData.query)) }
    const layerInstance = createLayerInstance(layerData)
    layerInstance.localData = true // renders from memory, see GeoJSONLayer.loadData
    if (first) { layers.unshift(layerInstance) } else { layers.push(layerInstance) }

    addUndoState('Layer added', layerData)
    initLayersModal()
    initializeLayerSources(layerId)
    initializeLayerStyles(layerId)
    // the flag stays out of layerData, which is the undo state and gets compared to server layers.
    // Undo reads the placement from the list position instead, see layerPlacement.
    sendMessage('new_layer', first ? { ...layerData, first: true } : layerData)
    return layerId
  }

  deleteLayer (event) {
    event.preventDefault()
    if (!confirm(window.__('Really delete this layer?'))) { return }
    const { layer } = layerItem(event)

    addUndoState('Layer deleted', { ...layer.toJSON(), geojson: layer.geojson }, true, layerPlacement(layer))
    removeLayer(layer)
    sendMessage('delete_layer', layer.toJSON())
    initLayersModal()
  }
}
