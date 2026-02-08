import { map } from 'maplibre/map'
import { initializeViewStyles, initializeClusterStyles, styles, featureColor, labelFont, setSource } from 'maplibre/styles/styles'
import { layers } from 'maplibre/layers/layers'
import { draw, select } from 'maplibre/edit'
import { getFeature } from 'maplibre/layers/layers'
import { renderExtrusionLines } from 'maplibre/feature'
import { lineString } from "@turf/helpers"
import { length } from "@turf/length"
import { along } from "@turf/along"

export function initializeGeoJSONLayers(id = null) {
  // console.log('Initializing geojson layers')
  let initLayers = layers.filter(l => l.type === 'geojson')
  if (id) { initLayers = initLayers.filter(l => l.id === id) }

  initLayers.forEach((layer) => {
    initializeViewStyles('geojson-source-' + layer.id, !!layer.heatmap)
    if (!!layer.cluster) { initializeClusterStyles('geojson-source-' + layer.id, null) }

    initializeKmMarkerStyles(layer.id)
    renderGeoJSONLayer(layer.id)
  })

  map.fire('geojson.load', { detail: { message: 'geojson source + styles loaded' } })
}

export function renderGeoJSONLayers(resetDraw = true) {
  layers.filter(l => l.type === 'geojson').forEach((layer) => {
    renderGeoJSONLayer(layer.id, resetDraw)
  })
}

export function renderGeoJSONLayer(id, resetDraw = true) {
  let layer = layers.find(l => l.id === id)
  console.log("Redraw: Setting source data for geojson layer", layer)

  // this + `promoteId: 'id'` is a workaround for the maplibre limitation:
  // https://github.com/mapbox/mapbox-gl-js/issues/2716
  // because to highlight a feature we need the id,
  // and in the style layers it only accepts mumeric ids in the id field initially
  // TODO: only needed once, not each render
  layer.geojson.features.forEach((feature) => { feature.properties.id = feature.id })
  renderKmMarkersLayer(id)
  // - For LineStrings with a 'fill-extrusion-height', add a polygon to render extrusion
  let extrusionLines = renderExtrusionLines()
  let geojson = { type: 'FeatureCollection', features: layer.geojson.features.concat(extrusionLines) }

  map.getSource(layer.type + '-source-' + layer.id).setData(geojson, false)

  // draw has its own style layers based on editStyles
  if (draw) {
    if (resetDraw) {
      // This has a performance drawback over draw.set(), but some feature
      // properties don't get updated otherwise
      // API: https://github.com/mapbox/mapbox-gl-draw/blob/main/docs/API.md  
      const drawFeatureIds = draw.getAll().features.map(feature => feature.id)
      draw.deleteAll()

      drawFeatureIds.forEach((featureId) => {
        let feature = getFeature(featureId, "geojson")
        if (feature) {
          draw.add(feature)
          // if we're in edit mode, re-select feature
          select(feature)
        }
      })
    }
  }
}

export function renderKmMarkersLayer(id) {
   let layer = layers.find(l => l.id === id)
  
  let kmMarkerFeatures = []
  layer.geojson.features.filter(feature => (feature.geometry.type === 'LineString' &&
    feature.properties['show-km-markers'] &&
    feature.geometry.coordinates.length >= 2)).forEach((f, index) => {

    const line = lineString(f.geometry.coordinates)
    const distance = length(line, { units: 'kilometers' })
    // Create markers at useful intervals
    let interval = 1
      for (let i = 0; i < Math.ceil(distance) + interval; i += interval) {
      // Get point at current kilometer
      const point = along(line, i, { units: 'kilometers' })
      point.properties['marker-color'] = f.properties['stroke'] || featureColor
      point.properties['marker-size'] = 11
      point.properties['marker-opacity'] = 1
      point.properties['km'] = i

      if (i >= Math.ceil(distance)) {
        point.properties['marker-size'] = 14
        point.properties['km'] = Math.round(distance)
        if (Math.ceil(distance) < 100) { 
          point.properties['km'] = Math.round(distance * 10) / 10
        }
        point.properties['km-marker-numbers-end'] = 1
        point.properties['sort-key'] = 2 + index
      }
      kmMarkerFeatures.push(point)
    }  
  })

  let markerFeatures = {
        type: 'FeatureCollection',
        features: kmMarkerFeatures
      }
  map.getSource('km-marker-source-' + id).setData(markerFeatures)
}

function makePointsLayer(divisor, minzoom, maxzoom = 24) {
  const base = { ...styles()['points-layer'] }
  return {
    ...base,
    id: `km-marker-points-${divisor}`,
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom
  }
}

function makeNumbersLayer(divisor, minzoom, maxzoom=24) {
  return {
    id: `km-marker-numbers-${divisor}`,
    type: 'symbol',
    filter: ["==", ["%", ["get", "km"], divisor], 0],
    minzoom,
    maxzoom,
    layout: {
      'text-allow-overlap': false,
      'text-field': ['get', 'km'],
      'text-size': 11,
      'text-font': labelFont,
      'text-justify': 'center',
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ffffff'
    }
  }
}

export function kmMarkerStyles (_id) {
  let layers = []
  const base = { ...styles()['points-layer'] }

  layers.push(makePointsLayer(2, 11))
  layers.push(makeNumbersLayer(2, 11))

  layers.push(makePointsLayer(5, 10, 11))
  layers.push(makeNumbersLayer(5, 10, 11))

  layers.push(makePointsLayer(10, 9, 10))
  layers.push(makeNumbersLayer(10, 9, 10))

  layers.push(makePointsLayer(25, 8, 9))
  layers.push(makeNumbersLayer(25, 8, 9))

  layers.push(makePointsLayer(50, 7, 8))
  layers.push(makeNumbersLayer(50, 7, 8))

  layers.push(makePointsLayer(100, 5, 7))
  layers.push(makeNumbersLayer(100, 5, 7))
  
  // end point has different style 
  layers.push({
    ...base,
    id: `km-marker-points-end`,
    filter: ["==", ["get", "km-marker-numbers-end"], 1]
  })
  layers.push({
    id: `km-marker-numbers-end`,
    type: 'symbol',
    filter: ["==", ["get", "km-marker-numbers-end"], 1],
    layout: {
      'text-allow-overlap': true,
      'text-field': ['get', 'km'],
      'text-size': 12,
      'text-font': labelFont,
      'text-justify': 'center',
      'text-anchor': 'center'
    },
    paint: {
      'text-color': '#ffffff'
    }
  })

  return layers
}

export function initializeKmMarkerStyles(id) {
  kmMarkerStyles(id).forEach(style => { 
    style = setSource (style, 'km-marker-source-' + id)
    map.addLayer(style) 
  })
}