import { center } from "@turf/center"
import { coordEach } from "@turf/meta"
import * as f from 'helpers/functions'
import { resetControls } from 'maplibre/controls/shared'
import { showFeatureDetails } from 'maplibre/feature/details'
import { getFeatureSource, layers } from "maplibre/layers/layers"
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'

export let highlightedFeatureId
export let highlightedFeatureSource
let highlightedSourceLayer = null
export let stickyFeatureHighlight = false

export function featureTitle (feature) {
  const title = feature?.properties?.title || feature?.properties?.user_title ||
    feature?.properties?.label || feature?.properties?.user_label ||
    feature?.properties?.name || feature?.properties?.user_name
  return title || ''
}

// A marker image that is drawn on the fly is a name of a map image, not a url, and an
// img tag cannot show it. See maplibre/styles/circle_image.js
const isImageUrl = url => !!url && (url.startsWith('/') || url.startsWith('http'))

// A route profile is short ('bike', 'car', 'foot') or an openrouteservice one ('cycling-road')
function routeKind (feature) {
  const profile = feature.properties?.route?.profile
  if (!profile) { return null }
  if (profile === 'bike' || profile.includes('cycling')) { return 'bike' }
  if (profile === 'car' || profile.includes('driving')) { return 'car' }
  if (profile.includes('foot')) { return 'foot' }
  return null
}

const routeIcons = { bike: 'bi-bicycle', car: 'bi-car-front', foot: 'bi-person-walking' }

// set title image according to feature type
// A long feature list loads its images lazily. A single icon that replaces another one must
// not: a lazy image stays blank until an async viewport check, so it flickers even from cache.
export function featureIcon (feature, { link = true, lazy = true } = {}) {
  let image = ''
  let iconColor = feature.properties['marker-color'] || feature.properties['fill'] || feature.properties['stroke'] || defaults.featureColor
  if (iconColor === 'transparent') { iconColor = '#c0c0c0' }
  iconColor = f.escapeHtml(iconColor)
  let iconColorStyle = `style='color: ${iconColor};'`
  const loading = lazy ? "loading='lazy' " : ''
  if (isImageUrl(feature.properties['marker-image-url'])) {
    const markerImageUrl = feature.properties['marker-image-url']
    const imageHref = markerImageUrl.startsWith('/icon') ? markerImageUrl.replace('/icon', '/image') : markerImageUrl
    const img = `<img ${loading}class='feature-details-icon' src='${f.escapeHtml(markerImageUrl)}'>`
    image = link ? `<a target='_blank' href='${f.escapeHtml(imageHref)}'>${img}</a>` : img
  } else if (feature.properties['marker-symbol']) {
    const outlineColor = f.escapeHtml(feature.properties['stroke'] || defaults.featureOutlineColor)
    image = `<img ${loading}class='feature-details-icon marker-circle' ` +
      `style='background-color: ${iconColor}; border-color: ${outlineColor};' ` +
      `src='${f.escapeHtml(f.symbolUrl(feature.properties['marker-symbol']))}'>`
  } else if (feature.properties['stroke-image-url']) {
    image = `<img ${loading}class='feature-details-icon' src='${f.escapeHtml(feature.properties['stroke-image-url'])}'>`
  } else if (routeKind(feature)) {
    image = `<i class='bi ${routeIcons[routeKind(feature)]} fs-3' ${iconColorStyle}></i>`
  } else if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
    image = `<i class='bi bi-signpost fs-3' ${iconColorStyle}></i>`
  } else if (feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon") {
    image = `<i class='bi bi-bounding-box-circles fs-3' ${iconColorStyle}></i>`
  } else if (feature.geometry.type === "Point") {
    image = `<i class='bi bi-record-circle fs-3' ${iconColorStyle}></i>`
  }
  return image
}

export function getFeatureTypeName(feature) {
  if (!feature?.geometry?.type) { return window.__('Feature') }
  if (feature.geometry.type === 'LineString') {
    switch (routeKind(feature)) {
      case 'bike': return window.__('Bicycle route')
      case 'car': return window.__('Car route')
      case 'foot': return window.__('Hiking route')
    }
  }
  switch (feature.geometry.type) {
    case 'Point': return window.__('Point')
    case 'LineString': return window.__('Line')
    case 'Polygon': return window.__('Polygon')
    default: return feature.geometry.type
  }
}

// type name plus the feature title, for status messages: "Point 'Cafe'"
export function featureLabel (feature) {
  const title = featureTitle(feature)
  const type = getFeatureTypeName(feature)
  return title ? `${type} '${f.escapeHtml(title)}'` : type
}

// move a feature so that its center sits on the given position
export function moveFeatureTo(feature, lngLat) {
  const [ lng, lat ] = center(feature).geometry.coordinates
  coordEach(feature, coord => {
    coord[0] += lngLat.lng - lng
    coord[1] += lngLat.lat - lat
  })
}

// a feature of a vector tile layer needs its sourceLayer, a geojson feature has none
function setActive (source, id, sourceLayer, active) {
  const stateParams = { source, id }
  if (sourceLayer) { stateParams.sourceLayer = sourceLayer }
  map.setFeatureState(stateParams, { active })
}

export function resetHighlightedFeature () {
  if (highlightedFeatureId && map.getSource(highlightedFeatureSource)) {
    setActive(highlightedFeatureSource, highlightedFeatureId, highlightedSourceLayer, false)
  }
  if (highlightedFeatureId) {
    highlightedFeatureSource = null
    highlightedFeatureId = null
    highlightedSourceLayer = null
    // drop feature param from url
    const url = new URL(window.location.href)
    if (url.searchParams.get('f')) {
      url.searchParams.delete('f')
      window.history.replaceState({}, document.title, url.toString())
    }
  }
  stickyFeatureHighlight = false
  // Clear layer-specific highlight state
  layers?.forEach(layer => layer.clearHighlight())
  // reset active modals
  f.e('#feature-details-modal', e => { e.classList.remove('show') })
}

// For highlighting features from vector layers, we need to track their sourceLayer.
export function highlightFeature (feature, sticky = false, source, sourceLayer = null) {
  // Only reset if there's a different feature currently highlighted
  if (highlightedFeatureId && highlightedFeatureId !== feature.id) { resetHighlightedFeature() }

  // Close any open modals (settings, layers, share) when initially selecting a feature
  // Don't reset when:
  // - cycling through overlaying features (highlightedFeatureId already set), OR
  // - context menu is currently being shown (right-click interaction)
  const contextMenuVisible = !document.querySelector('#map-context-menu')?.classList.contains('hidden')
  if (!highlightedFeatureId && !contextMenuVisible) {
    resetControls()
  }

  if (!source) { source = getFeatureSource(feature.id) }
  stickyFeatureHighlight = sticky
  highlightedFeatureId = feature.id
  highlightedFeatureSource = source
  highlightedSourceLayer = sourceLayer
  // load feature from source, the style only returns the dimensions on screen
  const sourceFeature = layers
    .filter(l => Array.isArray(l.geojson?.features))
    .flatMap(layer => layer.geojson.features)
    .find(f => f.id === feature.id)

  showFeatureDetails(sourceFeature || feature)

  // Set feature state for both GeoJSON and vector tile features
  if (feature.id != null) { setActive(source, feature.id, sourceLayer, true) }

  // URL persistence only for GeoJSON features (vector tile IDs are not stable across sessions)
  if (sourceFeature && sticky) {
    const newPath = `${window.location.pathname}?f=${feature.id}${window.location.hash}`
    window.history.pushState({}, '', newPath)
  }
}
