import { sendMessage } from 'channels/map_channel'
import { status } from 'helpers/status'
import { select, selectedRoute } from 'maplibre/edit'
import { getFeatureTypeName } from 'maplibre/feature'
import { showFeatureDetails } from 'maplibre/feature/details'
import { addFeature, applyLayerVisibility, destroyFeature, getFeature, getLayer, layers, removeLayer, renderLayers } from 'maplibre/layers/layers'
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

// meta holds entry data that is not part of the state, e.g. the placement of a removed layer
export function addUndoState(type, state, clearRedo = true, meta = {}) {
  // Deep clone to avoid mutation
  undoStack.push({ ...meta, type: type, state: JSON.parse(JSON.stringify(state)) })
  // console.log('Updated undo stack', undoStack)
  showUndoButton()
  if (clearRedo) {
    hideRedoButton()
    redoStack = []
  }
  updateTooltips()
}

function addRedoState(type, state, meta = {}) {
  // Deep clone to avoid mutation
  redoStack.push({ ...meta, type: type, state: JSON.parse(JSON.stringify(state)) })
  console.log('Updated redo stack', redoStack)
  showRedoButton()
  updateTooltips()
}

// Undo types are English keys: they index the handler maps below and are stored in the stack.
// This map holds their translations, and keeps the msgids extractable for gettext.
const typeLabels = {
  'Feature update': window.__('%{type} update'),
  'Feature property update': window.__('%{type} property update'),
  'Feature added': window.__('%{type} added'),
  'Feature deleted': window.__('%{type} deleted'),
  'Track added': window.__('Track added'),
  'Track update': window.__('Track update'),
  'Layer added': window.__('Layer added'),
  'Layer deleted': window.__('Layer deleted'),
  'Layer updated': window.__('Layer updated'),
  'Route created from GPX': window.__('Route created from GPX')
}

function typeLabel(entry) {
  const label = typeLabels[entry.type] || entry.type
  return label.replace('%{type}', getFeatureTypeName(entry.state))
}

// Each entry type names the operation that undoes it and the one that redoes it. An operation
// puts the state it replaces on the other stack with push(type, state, meta), and returns false
// when it cannot run, which keeps the entry on its stack.
const handlers = {
  'Feature update': [swapFeature, swapFeature],
  'Feature property update': [swapFeature, swapFeature],
  'Feature added': [removeFeatureEntry, restoreFeature],
  'Feature deleted': [restoreFeature, removeFeatureEntry],
  'Track added': [removeTrack, restoreFeature],
  'Track update': [swapFeature, swapFeature],
  'Layer added': [dropLayer, restoreLayerEntry],
  'Layer deleted': [restoreLayerEntry, dropLayer],
  'Layer updated': [swapLayer, swapLayer]
}

export function undo() {
  step(undoStack, 0, addRedoState, window.__('Undone: %{type}'), hideUndoButton)
}

export function redo() {
  const push = (type, state, meta) => addUndoState(type, state, false, meta)
  step(redoStack, 1, push, window.__('Redone: %{type}'), hideRedoButton)
}

function step(stack, direction, push, message, hideButton) {
  if (stack.length === 0) { console.warn('Undo/redo stack empty'); return }
  const entry = stack.pop()
  const handler = handlers[entry.type]?.[direction]
  if (!handler) { console.warn('Cannot undo/redo ', entry); return }
  if (handler(entry, push) === false) { stack.push(entry); return }
  status(message.replace('%{type}', typeLabel(entry)))
  renderLayers('geojson', true)
  keepSelection()
  if (stack.length === 0) { hideButton() }
  updateTooltips()
}

// Restore in place, so the render below already shows the old state. Without this the map only
// changes when the server echo arrives, and that path interpolates a moved point over the idle
// time since its last update (see AnimatePointAnimation), which crawls for a one-off edit.
function applyState(feature, state) {
  feature.geometry = state.geometry
  feature.properties = state.properties
}

function swapFeature(entry, push) {
  const feature = getFeature(entry.state.id, 'geojson')
  if (!feature) { console.warn('Feature with id ' + entry.state.id + ' not found'); return }
  push(entry.type, feature)
  applyState(feature, entry.state)
  resetDirections()
  sendMessage('update_feature', entry.state)
}

// A feature that comes back goes to its old layer, not to the active one
export function featurePlacement(featureId) {
  return { layerId: getLayer(featureId, 'geojson')?.id }
}

function restoreFeature(entry, push) {
  if (getFeature(entry.state.id, 'geojson')) { console.warn('Feature with id ' + entry.state.id + ' still exists'); return }
  push(entry.type, entry.state)
  addFeature(entry.state, entry.layerId)
  sendMessage('new_feature', entry.state)
}

function removeFeatureEntry(entry, push) {
  const feature = getFeature(entry.state.id, 'geojson')
  if (!feature) { console.warn('Feature with id ' + entry.state.id + ' not found'); return }
  push(entry.type, feature, featurePlacement(feature.id))
  destroyFeature(entry.state.id)
  sendMessage('delete_feature', { id: entry.state.id })
}

function removeTrack(entry, push) {
  removeFeatureEntry(entry, push)
  resetDirections()
}

// Helper to get full layer data including geojson
function getFullLayerData(layer) {
  return {
    ...layer.toJSON(),
    geojson: layer.geojson
  }
}

// The state of a 'Layer updated' entry. Features and their order change without an undo entry,
// so an undo that restored them would drop later moves and additions.
export function layerSettings(layer) {
  const { feature_order: _featureOrder, ...settings } = layer.toJSON()
  return settings
}

// The server can only place a new layer first or last, so that is all a removed layer remembers
export function layerPlacement(layer) {
  return { first: layers.indexOf(layer) === 0 }
}

// The server refuses to delete it, because new features need a geojson layer
function isLastGeojsonLayer(layer) {
  if (layer.type !== 'geojson' || layers.filter(l => l.type === 'geojson').length > 1) { return false }
  status(window.__('Cannot delete the last layer'), 'warning')
  return true
}

function restoreLayer(entry) {
  const newLayer = createLayerInstance(entry.state)
  newLayer.localData = true // renders from memory, see GeoJSONLayer.loadData
  if (entry.first) { layers.unshift(newLayer) } else { layers.push(newLayer) }
  initLayersModal()
  initializeLayerSources(newLayer.id)
  initializeLayerStyles(newLayer.id)
  sendMessage('new_layer', entry.first ? { ...entry.state, first: true } : entry.state)
}

function restoreLayerEntry(entry, push) {
  if (layers.some(l => l.id === entry.state.id)) { console.warn('Layer with id ' + entry.state.id + ' still exists'); return }
  push(entry.type, entry.state)
  restoreLayer(entry)
}

function dropLayer(entry, push) {
  const layer = layers.find(l => l.id === entry.state.id)
  if (!layer) { console.warn('Layer with id ' + entry.state.id + ' not found'); return }
  if (isLastGeojsonLayer(layer)) { return false }
  push(entry.type, getFullLayerData(layer), layerPlacement(layer))
  removeLayer(layer)
  sendMessage('delete_layer', layer.toJSON())
  initLayersModal()
}

function swapLayer(entry, push) {
  const layer = layers.find(l => l.id === entry.state.id)
  if (!layer) { console.warn('Layer with id ' + entry.state.id + ' not found'); return }
  push(entry.type, layerSettings(layer))
  layer.update(entry.state)
  applyLayerVisibility(layer).then(initLayersModal)
  sendMessage('update_layer', entry.state)
}

// keep feature selected
function keepSelection() {
  if (selectedRoute) {
    let geojsonFeature = getFeature(selectedRoute.id, 'geojson')
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
  const undoTitle = undoTop ? window.__('Undo: %{type}').replace('%{type}', typeLabel(undoTop)) : window.__('Undo')
  undoBtn.setAttribute('title', undoTitle)
  undoBtn.setAttribute('aria-label', undoTitle)
  undoBtn.setAttribute('data-bs-original-title', undoTitle)

  // Update redo button
  const redoTop = redoStack[redoStack.length - 1]
  const redoTitle = redoTop ? window.__('Redo: %{type}').replace('%{type}', typeLabel(redoTop)) : window.__('Redo')
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
