import { redrawGeojson, addFeature, destroyFeature } from 'maplibre/map'
import { select, selectedFeature } from 'maplibre/edit'
import { showFeatureDetails } from 'maplibre/feature'
import { resetDirections } from 'maplibre/routing/osrm'
import { status } from 'helpers/status'

let undoStack = []
let redoStack = []

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

export function undo() {
  // console.log('Undo from stack', undoStack)
  if (undoStack.length === 0) { console.warn('Undo stack empty'); return }
  const prevState = undoStack.pop()
  // console.log('Undo state: ' + JSON.stringify(prevState))
  if (prevState.type === 'Feature update') {
    undoFeatureUpdate(prevState)
  } else if (prevState.type === 'Feature property update') {
    undoFeatureUpdate(prevState)    
  } else if (prevState.type === 'Feature added') {
    undoFeatureAdded(prevState)
  } else if (prevState.type === 'Feature deleted') {
    undoFeatureDelete(prevState)  
  } else if (prevState.type === 'Track added') {
    undoTrackAdded(prevState)    
  } else if (prevState.type === 'Track update') {
    undoFeatureUpdate(prevState)
  } else {
    console.warn('Cannot undo ', prevState)
    return 
  }
  status('Undo: ' + prevState.type)
  redrawGeojson()
  keepSelection()
  if (undoStack.length === 0) { hideUndoButton() }
}

export function redo() {
  // console.log('Redo from stack', redoStack)
  if (redoStack.length === 0) { console.warn('Redo stack empty'); return }
  const nextState = redoStack.pop()
  // console.log('Next state: ' + JSON.stringify(nextState))
  if (nextState.type === 'Feature update') {
    redoFeatureUpdate(nextState) 
  } else if (nextState.type === 'Feature property update') {
    redoFeatureUpdate(nextState)     
  } else if (nextState.type === 'Feature added') {
    redoFeatureAdded(nextState)    
  } else if (nextState.type === 'Feature deleted') {
    redoFeatureDelete(nextState)
  } else if (nextState.type === 'Track added') {
    redoFeatureAdded(nextState) 
  } else if (nextState.type === 'Track update') {
    redoFeatureUpdate(nextState)    
  } else {
    console.warn('Cannot redo ', nextState)
    return
  }
  status('Redo: ' + nextState.type)
  redrawGeojson()
  keepSelection()
  if (redoStack.length === 0) { hideRedoButton() }
}

function undoFeatureUpdate(prevState) {
  const idx = geojsonData.features.findIndex(f => f.id === prevState.state.id)
  if (idx !== -1) {
    addRedoState(prevState.type, geojsonData.features[idx])
    geojsonData.features[idx] = prevState.state
    resetDirections()
    mapChannel.send_message('update_feature', prevState.state)
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found in geojsonData')
  }
}

  function redoFeatureUpdate(nextState) {
  const idx = geojsonData.features.findIndex(f => f.id === nextState.state.id)
  if (idx !== -1) {
    addUndoState(nextState.type, geojsonData.features[idx], false)
    geojsonData.features[idx] = nextState.state
    resetDirections()
    mapChannel.send_message('update_feature', nextState.state)
  } else {
    console.warn('Feature with id ' + nextState.state.id + ' not found in geojsonData')
  }
}

function undoFeatureDelete(prevState) {
  const idx = geojsonData.features.findIndex(f => f.id === prevState.state.id)
  if (idx === -1) {
    addRedoState(prevState.type, prevState.state)
    addFeature(prevState.state)
    mapChannel.send_message('new_feature', prevState.state)
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' still present in geojsonData')
  }
}

function redoFeatureDelete(nextState) {
  const idx = geojsonData.features.findIndex(f => f.id === nextState.state.id)
  if (idx !== -1) {
    addUndoState(nextState.type, geojsonData.features[idx], false)
    destroyFeature(nextState.state.id)
    mapChannel.send_message('delete_feature', { id: nextState.state.id })
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found in geojsonData')
  }
}

function undoFeatureAdded(prevState) {
  const idx = geojsonData.features.findIndex(f => f.id === prevState.state.id)
  if (idx !== -1) {
    addRedoState(prevState.type, geojsonData.features[idx], false)
    destroyFeature(prevState.state.id)
    mapChannel.send_message('delete_feature', { id: prevState.state.id })
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found in geojsonData')
  }
}

function redoFeatureAdded(nextState) {
  const idx = geojsonData.features.findIndex(f => f.id === nextState.state.id)
  if (idx === -1) {
    addUndoState(nextState.type, nextState.state, false)
    addFeature(nextState.state)
    mapChannel.send_message('new_feature', nextState.state)
  } else {
    console.warn('Feature with id ' + nextState.state.id + ' still present in geojsonData')
  }
}

function undoTrackAdded(prevState) {
  const idx = geojsonData.features.findIndex(f => f.id === prevState.state.id)
  if (idx !== -1) {
    addRedoState(prevState.type, geojsonData.features[idx], false)
    destroyFeature(prevState.state.id)
    resetDirections()
    mapChannel.send_message('delete_feature', { id: prevState.state.id })
  } else {
    console.warn('Feature with id ' + prevState.state.id + ' not found in geojsonData')
  }
}

// keep feature selected
function keepSelection() {
  if (selectedFeature) {
    let geojsonFeature = geojsonData.features.find(f => f.id === selectedFeature.id)
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
