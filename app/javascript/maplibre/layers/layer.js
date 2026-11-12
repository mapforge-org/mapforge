import * as functions from 'helpers/functions'
import { status } from 'helpers/status'
import { flyToFeature } from 'maplibre/animations'
import { addCopyToLayerMenuItem, hideContextMenu } from 'maplibre/controls/context_menu'
import { draw } from 'maplibre/edit'
import {
  highlightFeature,
  highlightedFeatureId,
  highlightedFeatureSource,
  hoveredFeature,
  setHoveredFeature,
  stickyFeatureHighlight
} from 'maplibre/feature'
import { frontFeature, getFeature, layers } from 'maplibre/layers/layers'
import { addGeoJSONSource, map, noValidate } from 'maplibre/map'

// Source prefixes whose features are selectable via click. Excludes basemap
// vector features and raster layers (which handle their own clicks).
const SELECTABLE_SOURCE_PREFIXES = ['geojson-source-', 'tileset-', 'overpass-source-', 'wikipedia-source-',
  'search-source-']

// MapLibre queries a single pixel. A line drawn 2px wide at low zoom is almost unhittable,
// so retry with a small box when the exact pixel misses. The exact hit still wins, which
// keeps the top-most-feature rule intact. draw uses the same value as its clickBuffer.
export const CLICK_TOLERANCE = 8
// 15px radius = a 30px target for a fingertip
const CLICK_TOLERANCE_TOUCH = 15

export const isSelectable = f => SELECTABLE_SOURCE_PREFIXES.some(p => f.source.startsWith(p))

// keep: only these hits count, so a basemap feature under the cursor does not stop the box query
export function queryFeaturesNear (point, options, keep = () => true) {
  const exact = map.queryRenderedFeatures(point, options).filter(keep)
  if (exact.length) { return exact }
  const r = window.matchMedia('(pointer: coarse)').matches ? CLICK_TOLERANCE_TOUCH : CLICK_TOLERANCE
  const box = [[point.x - r, point.y - r], [point.x + r, point.y + r]]
  return map.queryRenderedFeatures(box, options).filter(keep)
}

// The front layers draw the hovered and the selected point on top, but they hold copies of all
// points in the original order, so the query still ranks these two at their old place.
const drawnInFront = f => (f.source === hoveredFeature?.source && f.id === hoveredFeature.id) ||
  (f.source === highlightedFeatureSource && f.id === highlightedFeatureId)

// Features of every selectable source near the point, top-most first
export function selectableFeaturesNear (point) {
  const features = queryFeaturesNear(point, { filter: ['!', ['has', 'cluster']], ...noValidate }, isSelectable)
    .filter(f => !f.properties?.cluster)
  return [...features.filter(drawnInFront), ...features.filter(f => !drawnInFront(f))]
}

function httpUrl (target) {
  try {
    const url = new URL(String(target), window.location.href)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

// Runs the 'onclick' link or feature jump of a feature in view mode, the description banner
// shares it. Returns false when the click should select the feature as usual.
export function runFeatureOnclickAction (feature) {
  const target = feature.properties?.['onclick-target']
  // the target comes from any editor of the map, a javascript: url would run in the viewer's session
  if (feature.properties?.onclick === 'link' && httpUrl(target)) {
    window.open(httpUrl(target), '_blank', 'noopener')
    return true
  }
  if (feature.properties?.onclick === 'feature' && target) {
    const targetFeature = getFeature(target)
    if (targetFeature) {
      flyToFeature(targetFeature)
    } else {
      console.error('Target feature with id ' + target + ' not found')
    }
    return true
  }
  return false
}

function selectFeatureOnClick (e) {
  if (draw && draw.getMode() !== 'simple_select') { return }
  if (window.gon.map_mode === 'static') { return }
  // Exit if another layer already selected a feature on this click
  if (e.defaultPrevented) { return }

  // queryRenderedFeatures returns features top-most first → visual z-order
  const selectable = selectableFeaturesNear(e.point)

  const isViewMode = window.gon.map_mode === 'ro' || e.originalEvent.shiftKey
  const clickable = isViewMode
    ? selectable.filter(f => f.properties?.onclick !== false)
    : selectable
  if (!clickable.length) { return }

  // Visual top = first in z-order (matches hover behavior)
  const visualTop = clickable[0]

  // Stable cycling order, deduped by id, independent of z-order reshuffling by frontFeature()
  const clickableStack = [...new Map(clickable.map(f => [f.id, f])).values()]
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))

  const currentIdx = clickableStack.findIndex(f => f.id === highlightedFeatureId)
  let feature
  if (!stickyFeatureHighlight || currentIdx === -1) {
    feature = visualTop                                   // fresh click → top feature
  } else {
    feature = currentIdx === clickableStack.length - 1    // re-click → advance cycle
      ? clickableStack[0]
      : clickableStack[currentIdx + 1]
  }

  if (isViewMode && runFeatureOnclickAction(feature)) { return }
  hideContextMenu()
  highlightFeature(feature, true, feature.source)
  // Defer the layer re-upload until after the browser paints the selection state —
  // frontFeature calls setData on the whole layer, which would otherwise stall feedback.
  requestAnimationFrame(() => frontFeature(feature))
  e.preventDefault()
}

// One query for all layers: a query per layer ran the full queryRenderedFeatures once per layer.
// No 'layers' option, like the click: MapLibre sorts 3D hits by depth only among the queried
// layers, so a query of some layers alone ignores the basemap buildings and picks another top.
const hoverFeatureOnMove = functions.perFrame((e) => {
  // a frame queued by perFrame() can run after a page visit replaced the map
  if (e.target !== map) { return }
  // a drawing mode keeps its own cursor
  const drawing = draw && draw.getMode() !== 'simple_select'
  // like a click, a feature that does nothing on click reacts only in edit mode
  const feature = drawing ? null : selectableFeaturesNear(e.point)
    .find(f => window.gon.map_mode !== 'ro' || f.properties?.onclick !== false)
  setHoveredFeature(feature)
})

// Registered map-wide, not per style layer: the delegated form only fires on an exact
// pixel hit, which would bypass the tolerance in queryFeaturesNear. The handlers query
// every selectable source and pick the global top feature, so one per map is enough.
// map.js binds them before any layer handler, and those skip a click prevented here.
export function bindFeatureSelection () {
  map.on('click', selectFeatureOnClick)
  // a touch laptop with a mouse still hovers, see dom.js
  if (functions.isTouchDevice() && !window.matchMedia('(hover: hover)').matches) { return }
  map.on('mousemove', hoverFeatureOnMove)
}

/**
 * Base class for map layers. A subclass overrides what its type needs:
 * - initialize(): Promise - apply styles and load data, runs again on each show
 * - loadData(): Promise - fetch data, set this.layer.geojson, call this.render()
 * - render(), createSource(), get sourceId(), cleanup() (call super.cleanup())
 * - setupEventHandlers(): call super first, then register map handlers with this.listen()
 * - description(feature): Promise<string> - loads the details modal description on
 *   demand. The modal shows a loading message until the promise resolves.
 */
export class Layer {
  constructor(layer) {
    this.layer = layer
    this.listeners = []
  }

  get id() {
    return this.layer.id
  }

  get type() {
    return this.layer.type
  }

  get name() {
    return this.layer.name
  }

  set name(value) {
    this.layer.name = value
  }

  get query() {
    return this.layer.query
  }

  set query(value) {
    this.layer.query = value
  }

  get show() {
    return this.layer.show
  }

  set show(value) {
    this.layer.show = value
  }

  get cluster() {
    return this.layer.cluster
  }

  set cluster(value) {
    this.layer.cluster = value
  }

  get heatmap() {
    return this.layer.heatmap
  }

  set heatmap(value) {
    this.layer.heatmap = value
  }

  get geojson() {
    // Initialize geojson defensively to prevent undefined.features errors
    if (!this.layer.geojson) {
      this.layer.geojson = { type: 'FeatureCollection', features: [] }
    }
    return this.layer.geojson
  }

  set geojson(value) {
    this.layer.geojson = value
  }

  get sourceId() {
    return `${this.type}-source-${this.id}`
  }

  /**
   * Credit for the data of this layer, shown in the attribution control of the map.
   * Null for a layer of user data, which needs no credit. A layer type that pulls data
   * from a third party overrides this with the credit that its license requires.
   */
  get attribution() {
    return null
  }

  // Called once per source, a visibility toggle reuses it
  createSource() {
    addGeoJSONSource(this.sourceId, this.clustered, this.attribution)
  }

  get clustered() {
    return !!this.layer.cluster && !this.layer.heatmap
  }

  initialize() {
    return Promise.resolve()
  }

  loadData() {
    return Promise.resolve(this.layer?.geojson)
  }

  // For the catch of a failed loadData(). Returns false, so the reload button stays open.
  loadFailed() {
    // return if layer is gone (likely page change)
    if (!layers || !layers.includes(this)) { return }
    status(window.__('Failed to load layer %{name}').replace('%{name}', functions.escapeHtml(this.layer.name)), 'error')
    // Set empty geojson so layer can still render
    this.layer.geojson = { type: 'FeatureCollection', features: [] }
    this.render()
    return false
  }

  render() {
    this.ensureFeaturePropertyIds()
    map.getSource(this.sourceId).setData(this.layer.geojson, false)
  }

  // Reorder this.layer.geojson.features to match orderedIds (feature id strings).
  // Features not in orderedIds keep their relative order and sort after listed ones.
  applyFeatureOrder(orderedIds) {
    const features = this.layer?.geojson?.features
    if (!orderedIds || !features) { return }
    this.layer.feature_order = orderedIds
    const rank = new Map(orderedIds.map((id, i) => [id, i]))
    features.sort((a, b) =>
      (rank.has(a.id) ? rank.get(a.id) : Infinity) - (rank.has(b.id) ? rank.get(b.id) : Infinity)
    )
  }

  ensureFeaturePropertyIds() {
    this.layer?.geojson?.features?.forEach((feature) => {
      feature.properties = feature.properties || {}
      feature.properties.id = feature.id
    })
  }

  // The caller already moved the feature to the end of this.layer.geojson.features.
  // A subclass can replace the full render with a cheaper source update.
  bringToFront(_feature) {
    this.render()
  }

  setupEventHandlers() {
    this.removeEventHandlers()
  }

  // map.on, undone by removeEventHandlers()
  listen(type, ...args) {
    this.listeners.push([type, ...args])
    map.on(type, ...args)
  }

  removeEventHandlers() {
    this.listeners.forEach(args => map?.off(...args))
    this.listeners = []
  }

  // Context menu entry that copies the feature under the cursor to a geojson layer
  listenForCopy() {
    this.listen('contextmenu', (e) => {
      e.preventDefault()
      const hit = map.queryRenderedFeatures(e.point, { layers: this.getStyleLayerIds() })
        .find(f => !f.properties?.cluster)
      if (hit) { addCopyToLayerMenuItem(this.copyableFeature(hit.id)) }
    })
  }

  copyableFeature(id) {
    return this.geojson.features.find(f => f.id === id)
  }

  getStyleLayerIds() {
    const sourceSuffix = '_' + this.sourceId
    return map.getLayersOrder().filter(id => id.endsWith(sourceSuffix))
  }

  cleanup() {
    this.removeEventHandlers()
  }

  // For highlight state of a layer beyond the global highlightedFeatureId
  clearHighlight() {}

  // 'ondemand': a map move shows the 'Load for this area' button
  reloadAfterMapMove() {
    return false
  }

  // overwrite all layer properties with data,
  // keep geojson if data does not include it
  update(data) {
    const geojson = this.layer.geojson
    Object.assign(this.layer, data)
    if (geojson && !data.geojson) {
      this.layer.geojson = geojson
    }
  }

  // JSON form of layer without geojson data to compare
  toJSON() {
    const { geojson: _geojson, ...rest } = this.layer
    return rest
  }
}
