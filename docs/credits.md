# Credits

*"Standing on the shoulders of giants"*

Mapforge wouldn't exist without the great open source projects from the mapping community. This page gives credit to the software, open data, and web services used.

## Fonts and icons

Mapforge includes the fonts and the icon sets below.

| Project | Used for | License |
| ------- | -------- | ------- |
| [Bree Serif](https://fonts.google.com/specimen/Bree+Serif) | headline font | OFL 1.1, © TypeTogether |
| [Lobster Two](https://fonts.google.com/specimen/Lobster+Two) | display font | OFL 1.1, © Pablo Impallari |
| [SUSE](https://github.com/SUSE/suse-font) | interface font | OFL 1.1, © The SUSE Project Authors |
| [Bootstrap Icons](https://icons.getbootstrap.com/) | interface icons | MIT |
| [Maki](https://github.com/mapbox/maki) | map symbols | CC0 |
| [Temaki](https://github.com/rapideditor/temaki) | map symbols | CC0 |
| [Font Awesome Free](https://fontawesome.com/) | map symbols | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| [Noto Emoji](https://github.com/googlefonts/noto-emoji) | emoji symbols | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0), © Google Inc. |

Mapforge changed some of these files. It converted the Maki, Temaki, and Font Awesome icons from SVG to PNG images of 72 pixels, and it removed their color. Only the solid style of Font Awesome Free is included.

## Software libraries

| Project | Used for | License |
| ------- | -------- | ------- |
| [Ruby on Rails](https://rubyonrails.org/) | web framework | MIT |
| [MongoDB](https://www.mongodb.com/) | database server | SSPL 1.0 |
| [Mongoid](https://github.com/mongodb/mongoid) | database access | MIT |
| [Redis](https://redis.io/) | message bus for the WebSocket updates | AGPL 3.0 or RSAL 2.0 |
| [Puma](https://puma.io/) | web server | BSD-3-Clause |
| [Haml](https://haml.info/) | templates | MIT |
| [Redcarpet](https://github.com/vmg/redcarpet) | server-side markdown | MIT |
| [Dragonfly](https://github.com/markevans/dragonfly) | image uploads | MIT |
| [ImageMagick](https://imagemagick.org/) | image processing | [ImageMagick License](https://imagemagick.org/script/license.php) |
| [RGeo](https://github.com/rgeo/rgeo) | geometry on the server | BSD-3-Clause |
| [Turbo and Stimulus](https://hotwired.dev/) | browser interaction | MIT |
| [Bootstrap](https://getbootstrap.com/) | page layout | MIT |
| [MapLibre GL JS](https://maplibre.org/) | map rendering | BSD-3-Clause |
| [Mapbox GL Draw](https://github.com/mapbox/mapbox-gl-draw) | drawing features | ISC |
| [MapLibre GL Geocoder](https://github.com/maplibre/maplibre-gl-geocoder) | search box | ISC |
| [MapLibre GL Directions](https://github.com/maplibre/maplibre-gl-directions) | route drawing | MIT |
| [maplibre-contour](https://github.com/onthegomap/maplibre-contour) | contour lines | BSD-3-Clause |
| [Turf.js](https://turfjs.org/) | geometry in the browser | MIT |
| [togeojson](https://github.com/placemark/togeojson) | KML and GPX import | BSD-2-Clause |
| [openrouteservice-js](https://github.com/GIScience/openrouteservice-js) | routing requests | Apache 2.0 |
| [Chart.js](https://www.chartjs.org/) | elevation chart | MIT |
| [emoji-mart](https://github.com/missive/emoji-mart) | symbol picker | MIT |
| [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) | text editor | MIT |
| [marked](https://github.com/markedjs/marked) | markdown in js | MIT |
| [SortableJS](https://github.com/SortableJS/Sortable) | reorder layers | MIT |
| [Swiper](https://swiperjs.com/) | image galleries | MIT |
| [AOS](https://github.com/michalsnik/aos) | scroll animations | MIT |
| [exif-reader](https://github.com/devongovett/exif-reader) | image coordinates | MIT |

`Gemfile` and `config/importmap.rb` in the source of Mapforge list every dependency.

## Map data and tiles

Most maps in Mapforge show data from OpenStreetMap. The OpenStreetMap contributors license this
data under the [Open Database License](https://www.openstreetmap.org/copyright) (ODbL). The map
shows the credit for the active basemap in the corner of the map.

| Provider | Used for | License or terms |
| -------- | -------- | ---------------- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | map data for most basemaps and layers | ODbL |
| [OpenTopoMap](https://opentopomap.org/) | topographic basemap | CC BY-SA 3.0 |
| [CyclOSM](https://www.cyclosm.org/) | bicycle basemap | open, hosted by OpenStreetMap France |
| [Stamen Design](http://stamen.com/) | watercolor and toner basemaps | CC BY 4.0, hosted by [Stadia Maps](https://stadiamaps.com/) |
| [OpenFreeMap](https://openfreemap.org/) | vector basemaps | open |
| [VersaTiles](https://versatiles.org/) | vector basemaps, fonts, satellite | open |
| [basemap.de](https://basemap.de/) | world basemap, by the German BKG | open data |
| [Esri](https://www.esri.com/) | satellite imagery, with Maxar and Earthstar Geographics | Esri terms |
| [OpenSnowMap](https://www.opensnowmap.org/) | ski piste overlay | CC BY-SA |
| [Waymarked Trails](https://waymarkedtrails.org/) | hiking and cycling route overlays | open |
| [Mapterhorn](https://mapterhorn.com/) | elevation data for terrain and contour lines | open |
| [Protomaps](https://protomaps.com/) | basemap, needs a key | commercial terms |
| [IndoorEqual](https://indoorequal.org/) | indoor maps, needs a key | commercial terms |

## Services and APIs

Mapforge sends requests to the services below when you use the matching feature.

| Service | Used for |
| ------- | -------- |
| [Photon](https://photon.komoot.io/) by Komoot | place search, from OpenStreetMap data |
| [Overpass API](https://overpass-api.de/) | queries for OpenStreetMap data layers |
| [openrouteservice](https://openrouteservice.org/) by HeiGIT | routing and elevation |
| [Wikipedia](https://www.wikipedia.org/) | text and images of the Wikipedia layer, CC BY-SA |
| [OpenStreetMap API](https://www.openstreetmap.org/) | import of a single OpenStreetMap element |
| [Deutsche Bahn Timetables API](https://developers.deutschebahn.com/) | live train positions |
| [MaxMind GeoLite2](https://www.maxmind.com/) | approximate start position from the IP address, see the note below |
| [Umami](https://umami.is/) | usage statistics, enabled on mapforge.org |

Mapforge.org uses GeoLite2 data created by MaxMind, available from [https://www.maxmind.com](https://www.maxmind.com).

When you sign in with GitHub, Google, or OpenStreetMap,  Mapforge sends your login request to that provider.

## License texts

The MIT, BSD, ISC, Apache 2.0, and OFL licenses require the copyright notice and the license text in every copy. The file `THIRD-PARTY-LICENSES.md` holds the notice and the license text of every project above.
