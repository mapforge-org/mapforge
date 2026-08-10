// Default values for feature styles. Each basemap in basemaps.js can override any
// of these via its 'defaults' / 'editDefaults' keys, e.g. to invert label colors
// on a dark basemap.
//
// Read these at style build time (inside styles() / editStyles()), never at module
// load time: applyBasemapDefaults mutates them on every basemap change.

// fonts must be available via glyphs, see basemaps.js
// fontBold and fontItalic are only used for the labels of a basemap that opts
// into the font transform with 'applyFont: true'. versatiles glyphs have no italic
// variant, so fontItalic is null here and the transform falls back to font.
const baseDefaults = {
  font: 'noto_sans_regular',
  fontBold: 'noto_sans_bold',
  fontItalic: null,

  labelColor: '#000',
  labelShadow: '#fff',
  labelShadowWidth: 2,
  labelSize: 16,
  labelAnchor: 'top', // top: text under point
  labelLetterSpacing: 0,
  labelMaxWidth: 10,
  labelLineHeight: 1.6,
  labelTitleScale: 1.3,

  lineLabelSize: 14,
  lineLabelSpacing: 200,
  lineLabelMaxAngle: 30,

  featureColor: '#0A870A', // green
  featureOutlineColor: '#444444',
  featureOutlineColorActive: '#000',

  extrusionOpacity: 0.9,
  extrusionCornerRadius: 0.5, // meters
  extrudedShadowColor: 'gray',
  extrudedShadowOpacity: 0.7,
  extrudedShadowOpacityActive: 0.4,

  lineWidth: 3,
  lineOpacity: 0.8,
  lineOpacityActive: 1,
  polygonOutlineWidth: 2,
  lineDashArray: [1, 1.5],
  lineHitPadding: 10,

  pointSize: 3,
  pointSizeEmoji: 18,
  pointSizeImage: 20,
  pointSizePlain: 5,
  pointOutlineSize: 2,
  pointOpacity: 0.9,
  pointOpacitySymbol: 1,
  pointBlur: 0.05,
  pointHitPadding: 5,
  markerSize: 20,

  minZoom: 0,
  maxZoom: 24,
  sortKey: 1,

  heatmapOpacity: 0.7,
  heatmapIntensity: 1.3,
  heatmapRadius: 17,

  clusterRadius: 12,
  clusterLabelSize: 15,
  clusterLabelColor: '#000',
  clusterLabelShadow: '#fff',
  clusterLabelShadowWidth: 2
}

const baseEditDefaults = {
  highlightColor: '#fbb03b',

  vertexSize: 6,
  activeLineDashArray: [0.2, 2],
  activeLineWidth: 5,

  midpointSize: 6,
  midpointColor: 'grey',
  midpointOpacity: 0.8,
  midpointOutlineColor: '#ffffff',
  midpointOutlineWidth: 1,

  inactivePointColor: '#c0c0c0',
  inactivePointOpacity: 0.2,

  activePointSizeFactor: 2,
  activePointColor: '#ffffff',
  activePointOpacity: 0.2,
  activePointOutlineWidth: 4,
  vertexOutlineColor: '#444',
  vertexOutlineWidth: 2,

  routeVertexSize: 4,
  routeVertexColor: 'grey',
  routeVertexOpacity: 0.7,
  routeVertexBorderColor: '#ffffff',
  routeVertexBorderWidth: 1
}

export const defaults = { ...baseDefaults }
export const editDefaults = { ...baseEditDefaults }

// Re-applies the base values first, so keys overridden by the previous basemap
// get reset instead of leaking into the new one.
export function applyBasemapDefaults (basemap) {
  Object.assign(defaults, baseDefaults, basemap.defaults)
  Object.assign(editDefaults, baseEditDefaults, basemap.editDefaults)
}
