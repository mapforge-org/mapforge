import { debounce, e, featureId } from 'helpers/functions'
import { detectLevels, getActiveLevel } from 'maplibre/controls/levels'
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature'
import { addIndoorLayers, getIndoorLayerIds, indoorFillColor } from 'maplibre/layers/indoor/styles'
import { Layer } from 'maplibre/layers/layer'
import { map, removeStyleLayers, updateBuildingOpacity } from 'maplibre/map'

export class IndoorLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.currentLevel = '0'
    this.levels = []
    this.idleHandler = null
    this.initialTimeout = null
    this.contextMenuHandler = null
  }

  get show() {
    return this.layer.show
  }

  set show(value) {
    this.layer.show = value
    if (value) {
      this.setupLevelDetection()
    } else {
      this.removeLevelDetection()
    }
  }

  createSource() {
    const apiKey = window.gon?.map_keys?.indoorequal
    if (!apiKey) {
      console.warn('Indoor Equal API key not found in window.gon.map_keys.indoorequal')
      return
    }

    if (map.getSource(this.sourceId)) {
      console.log('Indoor layer: source ' + this.sourceId + ' already exists, skipping add')
      return
    }

    console.log('Indoor layer: creating source with API key')
    map.addSource(this.sourceId, {
      type: 'vector',
      tiles: [`https://tiles.indoorequal.org/tiles/{z}/{x}/{y}.pbf?key=${encodeURIComponent(apiKey)}`],
      minzoom: 0,
      maxzoom: 20,
      promoteId: { area: 'id', transportation: 'id', poi: 'id' },
      attribution: '© <a href="https://indoorequal.org/" target="_blank">Indoor Equal</a>'
    })
  }

  initialize() {
    console.log('Indoor layer: initializing with level', this.currentLevel)
    removeStyleLayers(this.sourceId)
    this.removeLevelDetection()

    if (!map.getSource(this.sourceId)) {
      console.warn('Indoor layer: source not available, skipping layer initialization')
      this.layer.show = false
      return Promise.resolve()
    }

    // Use active level from shared control if available
    const activeLevel = getActiveLevel()
    if (activeLevel) {
      this.currentLevel = activeLevel
    }

    const levelFilter = ['==', ['to-string', ['get', 'level']], this.currentLevel]
    addIndoorLayers(this.sourceId, levelFilter)

    this.updateFillPaint()
    this.setupLevelDetection()
    this.setupEventHandlers()

    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve()
  }

  render() {
    // No-op - vector tiles render automatically
  }

  setupEventHandlers() {
    this.removeEventHandlers()

    this.clickHandler = (e) => {
      if (window.gon.map_mode !== 'rw') return
      // Exit if another layer already selected a feature on this click
      if (e.defaultPrevented) return

      const feature = e.features?.[0]
      if (!feature) return

      console.log('Indoor feature clicked:', feature)
      console.log('Feature id:', feature.id, 'Source:', this.sourceId)

      feature.properties.label = feature.properties.name || feature.properties.class
      feature.properties.desc = indoorDescription(feature.properties)

      const sourceLayer = feature.layer['source-layer'] || feature.sourceLayer
      console.log('Source layer:', sourceLayer)
      highlightFeature(feature, false, this.sourceId, sourceLayer)
      e.preventDefault()
    }

    map.on('click', this.getStyleLayerIds(), this.clickHandler)

    this.contextMenuHandler = (e_event) => {
      e_event.preventDefault()
      const queryLayerIds = this.getStyleLayerIds()
      const features = map.queryRenderedFeatures(e_event.point, { layers: queryLayerIds })

      if (features.length && window.gon.map_mode === 'rw') {
        const feature = features[0]
        const geojsonFeature = {
          type: 'Feature',
          geometry: feature.geometry,
          properties: { ...feature.properties }
        }
        geojsonFeature.id = geojsonFeature.properties.id = featureId()
        delete geojsonFeature.properties.label
        delete geojsonFeature.properties.desc

        // Store in this layer's geojson so getFeature(id, 'indoor') can find it
        this.geojson.features = [geojsonFeature]

        e('#map-context-menu', el => {
          if (el.querySelector('[data-action*="addToGeojsonLayer"]')) { return }
          el.classList.remove('hidden')
          const copyButton = document.createElement('div')
          copyButton.classList.add('context-menu-item')
          copyButton.innerHTML = '<i class="bi bi-copy me-1"></i>Copy to my layer'
          copyButton.dataset.action = 'click->map--context-menu#addToGeojsonLayer'
          copyButton.dataset.featureId = geojsonFeature.id
          copyButton.dataset.layerType = 'indoor'
          el.appendChild(copyButton)
        })
      }
    }

    map.on('contextmenu', this.contextMenuHandler)
  }

  removeEventHandlers() {
    super.removeEventHandlers()
    if (this.contextMenuHandler) {
      map.off('contextmenu', this.contextMenuHandler)
      this.contextMenuHandler = null
    }
  }

  setLevel(level) {
    if (this.currentLevel === level) return

    resetHighlightedFeature()
    this.currentLevel = level
    const levelFilter = ['==', ['to-string', ['get', 'level']], level]

    const layerIds = getIndoorLayerIds(this.sourceId)

    layerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, levelFilter)
      }
    })

    this.updateFillPaint()
  }

  updateFillPaint() {
    const fillLayerId = `indoor-area-fill_${this.sourceId}`
    if (!map.getLayer(fillLayerId)) return

    if (parseFloat(this.currentLevel) >= 1) {
      map.setPaintProperty(fillLayerId, 'fill-color', [
        'case',
        ['boolean', ['feature-state', 'active'], false], '#b3d9ff',
        'gray'
      ])
      map.setPaintProperty(fillLayerId, 'fill-opacity', 0.7)
    } else {
      map.setPaintProperty(fillLayerId, 'fill-color', [
        'case',
        ['boolean', ['feature-state', 'active'], false], '#b3d9ff',
        indoorFillColor
      ])
      map.setPaintProperty(fillLayerId, 'fill-opacity', 0.9)
    }
  }

  setupLevelDetection() {
    this.removeLevelDetection()

    if (this.show === false) return
    if (!map.getSource(this.sourceId)) return

    this.idleHandler = () => {
      debounce(() => {
        // Query source features directly to get ALL levels, not just currently filtered ones
        const levelSet = new Set()

        try {
          const features = map.querySourceFeatures(this.sourceId, {
            sourceLayer: 'area'
          })
          // console.log(`${features.length} indoor features in current view`)

          features.forEach(feature => {
            const level = feature.properties?.level
            if (level !== undefined && level !== null) {
              levelSet.add(String(level))
            }
          })
        } catch (e) {
          // Source might not be loaded yet
          console.log('Indoor layer: source not ready for querying', e.message)
          return
        }

        const newLevels = Array.from(levelSet).sort((a, b) => parseFloat(b) - parseFloat(a))

        if (JSON.stringify(newLevels) !== JSON.stringify(this.levels)) {
          this.levels = newLevels
          // console.log('Indoor layer: detected levels', newLevels)
          this.updateLevelControl()
        } else if (this.levels.length > 0 && !this.levelControl) {
          // Recreate control if it was removed (e.g., layer was hidden then shown)
          this.updateLevelControl()
        }
      }, `indoor-level-${this.id}`, 500)
    }

    map.on('idle', this.idleHandler)
    this.initialTimeout = setTimeout(() => this.idleHandler(), 500)
  }

  removeLevelDetection() {
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout)
      this.initialTimeout = null
    }
    if (this.idleHandler) {
      map.off('idle', this.idleHandler)
      this.idleHandler = null
    }
  }

  updateLevelControl() {
    // Notify shared level control system about available levels
    detectLevels()
    updateBuildingOpacity()
  }

  cleanup() {
    this.removeLevelDetection()
    super.cleanup()
  }
}

function indoorDescription(props) {
  const skipKeys = ['name', 'label', 'desc']

  let desc = '\n'
  desc += '|               |               |\n'
  desc += '| ------------- | ------------- |\n'

  const keys = Object.keys(props).filter(key => !skipKeys.includes(key))
  keys.forEach(key => {
    desc += `| **${key}** | ${props[key]} |\n`
  })

  desc += '\n'

  if (props['id']) {
    desc += '\n![osm link](/icons/osm-icon-small.png)'
    desc += '[See node in OpenStreetMap](https://www.openstreetmap.org/' + props['id'].replace(':', '/') + ')'
  }

  return desc
}
