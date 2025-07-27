
import { geojsonData, redrawGeojson } from 'maplibre/map'
import { select, selectedFeature } from 'maplibre/edit'
import { showFeatureDetails } from 'maplibre/feature'

import { status } from 'helpers/status'

let undoStack = []
let redoStack = []

export function addUndoState(type, state) {
  // Deep clone to avoid mutation
  undoStack.push({ type: type, state: JSON.parse(JSON.stringify(state)) })
  console.log('Updated undo stack', undoStack)
  redoStack = []
}

function addRedoState(type, state) {
  // Deep clone to avoid mutation
  redoStack.push({ type: type, state: JSON.parse(JSON.stringify(state)) })
  console.log('Updated redo stack', redoStack)
}

export function undo() {
  // console.log('Undo from stack', undoStack)
  if (undoStack.length === 0) { console.warn('Undo stack empty'); return }
  const prevState = undoStack.pop()
  // console.log('Undo state: ' + JSON.stringify(prevState))
  if (prevState.type === 'Feature update') {
    undoFeatureUpdate(prevState)
  } else {
    console.warn('Cannot undo ', prevState)
    return 
  }
  status('Undo: ' + prevState.type)
  redrawGeojson()
  // keep feature selected
  if (selectedFeature) select(selectedFeature)
}

export function redo() {
  // console.log('Redo from stack', redoStack)
  if (redoStack.length > 0) {
    const nextState = redoStack.pop()
    // console.log('Next state: ' + JSON.stringify(nextState))
    const idx = geojsonData.features.findIndex(f => f.id === nextState.state.id)
    if (idx !== -1) {
      undoStack.push({ type: nextState.type, state: JSON.parse(JSON.stringify(geojsonData.features[idx])) })
      console.log('Updated undo stack', undoStack)
      geojsonData.features[idx] = nextState.state
      mapChannel.send_message('update_feature', nextState.state)
      status('Redo: ' + nextState.type)
      redrawGeojson()
      // keep feature selected
      if (selectedFeature) {
        let geojsonFeature = geojsonData.features.find(f => f.id === selectedFeature.id)
        showFeatureDetails(geojsonFeature)
        select(geojsonFeature)
        }
    } else {
      console.warn('Feature with id ' + nextState.state.id + ' not found in geojsonData')
    }
  }
}

function undoFeatureUpdate(prevState) {
  const idx = geojsonData.features.findIndex(f => f.id === prevState.state.id)
  if (idx !== -1) {
    addRedoState(prevState.type, geojsonData.features[idx])
    geojsonData.features[idx] = prevState.state
    mapChannel.send_message('update_feature', prevState.state)
    // keep feature selected
    if (selectedFeature) {
      let geojsonFeature = geojsonData.features.find(f => f.id === selectedFeature.id)
      showFeatureDetails(geojsonFeature)
      select(geojsonFeature)
    }
  } else {
    console.warn('Feature with id ' + nextState.state.id + ' not found in geojsonData')
  }
}