import mlcontour from 'maplibre-contour'

// Default glyphs for Raster maps
// const openmaptilesGlyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'
const versatilesGlyphs = "https://tiles.versatiles.org/assets/glyphs/{fontstack}/{range}.pbf"
// const openfreemapGlyphs = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"

const testGlyphs = 'fonts/test/{fontstack}/{range}.pbf'

// fonts must be available via glyphs:
// openmaptiles: https://github.com/openmaptiles/fonts/tree/gh-pages
// maptiler: https://docs.maptiler.com/gl-style-specification/glyphs/
// versatiles: https://github.com/versatiles-org/versatiles-fonts/tree/main/fonts
// Emojis are not in the character range: https://github.com/maplibre/maplibre-gl-js/issues/2307
export const defaultFont = 'noto_sans_regular'
const defaultRasterLayer = [
  {
    id: 'simple-tiles',
    type: 'raster',
    source: 'raster-tiles',
    minzoom: 1.4,
    maxzoom: 18
  }
]
const host = new URL(window.location.href).origin

// provides caching for dem tiles used by 3d, hillshade + contour
export let demSource = new mlcontour.DemSource({
  url: "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png",
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
    // From https://registry.opendata.aws/terrain-tiles/, Mapzen terrain tiles
    // 'https://s3.amazonaws.com/elevation-tiles-prod/normal/{z}/{x}/{y}.png'
    demSource.sharedDemProtocolUrl
  ],
  // maptiler terrain tiles:
  // url: 'https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=' + window.gon.map_keys.maptiler,
  tileSize: 256,
  maxzoom: 13
}

export function basemaps () {
  return {
    // Stadia maps
    stamenWatercolorTiles: {
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
            attribution: 'Map tiles by <a target="_blank" href="http://stamen.com">Stamen Design</a>; Hosting by <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a>. Data &copy; <a href="https://www.openstreetmap.org/about" target="_blank">OpenStreetMap</a> contributors'
          }
        },
        layers: [{ ...defaultRasterLayer[0], maxzoom: 14 }],
        glyphs: versatilesGlyphs
      }
    },
    stamenTonerTiles: {
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
    satelliteTiles: {
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Powered by Esri, ' +
          'Sources: Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },
    osmRasterTiles: {
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
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://b.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '<a href="https://www.cyclosm.org/" title="CyclOSM - Open Bicycle render">CyclOSM</a> | <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap Contributors</a>'
          }
        },
        layers: defaultRasterLayer,
        glyphs: versatilesGlyphs
      }
    },

    // openfreemap.org
    openfreemapPositron: { style: 'https://tiles.openfreemap.org/styles/positron', font: 'Noto Sans Regular' },
    openfreemapBright: { style: 'https://tiles.openfreemap.org/styles/bright', font: 'Noto Sans Regular' },
    openfreemapLiberty: { style: 'https://tiles.openfreemap.org/styles/liberty', font: 'Noto Sans Regular' },

    // https://github.com/versatiles-org/versatiles-style
    // fonts: https://github.com/versatiles-org/versatiles-fonts
    versatilesColorful: { style: 'https://tiles.versatiles.org/assets/styles/colorful/style.json', font: 'noto_sans_regular' },
    versatilesGraybeard: { style: 'https://tiles.versatiles.org/assets/styles/graybeard/style.json', font: 'noto_sans_regular' },
    versatilesNeutrino: { style: 'https://tiles.versatiles.org/assets/styles/neutrino/style.json', font: 'noto_sans_regular' },
    versatilesEclipse: { style: 'https://tiles.versatiles.org/assets/styles/eclipse/style.json', font: 'noto_sans_regular' },

    // Maptiler maps: https://docs.maptiler.com/sdk-js/api/map-styles/#mapstylelist
    // 3D Houses
    maptilerBasic: { style: 'https://api.maptiler.com/maps/basic-v2/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerOpenStreetmap: { style: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerBuildings: { style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerDataviz: { style: 'https://api.maptiler.com/maps/dataviz/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerStreets: { style: host + '/layers/streets.json?key=' + window.gon.map_keys.maptiler },
    maptilerNoStreets: { style: host + '/layers/nostreets.json?key=' + window.gon.map_keys.maptiler },
    maptilerSatellite: { style: 'https://api.maptiler.com/maps/satellite/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerWinter: { style: 'https://api.maptiler.com/maps/winter-v2/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerBike: { style: 'https://api.maptiler.com/maps/64d03850-97e0-4aaa-bd1d-8287a9792de1/style.json?key=' + window.gon.map_keys.maptiler },
    maptilerHybrid: { style: 'https://api.maptiler.com/maps/hybrid/style.json?key=' + window.gon.map_keys.maptiler },

  // static test tile
    test: {
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
