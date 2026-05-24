import { debounce } from 'helpers/functions'
import { IndoorLevelControl } from 'maplibre/layers/indoor/control'
import { addIndoorLayers, getIndoorLayerIds } from 'maplibre/layers/indoor/styles'
import { Layer } from 'maplibre/layers/layer'
import { map, removeStyleLayers } from 'maplibre/map'

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
      tiles: [`https://tiles.indoorequal.org/tiles/{z}/{x}/{y}.pbf?key=${apiKey}`],
      minzoom: 0,
      maxzoom: 20,
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

    const levelFilter = ['==', ['get', 'level'], this.currentLevel]
    addIndoorLayers(this.sourceId, levelFilter)

    this.setupLevelDetection()

    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve()
  }

  render() {
    // No-op - vector tiles render automatically
  }

  setupEventHandlers() {
    // No-op - indoor features are not selectable like GeoJSON features
  }

  setLevel(level) {
    if (this.currentLevel === level) return

    this.currentLevel = level
    const levelFilter = ['==', ['get', 'level'], level]

    const layerIds = getIndoorLayerIds(this.sourceId)

    layerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setFilter(layerId, levelFilter)
      }
    })

    this.updateLevelControlUI()
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
