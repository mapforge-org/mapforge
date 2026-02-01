import { initializeWikipediaLayers, loadWikipediaLayer } from 'maplibre/layers/wikipedia'
import { initializeOverpassLayers, loadOverpassLayer } from 'maplibre/overpass/overpass'
import { layers } from 'maplibre/map'

// initialize layers: create source, apply styles and load data
export function initializeLayers(id = null) {
  initializeOverpassLayers(id) 
  initializeWikipediaLayers(id)
}

export function loadLayer(id) {
  const layer = layers.find(f => f.id === id)
  if (layer.type === 'wikipedia') {
    return loadWikipediaLayer(id)
  } else if (layer.type === 'overpass') {
    return loadOverpassLayer(id)
  }
}