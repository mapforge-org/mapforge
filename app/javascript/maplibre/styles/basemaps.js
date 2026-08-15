import mlcontour from 'maplibre-contour'

// Default glyphs for Raster maps
// const openmaptilesGlyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'
const versatilesGlyphs = "https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf"
// const openfreemapGlyphs = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"

const testGlyphs = '/fonts/test/{fontstack}/{range}.pbf'

// fonts must be available via glyphs:
// openmaptiles: https://github.com/openmaptiles/fonts/tree/gh-pages
// maptiler: https://docs.maptiler.com/gl-style-specification/glyphs/
// versatiles: https://github.com/versatiles-org/versatiles-fonts/tree/main/fonts
// Emojis are not in the character range: https://github.com/maplibre/maplibre-gl-js/issues/2307
// The default font is defaults.font in styles/defaults.js
const defaultRasterLayer = [
  {
    id: 'simple-tiles',
    type: 'raster',
    source: 'raster-tiles'
  }
]
const host = new URL(window.location.href).origin

// provides caching for dem tiles used by 3d, hillshade + contour
// alternatives:
// url: "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png",
// url: "https://tiles.mapterhorn.com/tilejson.json",
// maptiler terrain tiles:
// url: 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=' + window.gon.map_keys.maptiler,
export let demSource = new mlcontour.DemSource({
  url: "https://tiles.versatiles.org/tiles/elevation/{z}/{x}/{y}",
  encoding: "terrarium",
  maxzoom: 13,
  worker: true, // offload isoline computation to a web worker to reduce jank
  cacheSize: 100, // number of most-recent tiles to cache
  timeoutMs: 10_000, // timeout on fetch requests
})

export let elevationSource = {
  type: 'raster-dem',
  //encoding: "terrarium",
  tiles: [
    demSource.sharedDemProtocolUrl
  ],
  tileSize: 512,
  maxzoom: 13,
  attribution: '© <a href="https://mapterhorn.com" target="_blank">Mapterhorn</a>'
}

// Regular font of the openmaptiles/maptiler glyph endpoints
const notoFont = 'Noto Sans Bold'
const versatilesFont = 'noto_sans_bold'

// A basemap can override any feature style default via 'defaults' (styles.js) and
// 'editDefaults' (edit_styles.js). See styles/defaults.js for the available keys.
//
// 'font' styles the label layers of mapforge, so it must be served by the glyph endpoint
// of the basemap. The labels of the basemap itself keep their own fonts. A basemap that
// wants them restyled sets 'applyFont: true' and declares 'font' + 'fontBold' + 'fontItalic'.
export function basemaps () {
  return {
    // Stadia maps
    stamenWatercolorTiles: {
      description: window.__('Artistic, hand-painted watercolor style with soft, muted colors and texture.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              // NOTE: Layers from Stadia Maps do not require an API key for localhost development or most production
              // web deployments. See https://docs.stadiamaps.com/authentication/ for details.
              'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg'
            ],
            tileSize: 256,
            maxzoom: 14,
            minzoom: 1.5,
            attribution: 'Map tiles by <a target="_blank" href="http://stamen.com">Stamen Design</a>; Hosting by <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>. Data &copy; <a href="https://www.openstreetmap.org/about" target="_blank">OpenStreetMap</a> contributors'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    stamenTonerTiles: {
      description: window.__('High-contrast black and white map, great for print or overlaying data.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              // NOTE: Layers from Stadia Maps do not require an API key for localhost development or most production
              // web deployments. See https://docs.stadiamaps.com/authentication/ for details.
              'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.jpg'
            ],
            tileSize: 256,
            attribution: 'Map tiles by <a target="_blank" href="http://stamen.com">Stamen Design</a>; Hosting by <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>. Data &copy; <a href="https://www.openstreetmap.org/about" target="_blank">OpenStreetMap</a> contributors'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },

    // free maps
    openTopoTiles: {
      description: window.__('Topographic map with contour lines, hillshading and terrain features.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
            // https://opentopomap.org/about#verwendung
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            maxzoom: 17,
            attribution: 'Kartendaten: © ' +
             '<a href="https://openstreetmap.org/copyright" target="_blank">OpenStreetMap-Mitwirkende</a> ' +
             'SRTM | Kartendarstellung: © ' +
             '<a href="http://opentopomap.org/" target="_blank">OpenTopoMap</a> ' +
             '<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">(CC-BY-SA)</a>'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    // osm vector: https://community.openstreetmap.org/t/vector-tiles-on-osmf-hardware/121501
    osmRasterTiles: {
      description: window.__('Classic OpenStreetMap raster tiles with roads, labels and points of interest.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a>'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    // other than OpenCycleMap, https://www.cyclosm.org is free and open source
    cyclosmTiles: {
      description: window.__('Bicycle-focused map highlighting cycle routes, paths and bike infrastructure.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            maxzoom: 17,
            attribution: '<a href="https://www.cyclosm.org/" title="CyclOSM - Open Bicycle render">CyclOSM</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a>'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    // https://manage.thunderforest.com/dashboard
    thunderforestCycle: {
      description: window.__('Thunderforest Cycle map with elevation contours and cycling infrastructure.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://api.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=' + window.gon.map_keys.thunderforest
            ],
            tileSize: 256,
            attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a>'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    thunderforestContrast: {
      description: window.__('High-contrast Thunderforest style optimized for outdoor and mobile use.'),
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://api.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png?apikey=' + window.gon.map_keys.thunderforest
            ],
            tileSize: 256,
            attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a>'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    satelliteStreets: { description: window.__('High-resolution satellite imagery overlaid with streets and place labels.'), style: host + '/layers/satellite_with_streets.json', defaults: { labelColor: '#fff', labelShadow: '#000' } },

    // basemap.de
    basemapWorld: {
      description: window.__('Official German basemap.de style with detailed European cartography.'),
      style: 'https://sgx.geodatenzentrum.de/gdz_basemapworld_vektor/styles/bm_web_wld_col.json', defaults: { font: notoFont }, sourceName: 'smarttiles_de' },

    // openfreemap.org
    openfreemapPositron: { description: window.__('Light, minimal grayscale style ideal for data visualization overlays.'), style: 'https://tiles.openfreemap.org/styles/positron', defaults: { font: notoFont } },
    openfreemapBright: { description: window.__('Bright, colorful vector style with clear roads and readable labels.'), style: 'https://tiles.openfreemap.org/styles/bright', defaults: { font: notoFont } },
    openfreemapLiberty: { description: window.__('Detailed vector map with landmarks, buildings and points of interest.'), style: 'https://tiles.openfreemap.org/styles/liberty', sourceName: 'openmaptiles', defaults: { font: notoFont } },

    // https://protomaps.com/api, themes: light, dark, white, grayscale, black
    protomapsLight: { description: window.__('Light Protomaps vector style with soft colors and clear labels.'), style: 'https://api.protomaps.com/styles/v5/light/en.json?key=' + window.gon.map_keys.protomaps, sourceName: 'protomaps', defaults: { font: notoFont } },

    // https://github.com/versatiles-org/versatiles-style
    // fonts: https://github.com/versatiles-org/versatiles-fonts
    versatilesColorful: { description: window.__('Colorful vector map with vivid colors and a clear road hierarchy.'), style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json', sourceName: 'versatiles-shortbread', defaults: { font: versatilesFont } },
    versatilesGraybeard: { description: window.__('Muted, monochrome vector style for a clean, distraction-free look.'), style: 'https://tiles.versatiles.org/assets/styles/graybeard/style.json', sourceName: 'versatiles-shortbread', defaults: { font: versatilesFont } },
    versatilesGraybeardSnow: { description: window.__('Muted Graybeard style with an added wintery, snow-covered terrain effect.'), style: host + '/layers/graybeard_snow.json', sourceName: 'versatiles-shortbread', defaults: { font: versatilesFont } },
    versatilesNeutrino: { description: window.__('Minimalist, neutral vector style with subtle colors and light labels.'), style: 'https://tiles.versatiles.org/assets/styles/neutrino/style.json', defaults: { font: versatilesFont } },
    versatilesEclipse: { description: window.__('Dark mode vector map style, easy on the eyes for night-time viewing.'), style: 'https://tiles.versatiles.org/assets/styles/eclipse/style.json', defaults: { labelColor: '#fff', labelShadow: '#000', font: versatilesFont } },
    // VersaTiles satellite imagery (alpha) composited with OpenFreeMap street/label overlay
    versatilesSatelliteStreets: { description: window.__('VersaTiles satellite imagery combined with street and label overlays.'), style: host + '/layers/versatiles_satellite_streets.json', defaults: { font: versatilesFont } },

    // Custom local styles using OpenMapTiles schema
    artistic: { description: window.__('Custom artistic map style with a unique, hand-crafted color palette.'), style: host + '/layers/artistic.json', sourceName: 'versatiles-shortbread', applyFont: true,
      // SUSE is not served by any glyph endpoint, maplibre renders it locally from the @font-face in fonts.css
      // Weight/style come from the first name of the stack ('bold' -> 700, 'italic'), second name is the family
      defaults: { labelColor: '#fff', labelShadow: '#6c9681', featureColor: '#6c9681', font: 'SUSE', fontBold: 'SUSE Bold, SUSE', fontItalic: 'SUSE Italic, SUSE' } },

    // Maptiler maps: https://docs.maptiler.com/sdk-js/api/map-styles/#mapstylelist
    // 3D Houses
    maptilerBasic: { description: window.__('Clean, minimal MapTiler style focused on readability and simplicity.'), style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerOpenStreetmap: { description: window.__("MapTiler's rendering of OpenStreetMap data in a familiar style."), style: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerBuildings: { description: window.__('Streets map highlighting detailed building footprints and 3D shapes.'), style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=' + window.gon.map_keys.maptiler, sourceName: 'maptiler_planet', defaults: { font: notoFont } },
    maptilerDataviz: { description: window.__('Neutral MapTiler style designed as a clean backdrop for data visualization.'), style: 'https://api.maptiler.com/maps/dataviz/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerStreets: { description: window.__('Classic MapTiler street map with roads, labels and points of interest.'), style: host + '/layers/streets.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerNoStreets: { description: window.__('MapTiler streets style with road labels removed for a cleaner look.'), style: host + '/layers/nostreets.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerSatellite: { description: window.__('High-resolution satellite imagery without any labels or overlays.'), style: 'https://api.maptiler.com/maps/satellite/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerWinter: { description: window.__('Winter-themed MapTiler style with snow-covered terrain and landscapes.'), style: 'https://api.maptiler.com/maps/winter-v2/style.json?key=' + window.gon.map_keys.maptiler, sourceName: 'maptiler_planet', defaults: { font: notoFont } },
    maptilerBike: { description: window.__('Cycling-focused MapTiler style highlighting bike routes and trails.'), style: 'https://api.maptiler.com/maps/64d03850-97e0-4aaa-bd1d-8287a9792de1/style.json?key=' + window.gon.map_keys.maptiler, sourceName: 'maptiler_planet', defaults: { font: notoFont } },
    maptilerHybrid: { description: window.__('Satellite imagery combined with street names and road labels overlay.'), style: 'https://api.maptiler.com/maps/hybrid/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },

  // static test tile
    test: {
      description: 'Static placeholder tile used for automated tests.',
      sourceName: 'raster-tiles',
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['/layers/test_tile.png'],
            tileSize: 1024
          }
        },
        layers: defaultRasterLayer,
        glyphs: testGlyphs
      }
    },
  // second static test tile for testing background map switch
    test2: {
      description: 'Second static placeholder tile used for background map switch tests.',
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['/layers/test_tile.png'],
            tileSize: 1024
          }
        },
        layers: defaultRasterLayer,
        glyphs: testGlyphs
      }
    }

  }
}
