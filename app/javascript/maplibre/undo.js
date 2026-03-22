import { status } from 'helpers/status'
import { select, selectedFeature } from 'maplibre/edit'
import { showFeatureDetails } from 'maplibre/feature'
import { getFeature, renderLayers } from 'maplibre/layers/layers'
import { addFeature, destroyFeature } from 'maplibre/map'
import { resetDirections } from 'maplibre/routing/osrm'

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
  } catch (_e) {
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
}

function addRedoState(type, state) {
  // Deep clone to avoid mutation
  redoStack.push({ type: type, state: JSON.parse(JSON.stringify(state)) })
  console.log('Updated redo stack', redoStack)
  showRedoButton()
}

const undoHandlers = {
  'Feature update': undoFeatureUpdate,
  'Feature property update': undoFeatureUpdate,
  'Feature added': undoFeatureAdded,
  'Feature deleted': undoFeatureDelete,
  'Track added': undoTrackAdded,
  'Track update': undoFeatureUpdate
}

const redoHandlers = {
  'Feature update': redoFeatureUpdate,
  'Feature property update': redoFeatureUpdate,
  'Feature added': redoFeatureAdded,
  'Feature deleted': redoFeatureDelete,
  'Track added': redoFeatureAdded,
  'Track update': redoFeatureUpdate
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
