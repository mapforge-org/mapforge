import { mapChannel } from 'channels/map_channel'
import { status } from 'helpers/status'
import { select, selectedFeature } from 'maplibre/edit'
import { showFeatureDetails } from 'maplibre/feature'
import { getFeature, renderLayers, layers } from 'maplibre/layers/layers'
import { addFeature, destroyFeature, removeGeoJSONSource, setLayerVisibility } from 'maplibre/map'
import { resetDirections } from 'maplibre/routing/directions'
import { initLayersModal } from 'maplibre/controls/shared'
import { createLayerInstance } from 'maplibre/layers/factory'
import { initializeLayerSources, initializeLayerStyles } from 'maplibre/layers/layers'

let undoStack = []
let redoStack = []

/**
 * Clears undo/redo history when navigating to a new map
 */
export function clearUndoHistory() {
  undoStack = []
  redoStack = []
  // Try to hide buttons if they exist
  try {
    const undoBtn = document.querySelector('button.maplibregl-ctrl-undo')
    const redoBtn = document.querySelector('button.maplibregl-ctrl-redo')
    if (undoBtn) undoBtn.classList.add('hidden')
    if (redoBtn) redoBtn.classList.add('hidden')
    updateTooltips()
  } catch {
    // Buttons may not exist yet
  }
}

export function addUndoState(type, state, clearRedo = true) {
  // Deep clone to avoid mutation
  undoStack.push({ type: type, state: JSON.parse(JSON.stringify(state)) })
  // console.log('Updated undo stack', undoStack)
  showUndoButton()
  if (clearRedo) {
    hideRedoButton()
    redoStack = []
  }
  updateTooltips()
}

function addRedoState(type, state) {
  // Deep clone to avoid mutation
  redoStack.push({ type: type, state: JSON.parse(JSON.stringify(state)) })
  console.log('Updated redo stack', redoStack)
  showRedoButton()
  updateTooltips()
}

const undoHandlers = {
  'Feature update': undoFeatureUpdate,
  'Feature property update': undoFeatureUpdate,
  'Feature added': undoFeatureAdded,
  'Feature deleted': undoFeatureDelete,
  'Track added': undoTrackAdded,
  'Track update': undoFeatureUpdate,
  'Layer added': undoLayerAdded,
  'Layer deleted': undoLayerDeleted,
  'Layer updated': undoLayerUpdated
}

const redoHandlers = {
  'Feature update': redoFeatureUpdate,
  'Feature property update': redoFeatureUpdate,
  'Feature added': redoFeatureAdded,
  'Feature deleted': redoFeatureDelete,
  'Track added': redoFeatureAdded,
  'Track update': redoFeatureUpdate,
  'Layer added': redoLayerAdded,
  'Layer deleted': redoLayerDeleted,
  'Layer updated': redoLayerUpdated
}

export function undo() {
  // console.log('Undo from stack', undoStack)
  if (undoStack.length === 0) { console.warn('Undo stack empty'); return }
  const prevState = undoStack.pop()
  // console.log('Undo state: ' + JSON.stringify(prevState))
  const handler = undoHandlers[prevState.type]
  if (!handler) { console.warn('Cannot undo ', prevState); return }
  handler(prevState)
  status('Undo: ' + prevState.type)
  renderLayers('geojson', true)
  keepSelection()
  if (undoStack.length === 0) { hideUndoButton() }
  updateTooltips()
}

export function redo() {
  // console.log('Redo from stack', redoStack)
  if (redoStack.length === 0) { console.warn('Redo stack empty'); return }
  const nextState = redoStack.pop()
  // console.log('Next state: ' + JSON.stringify(nextState))
  const handler = redoHandlers[nextState.type]
  if (!handler) { console.warn('Cannot redo ', nextState); return }
  handler(nextState)
  status('Redo: ' + nextState.type)
  renderLayers('geojson', true)
  keepSelection()
  if (redoStack.length === 0) { hideRedoButton() }
  updateTooltips()
}

function undoFeatureUpdate(prevState) {
  let feature = getFeature(prevState.state.id, 'geojson')
  if (feature) {
    addRedoState(prevState.type, feature)
    feature = prevState.state
    resetDirections()
    mapChannel.send_message('update_feature', prevState.state)
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found for undo')
  }
}

function redoFeatureUpdate(nextState) {
  let feature = getFeature(nextState.state.id, 'geojson')
  if (feature) {
    addUndoState(nextState.type, feature, false)
    feature = nextState.state
    resetDirections()
    mapChannel.send_message('update_feature', nextState.state)
  } else {
    console.warn('Feature with id ' + nextState.state.id + ' not found in geojsonData')
  }
}

function undoFeatureDelete(prevState) {
  let feature = getFeature(prevState.state.id, 'geojson')
  if (!feature) {
    addRedoState(prevState.type, prevState.state)
    addFeature(prevState.state)
    mapChannel.send_message('new_feature', prevState.state)
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' still present in layer geojson')
  }
}

function redoFeatureDelete(nextState) {
  let feature = getFeature(nextState.state.id, 'geojson')
  if (feature) {
    addUndoState(nextState.type, feature, false)
    destroyFeature(nextState.state.id)
    mapChannel.send_message('delete_feature', { id: nextState.state.id })
  } else {
    console.warn('Feature with id ' + nextState.state.id + ' not found in layer geojson')
  }
}

function undoFeatureAdded(prevState) {
  let feature = getFeature(prevState.state.id, 'geojson')
  if (feature) {
    addRedoState(prevState.type, feature, false)
    destroyFeature(prevState.state.id)
    mapChannel.send_message('delete_feature', { id: prevState.state.id })
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found in layer geojson')
  }
}

function redoFeatureAdded(nextState) {
  let feature = getFeature(nextState.state.id, 'geojson')
  if (!feature) {
    addUndoState(nextState.type, nextState.state, false)
    addFeature(nextState.state)
    mapChannel.send_message('new_feature', nextState.state)
  } else {
    console.warn('Feature with id ' + nextState.state.id + ' still present in layer geojson')
  }
}

function undoTrackAdded(prevState) {
  let feature = getFeature(prevState.state.id, 'geojson')
  if (feature) {
    addRedoState(prevState.type, feature, false)
    destroyFeature(prevState.state.id)
    resetDirections()
    mapChannel.send_message('delete_feature', { id: prevState.state.id })
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found in layer geojson')
  }
}

// Helper to get full layer data including geojson
function getFullLayerData(layer) {
  return {
    ...layer.toJSON(),
    geojson: layer.geojson
  }
}

// Layer operations
function undoLayerAdded(prevState) {
  const layer = layers.find(l => l.id === prevState.state.id)
  if (layer) {
    addRedoState(prevState.type, getFullLayerData(layer))
    layer.cleanup()
    layers.splice(layers.indexOf(layer), 1)
    removeGeoJSONSource(layer.sourceId)
    mapChannel.send_message('delete_layer', layer.toJSON())
    initLayersModal()
  } else {
    console.warn('Layer with id ' + prevState.state.id + ' not found')
  }
}

function redoLayerAdded(nextState) {
  const layer = layers.find(l => l.id === nextState.state.id)
  if (!layer) {
    addUndoState(nextState.type, nextState.state, false)
    const newLayer = createLayerInstance(nextState.state)
    layers.push(newLayer)
    initLayersModal()
    initializeLayerSources(newLayer.id)
    initializeLayerStyles(newLayer.id)
    mapChannel.send_message('new_layer', nextState.state)
  } else {
    console.warn('Layer with id ' + nextState.state.id + ' already exists')
  }
}

function undoLayerDeleted(prevState) {
  const layer = layers.find(l => l.id === prevState.state.id)
  if (!layer) {
    addRedoState(prevState.type, prevState.state)
    const newLayer = createLayerInstance(prevState.state)
    layers.push(newLayer)
    initLayersModal()
    initializeLayerSources(newLayer.id)
    initializeLayerStyles(newLayer.id)
    mapChannel.send_message('new_layer', prevState.state)
  } else {
    console.warn('Layer with id ' + prevState.state.id + ' still exists')
  }
}

function redoLayerDeleted(nextState) {
  const layer = layers.find(l => l.id === nextState.state.id)
  if (layer) {
    addUndoState(nextState.type, getFullLayerData(layer), false)
    layer.cleanup()
    layers.splice(layers.indexOf(layer), 1)
    removeGeoJSONSource(layer.sourceId)
    mapChannel.send_message('delete_layer', layer.toJSON())
    initLayersModal()
  } else {
    console.warn('Layer with id ' + nextState.state.id + ' not found')
  }
}

function undoLayerUpdated(prevState) {
  const layer = layers.find(l => l.id === prevState.state.id)
  if (layer) {
    addRedoState(prevState.type, getFullLayerData(layer))
    // Update layer properties using the layer's update method
    layer.update(prevState.state)
    setLayerVisibility(layer.sourceId, layer.show)
    layer.initialize().then(() => { initLayersModal() })
    mapChannel.send_message('update_layer', prevState.state)
  } else {
    console.warn('Layer with id ' + prevState.state.id + ' not found')
  }
}

function redoLayerUpdated(nextState) {
  const layer = layers.find(l => l.id === nextState.state.id)
  if (layer) {
    addUndoState(nextState.type, getFullLayerData(layer), false)
    // Update layer properties using the layer's update method
    layer.update(nextState.state)
    setLayerVisibility(layer.sourceId, layer.show)
    layer.initialize().then(() => { initLayersModal() })
    mapChannel.send_message('update_layer', nextState.state)
  } else {
    console.warn('Layer with id ' + nextState.state.id + ' not found')
  }
}

// keep feature selected
function keepSelection() {
  if (selectedFeature) {
    let geojsonFeature = getFeature(selectedFeature.id, 'geojson')
    if (geojsonFeature) {
      showFeatureDetails(geojsonFeature)
      select(geojsonFeature)
    }
  }
}

function updateTooltips() {
  const undoBtn = document.querySelector('button.maplibregl-ctrl-undo')
  const redoBtn = document.querySelector('button.maplibregl-ctrl-redo')

  if (!undoBtn || !redoBtn) return

  // Update undo button
  const undoTop = undoStack[undoStack.length - 1]
  const undoTitle = undoTop ? `Undo: ${undoTop.type}` : 'Undo'
  undoBtn.setAttribute('title', undoTitle)
  undoBtn.setAttribute('aria-label', undoTitle)
  undoBtn.setAttribute('data-bs-original-title', undoTitle)

  // Update redo button
  const redoTop = redoStack[redoStack.length - 1]
  const redoTitle = redoTop ? `Redo: ${redoTop.type}` : 'Redo'
  redoBtn.setAttribute('title', redoTitle)
  redoBtn.setAttribute('aria-label', redoTitle)
  redoBtn.setAttribute('data-bs-original-title', redoTitle)

  // Refresh Bootstrap tooltips if they exist
  if (typeof window.bootstrap !== 'undefined') {
    [undoBtn, redoBtn].forEach(btn => {
      const tooltip = window.bootstrap.Tooltip.getInstance(btn)
      if (tooltip) {
        // Update the tooltip's internal title
        tooltip.setContent({ '.tooltip-inner': btn.getAttribute('data-bs-original-title') })
      }
    })
  }
}

function showUndoButton() {
  document.querySelector('button.maplibregl-ctrl-undo').classList.remove('hidden')
}

function hideUndoButton() {
  document.querySelector('button.maplibregl-ctrl-undo').classList.add('hidden')
}

function showRedoButton() {
  document.querySelector('button.maplibregl-ctrl-redo').classList.remove('hidden')
}

function hideRedoButton() {
  document.querySelector('button.maplibregl-ctrl-redo').classList.add('hidden')
}
