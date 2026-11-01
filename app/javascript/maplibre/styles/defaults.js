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
  // ring outside a selected feature, which leaves its own size, color and opacity as they are
  haloColor: '#fbb03b',
  haloWidth: 3,
  haloOpacityHover: 0.4, // the feature under the mouse, a click shows the full halo

  extrusionOpacity: 0.9,
  extrusionCornerRadius: 0.5, // meters
  extrusionPixelZoom: 16.8, // zoom where a 1 m line extrusion is one pixel tall, a 10 m one at 13.5
  extrudedShadowColor: 'gray',
  extrudedShadowOpacity: 0.7,
  extrudedShadowOpacityActive: 0.4,
  extrusionActiveShade: 0.6, // factor on the color channels of a selected extrusion

  lineWidth: 2,
  routeWidth: 3,
  lineOpacity: 0.8,
  polygonOutlineWidth: 2,
  lineDashArray: [1, 1.5],

  pointSize: 3,
  pointSizeEmoji: 18,
  pointSizeImage: 20,
  pointSizePlain: 5,
  pointOutlineSize: 2,
  pointOpacity: 0.9,
  pointOpacitySymbol: 1,
  pointBlur: 0.05,
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
  vertexOutlineWidth: 2
}

// How far the glyphs of a font sit above those of the fontnik build, in em. VersaTiles builds
// its glyphs higher (the top of an 'H' at -6 of 24 instead of -9), the 1/16 em is measured.
export const glyphShift = font => (font.startsWith('noto_sans_') ? 1 / 16 : 0)

export const defaults = { ...baseDefaults }
export const editDefaults = { ...baseEditDefaults }

// Size a point falls back to when it has no explicit 'marker-size'.
// Keep the branch order in sync with pointSizeMax() in styles.js, which is what the map renders.
export function defaultPointSize (feature) {
  // a pin or a square at the plain default is too small to recognize
  if ((feature.properties['marker-shape'] || 'circle') !== 'circle') { return defaults.pointSizeEmoji }
  // an image covers a symbol
  if (feature.properties['marker-image-url']) { return defaults.pointSizeImage }
  if (feature.properties['marker-symbol']) { return defaults.pointSizeEmoji }
  return defaults.pointSizePlain
}

// Width a line falls back to when it has no explicit 'stroke-width'.
// Keep in sync with lineWidthDefault() in styles.js, which is what the map renders.
export function defaultLineWidth (feature) {
  return feature.properties.route ? defaults.routeWidth : defaults.lineWidth
}

// Re-applies the base values first, so keys overridden by the previous basemap
// get reset instead of leaking into the new one.
export function applyBasemapDefaults (basemap) {
  Object.assign(defaults, baseDefaults, basemap.defaults)
  Object.assign(editDefaults, baseEditDefaults, basemap.editDefaults)
}
