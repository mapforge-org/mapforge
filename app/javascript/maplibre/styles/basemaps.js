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

// The attribution control drops a duplicate only when the string matches byte for byte, so
// every source that shows OpenStreetMap data must credit it with this exact text. The static
// styles in public/layers/ carry a copy of it.
export const osmAttribution =
  'Data <a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'

// Thunderforest requires credit for the map style, not only for the OpenStreetMap data
const thunderforestAttribution =
  'Maps <a href="https://www.thunderforest.com/" target="_blank">© Thunderforest</a>, ' + osmAttribution

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
      description: window.__('Map that looks like a watercolor painting'), source: 'Stamen',
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
            attribution: 'Map tiles by <a target="_blank" href="http://stamen.com">Stamen Design</a>; ' +
              'Hosting by <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>. ' + osmAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    stamenTonerTiles: {
      description: window.__('Black and white map, good for printing'), source: 'Stamen',
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
            attribution: 'Map tiles by <a target="_blank" href="http://stamen.com">Stamen Design</a>; ' +
              'Hosting by <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>. ' + osmAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },

    // free maps
    openTopoTiles: {
      description: window.__('Hiking map with height lines and hill shadows'), source: 'OpenTopoMap',
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
            attribution: 'Maps © ' +
             '<a href="http://opentopomap.org/" target="_blank">OpenTopoMap</a> ' +
             '<a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank">(CC-BY-SA)</a>, ' +
             'SRTM, ' + osmAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    // osm vector: https://community.openstreetmap.org/t/vector-tiles-on-osmf-hardware/121501
    osmRasterTiles: {
      description: window.__('Standard OpenStreetMap with roads and places'), source: 'OpenStreetMap',
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: osmAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    // other than OpenCycleMap, https://www.cyclosm.org is free and open source
    cyclosmTiles: {
      description: window.__('Bicycle map with cycle paths and bike routes'), source: 'CyclOSM',
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
            attribution: 'Maps <a href="https://www.cyclosm.org/" target="_blank">© CyclOSM</a>, ' + osmAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    // https://manage.thunderforest.com/dashboard
    thunderforestCycle: {
      description: window.__('Bicycle map with cycle routes and height lines'), source: 'Thunderforest',
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://api.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=' + window.gon.map_keys.thunderforest
            ],
            tileSize: 256,
            attribution: thunderforestAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    thunderforestContrast: {
      description: window.__('Outdoor map with strong colors, easy to read outside'), source: 'Thunderforest',
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://api.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png?apikey=' + window.gon.map_keys.thunderforest
            ],
            tileSize: 256,
            attribution: thunderforestAttribution
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    satelliteStreets: { description: window.__('Satellite photos with street names and places'), source: 'Esri', style: host + '/layers/satellite_with_streets.json', defaults: { labelColor: '#fff', labelShadow: '#000', font: versatilesFont } },

    // basemap.de
    basemapWorld: {
      description: window.__('Detailed street map in the style of official German maps'), source: 'basemap.de',
      style: 'https://sgx.geodatenzentrum.de/gdz_basemapworld_vektor/styles/bm_web_wld_col.json', defaults: { font: notoFont }, sourceName: 'smarttiles_de' },

    // openfreemap.org
    openfreemapPositron: { description: window.__('Plain light gray map, your own data stands out'), source: 'OpenFreeMap', style: 'https://tiles.openfreemap.org/styles/positron', defaults: { font: notoFont } },
    openfreemapBright: { description: window.__('Bright street map with clear roads and labels'), source: 'OpenFreeMap', style: 'https://tiles.openfreemap.org/styles/bright', defaults: { font: notoFont } },
    openfreemapLiberty: { description: window.__('Detailed street map with buildings and landmarks'), source: 'OpenFreeMap', style: 'https://tiles.openfreemap.org/styles/liberty', sourceName: 'openmaptiles', defaults: { font: notoFont } },

    // https://protomaps.com/api, themes: light, dark, white, grayscale, black
    protomapsLight: { description: window.__('Light street map with soft colors'), source: 'Protomaps', style: 'https://api.protomaps.com/styles/v5/light/en.json?key=' + window.gon.map_keys.protomaps, sourceName: 'protomaps', defaults: { font: notoFont } },

    // https://github.com/versatiles-org/versatiles-style
    // fonts: https://github.com/versatiles-org/versatiles-fonts
    versatilesColorful: { description: window.__('Colorful street map for everyday use'), source: 'VersaTiles', style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json', sourceName: 'versatiles-shortbread', defaults: { font: versatilesFont } },
    versatilesGraybeard: { description: window.__('Gray map in calm colors, your own data stands out'), source: 'VersaTiles', style: 'https://tiles.versatiles.org/assets/styles/graybeard/style.json', sourceName: 'versatiles-shortbread', defaults: { font: versatilesFont } },
    versatilesGraybeardSnow: { description: window.__('Winter map with snow on the mountains'), source: 'VersaTiles', style: host + '/layers/graybeard_snow.json', sourceName: 'versatiles-shortbread', defaults: { font: versatilesFont } },
    versatilesNeutrino: { description: window.__('Plain map with soft colors and few labels'), source: 'VersaTiles', style: 'https://tiles.versatiles.org/assets/styles/neutrino/style.json', defaults: { font: versatilesFont } },
    versatilesEclipse: { description: window.__('Dark map, easy on the eyes at night'), source: 'VersaTiles', style: 'https://tiles.versatiles.org/assets/styles/eclipse/style.json', defaults: { labelColor: '#fff', labelShadow: '#000', font: versatilesFont } },
    // VersaTiles satellite imagery (alpha) composited with OpenFreeMap street/label overlay
    versatilesSatelliteStreets: { description: window.__('Satellite photos with street names and places'), source: 'VersaTiles', style: host + '/layers/versatiles_satellite_streets.json', defaults: { font: versatilesFont } },

    // Custom local styles using OpenMapTiles schema
    artistic: { description: window.__('Map with its own hand-picked colors'), source: 'Mapforge', style: host + '/layers/artistic.json', sourceName: 'versatiles-shortbread', applyFont: true,
      // SUSE is not served by any glyph endpoint, maplibre renders it locally from the @font-face in fonts.css
      // Weight/style come from the first name of the stack ('bold' -> 700, 'italic'), second name is the family
      defaults: { labelColor: '#fff', labelShadow: '#6c9681', featureColor: '#6c9681', font: 'SUSE Bold, SUSE', fontBold: 'SUSE Bold, SUSE', fontItalic: 'SUSE Italic, SUSE' } },

    // Maptiler maps: https://docs.maptiler.com/sdk-js/api/map-styles/#mapstylelist
    // 3D Houses
    maptilerBasic: { description: window.__('Plain, easy to read street map'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerOpenStreetmap: { description: window.__('Street map in the familiar OpenStreetMap look'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerBuildings: { description: window.__('Street map with 3D buildings'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=' + window.gon.map_keys.maptiler, sourceName: 'maptiler_planet', defaults: { font: notoFont } },
    maptilerDataviz: { description: window.__('Plain map, your own data stands out'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/dataviz/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerStreets: { description: window.__('Street map with roads and places'), source: 'MapTiler', style: host + '/layers/streets.json', defaults: { font: notoFont } },
    maptilerNoStreets: { description: window.__('Street map without street names'), source: 'MapTiler', style: host + '/layers/nostreets.json', defaults: { font: notoFont } },
    maptilerSatellite: { description: window.__('Satellite photos without labels'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/satellite/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },
    maptilerWinter: { description: window.__('Winter map with snow and ski slopes'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/winter-v2/style.json?key=' + window.gon.map_keys.maptiler, sourceName: 'maptiler_planet', defaults: { font: notoFont } },
    maptilerBike: { description: window.__('Bicycle map with bike routes and trails'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/64d03850-97e0-4aaa-bd1d-8287a9792de1/style.json?key=' + window.gon.map_keys.maptiler, sourceName: 'maptiler_planet', defaults: { font: notoFont } },
    maptilerHybrid: { description: window.__('Satellite photos with street names'), source: 'MapTiler', style: 'https://api.maptiler.com/maps/hybrid/style.json?key=' + window.gon.map_keys.maptiler, defaults: { font: notoFont } },

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
            attribution: 'Test tiles',
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
