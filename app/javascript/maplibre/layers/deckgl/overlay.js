import { map } from 'maplibre/map'

let deckGLLoadPromise = null
let overlayInstance = null
let deckLayers = new Map()

/**
 * Lazy-loads deck.gl from CDN.
 * Returns a promise that resolves when deck.gl is loaded.
 */
export function loadDeckGL() {
  if (deckGLLoadPromise) return deckGLLoadPromise

  deckGLLoadPromise = new Promise((resolve, reject) => {
    if (window.deck) {
      resolve(window.deck)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/deck.gl/dist.min.js'
    script.onload = () => {
      if (window.deck) {
        console.log('deck.gl loaded from CDN')
        resolve(window.deck)
      } else {
        reject(new Error('deck.gl loaded but window.deck not found'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load deck.gl from CDN'))
    document.head.appendChild(script)
  })

  return deckGLLoadPromise
}

/**
 * Creates and returns the singleton MapboxOverlay instance.
 * Only one overlay per map is needed; all deck.gl layers share it.
 */
function getOverlay() {
  if (overlayInstance) return overlayInstance

  if (!window.deck) {
    throw new Error('deck.gl not loaded. Call loadDeckGL() first.')
  }

  overlayInstance = new window.deck.MapboxOverlay({
    interleaved: false,
    layers: []
  })

  console.log('Created deck.gl MapboxOverlay')
  return overlayInstance
}

/**
 * Ensures the overlay control is added to the MapLibre map.
 * Re-adds after basemap changes (map.setStyle removes all controls).
 */
export function ensureOverlayOnMap() {
  if (!overlayInstance) return
  if (!map) return

  const controls = map._controls || []
  const overlayAlreadyAdded = controls.includes(overlayInstance)

  if (!overlayAlreadyAdded) {
    map.addControl(overlayInstance)
    console.log('Added deck.gl overlay to map')
  }
}

/**
 * Registers or updates deck.gl layer(s) in the overlay.
 * Can accept a single layer or an array of layers.
 */
export function setDeckLayer(id, deckLayerOrArray) {
  deckLayers.set(id, deckLayerOrArray)
  refreshOverlay()
}

/**
 * Removes a deck.gl layer from the overlay.
 */
export function removeDeckLayer(id) {
  deckLayers.delete(id)
  refreshOverlay()
}

/**
 * Updates the overlay with all current deck.gl layers.
 */
export function refreshOverlay() {
  if (!overlayInstance) return

  const allLayers = []
  for (const layerOrArray of deckLayers.values()) {
    if (Array.isArray(layerOrArray)) {
      allLayers.push(...layerOrArray)
    } else {
      allLayers.push(layerOrArray)
    }
  }

  overlayInstance.setProps({ layers: allLayers })
  ensureOverlayOnMap()
  console.log('deck.gl overlay refreshed with', allLayers.length, 'layer(s)')
}

/**
 * Initialize overlay on first use and set up basemap/terrain change listeners.
 */
export async function initializeOverlay() {
  await loadDeckGL()
  getOverlay()
  ensureOverlayOnMap()

  // Re-add overlay after basemap changes
  map.on('style.load', () => {
    console.log('Basemap changed, re-adding deck.gl overlay')
    ensureOverlayOnMap()
  })

  // Force refresh when terrain changes
  // MapLibre GL v5 + deck.gl interleaved mode has known terrain conflicts
  let terrainWasActive = false
  map.on('render', () => {
    const terrainIsActive = map.getTerrain() !== null
    if (terrainIsActive !== terrainWasActive) {
      terrainWasActive = terrainIsActive
      console.log('Terrain toggled, refreshing deck.gl overlay')
      setTimeout(() => {
        refreshOverlay()
      }, 100)
    }
  })
}
