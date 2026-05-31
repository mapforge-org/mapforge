import { LevelControl } from 'maplibre/controls/level_control'
import { layers, renderLayers } from 'maplibre/layers/layers'

// Active level (single selection shared across all layer types)
let activeLevel = null

// Available levels across all visible layers (indoor + GeoJSON)
let availableLevels = []

// The level control UI instance (shared across all layer types)
let levelControl = null

/**
 * Initialize active level from URL query parameter (?level=0)
 * Called once on page load in map.js
 */
export function initLevelFromURL() {
  const urlParams = new URLSearchParams(window.location.search)
  const levelParam = urlParams.get('level')

  if (levelParam) {
    activeLevel = levelParam.trim()
  }
}

/**
 * Get the current active level.
 */
export function getActiveLevel() {
  return activeLevel
}

/**
 * Filter GeoJSON features by active level.
 * Returns features that either:
 * - Don't have a level property (always visible)
 * - Have a level matching the active level
 *
 * If no level is active, returns all features unfiltered.
 */
export function filterFeaturesByLevel(features) {
  if (!features || !activeLevel) {
    return features
  }

  return features.filter(feature => {
    const featureLevel = feature.properties?.level

    // Features without level property are always visible
    if (featureLevel === undefined || featureLevel === null) {
      return true
    }

    // Check if feature's level matches active level
    return String(featureLevel) === activeLevel
  })
}

/**
 * Detect available levels across all visible layers (indoor + GeoJSON).
 * Updates the level control UI based on what's available.
 * Does NOT trigger re-renders (prevents infinite loops).
 */
export function detectLevels() {
  if (!layers) return

  const levelSet = new Set()

  // Scan all visible layers for level properties
  layers
    .filter(layer => layer.show !== false)
    .forEach(layer => {
      if (layer.type === 'geojson') {
        // Scan GeoJSON features
        layer.geojson?.features?.forEach(feature => {
          const level = feature.properties?.level
          if (level !== undefined && level !== null) {
            levelSet.add(String(level))
          }
        })
      } else if (layer.type === 'indoor') {
        // Get levels from indoor layer
        if (layer.levels && Array.isArray(layer.levels)) {
          layer.levels.forEach(level => levelSet.add(String(level)))
        }
      }
    })

  const newLevels = Array.from(levelSet).sort((a, b) => parseFloat(b) - parseFloat(a))

  // If levels changed, update the control
  if (JSON.stringify(newLevels) !== JSON.stringify(availableLevels)) {
    availableLevels = newLevels
    updateLevelControl()
  }
}

/**
 * Set the active level and trigger re-render/re-filter.
 * Updates URL state and re-renders all layers that support levels.
 */
export function setLevel(level) {
  activeLevel = String(level)

  // Update URL
  syncLevelToURL()

  // Update control UI
  updateLevelControlUI()

  // Update indoor layers (they use map.setFilter)
  layers
    .filter(layer => layer.type === 'indoor' && layer.show !== false)
    .forEach(layer => {
      if (typeof layer.setLevel === 'function') {
        layer.setLevel(activeLevel)
      }
    })

  // Trigger re-render of GeoJSON layers (they filter in render())
  renderLayers('geojson', false)
}

/**
 * Update level control based on available levels.
 * Creates, updates, or removes the control as needed.
 */
function updateLevelControl() {
  if (availableLevels.length > 0) {
    // Ensure we have an active level
    if (!activeLevel) {
      // Default to '0' if available, otherwise the first available level
      activeLevel = availableLevels.includes('0') ? '0' : availableLevels[0]
      syncLevelToURL()
    } else if (!availableLevels.includes(activeLevel)) {
      // Active level from URL is not available, fall back to default
      activeLevel = availableLevels.includes('0') ? '0' : availableLevels[0]
      syncLevelToURL()
    }

    if (!levelControl) {
      createLevelControl()
    }
    updateLevelControlUI()
  } else {
    removeLevelControl()
    activeLevel = null
  }
}

/**
 * Create the level control UI.
 */
function createLevelControl() {
  levelControl = new LevelControl('shared-levels', (level) => {
    setLevel(level)
  }, 'level-control')
  levelControl.create()
}

/**
 * Update the level control UI with current levels and selection.
 */
function updateLevelControlUI() {
  if (!levelControl) return
  levelControl.update(availableLevels, activeLevel)
}

/**
 * Remove the level control UI.
 */
function removeLevelControl() {
  if (levelControl) {
    levelControl.remove()
    levelControl = null
  }
}

/**
 * Sync active level to URL query parameter.
 */
function syncLevelToURL() {
  const url = new URL(window.location.href)

  if (activeLevel) {
    url.searchParams.set('level', activeLevel)
  } else {
    url.searchParams.delete('level')
  }

  window.history.replaceState({}, '', url.toString())
}

/**
 * Reset all level state and remove control.
 * Called when navigating away from a map.
 */
export function resetLevels() {
  removeLevelControl()
  activeLevel = null
  availableLevels = []
}
