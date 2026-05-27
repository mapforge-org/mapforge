import { debounce } from 'helpers/functions'
import { highlightFeature, resetHighlightedFeature } from 'maplibre/feature'
import { IndoorLevelControl } from 'maplibre/layers/indoor/control'
import { addIndoorLayers, getIndoorLayerIds, indoorFillColor } from 'maplibre/layers/indoor/styles'
import { Layer } from 'maplibre/layers/layer'
import { map, removeStyleLayers, updateBuildingOpacity } from 'maplibre/map'

export class IndoorLayer extends Layer {
  constructor(layer) {
    super(layer)
    this.currentLevel = '0'
    this.levels = []
    this.levelControl = null
    this.idleHandler = null
    this.initialTimeout = null
  }

  get show() {
    return this.layer.show
  }

  set show(value) {
    this.layer.show = value
    if (this.levelControl) {
      value ? this.levelControl.show() : this.levelControl.hide()
    }
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
    this.removeLevelControl()

    if (!map.getSource(this.sourceId)) {
      console.warn('Indoor layer: source not available, skipping layer initialization')
      this.layer.show = false
      return Promise.resolve()
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

      const feature = e.features?.[0]
      if (!feature) return

      console.log('Indoor feature clicked:', feature)
      console.log('Feature id:', feature.id, 'Source:', this.sourceId)

      feature.properties.label = feature.properties.name || feature.properties.class
      feature.properties.desc = indoorDescription(feature.properties)

      const sourceLayer = feature.layer['source-layer'] || feature.sourceLayer
      console.log('Source layer:', sourceLayer)
      highlightFeature(feature, false, this.sourceId, sourceLayer)
    }

    map.on('click', this.getStyleLayerIds(), this.clickHandler)
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
    this.updateLevelControlUI()
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
    if (this.levels.length > 0) {
      if (!this.levelControl) {
        this.createLevelControl()
      }
      this.updateLevelControlUI()
    } else {
      this.removeLevelControl()
    }
    updateBuildingOpacity()
  }

  createLevelControl() {
    this.levelControl = new IndoorLevelControl(this.id, (level) => {
      this.setLevel(level)
    })
    this.levelControl.create()
  }

  updateLevelControlUI() {
    if (!this.levelControl) return
    this.levelControl.update(this.levels, this.currentLevel)
  }

  removeLevelControl() {
    if (this.levelControl) {
      this.levelControl.remove()
      this.levelControl = null
    }
  }

  cleanup() {
    this.removeLevelDetection()
    this.removeLevelControl()
    super.cleanup()
  }
}

function indoorDescription(props) {
  const skipKeys = ['name', 'label', 'desc']

  let desc = '\n<div class="overpass-data-table">\n'
  desc += '|               |               |\n'
  desc += '| ------------- | ------------- |\n'

  const keys = Object.keys(props).filter(key => !skipKeys.includes(key))
  keys.forEach(key => {
    desc += `| **${key}** | ${props[key]} |\n`
  })

  desc += '\n</div>\n'

  if (props['id']) {
    desc += '\n![osm link](/icons/osm-icon-small.png)'
    desc += '[See node in OpenStreetMap](https://www.openstreetmap.org/' + props['id'].replace(':', '/') + ')'
  }

  return desc
}
