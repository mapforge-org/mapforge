[![Tests](https://github.com/digitaltom/mapforge/actions/workflows/ci.yml/badge.svg)](https://github.com/digitaltom/mapforge/actions/workflows/ci.yml)
[![Docker](https://github.com/digitaltom/mapforge/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/digitaltom/mapforge/actions/workflows/docker-publish.yml)
[![Code Climate](https://api.codeclimate.com/v1/badges/b56fa0cb960a90502022/maintainability)](https://codeclimate.com/github/digitaltom/mapforge)
[![Coverage Status](https://coveralls.io/repos/github/digitaltom/mapforge/badge.svg?branch=main)](https://coveralls.io/github/digitaltom/mapforge?branch=main)
[![Depfu](https://badges.depfu.com/badges/6ce6b9e47406d4ca01b1192d11b464de/overview.svg)](https://depfu.com/github/mapforge-org/mapforge?project_id=39818)

# README

Mapforge is an open source (Ruby on Rails) web application that lets you create and share geojson layers on top of different base maps. It uses [maplibre gl](https://maplibre.org/maplibre-gl-js/docs/) as map library and supports desktop and mobile views. Your browser is connected to the server via websockets, so all changes are immediately visible to all clients for collaborative editing or creating real-time maps.

A reference installation is running at [mapforge.org](https://mapforge.org), see the [changelog](CHANGELOG.md) here.

![Mapforge Screenshot](https://github.com/digitaltom/mapforge/blob/main/docs/screenshot.png?raw=true)

GeoJSON layers can get styled to your needs using an extended version of the [geojson](https://macwright.com/2015/03/23/geojson-second-bite.html)
[mapbox simplestyle spec](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0). See [docs/geojson.md](docs/geojson.md) for supported attributes.

[Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) layers can get added to the map, allowing for custom queries and display 
of all possible OpenStreetMap nodes. Read more about that in the [overpass doc](docs/overpass.md).
 
## Development Setup
 
### Install dependencies:

For openSUSE (Debian package names in braces):

```bash
zypper in proj-devel # (libproj-dev) for building rgeo-proj4
zypper in proj # (proj-bin) for running rgeo-proj4
zypper in imlib2 imlib2-devel # (libimlib2, libimlib2-dev) to resize screenshots
zypper in ImageMagick # (imagemagick) for dragonfly image processing
zypper in npm # for running eslint
bundle
```

To resolve users' client IPs to coordinates for centering new maps at their 
location, please download the [Maxmind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/) database and save it at `db/GeoLite2-City.mmdb`.

### Run develoment server:

`bin/thrust rails server`

* To use routing features provided by [openrouteservice.org](https://openrouteservice.org/), set env OPENROUTESERVICE_KEY
* MongoDB backend is expected at: `ENV.fetch("MONGO_URL") { "localhost:27017" }`
  You can run a local MongoDB like this: `docker run -d --name mongo -v <local db folder>:/data/db -p 27017:27017 mongo:7.0`
* Redis (for action cable) is expected at: `ENV.fetch("REDIS_URL") { "redis://localhost:6379/1" }`
* To allow login via Github and Google, create oauth apps there, and set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
* The first user that logs in automatically gets set as admin
* The default base map can get set with `DEFAULT_MAP`

In development, the ENV vars can get set in the file `.env.development`.

### Base maps

Available base maps can get customized in `app/javascript/maplibre/basemaps.js`.

## Rake tasks

* Import map from a mapforge export:

  `bin/rake seed:mapforge_file['db/seeds/examples/fosdem.json']`

* Import map from geojson (samples in db/seeds):

  `bin/rake seed:geojson_file['db/seeds/examples/germany_areas.geojson']`

  More geojson example files at: https://exploratory.io/map

* Take screenshots of updated maps for preview:

  `bin/rake maps:screenshots` (use MAPFORGE_HOST to set the host)

* Animate a marker along a line: `bin/rake animation:path[<map_id>, <line_id>, <point_id>]`


## Tests

Linters:
  * `bin/rubocop`
  * `npm install; npm run lint:css; npm run lint:js`

Fix style with eslint: `npm run fix:js`

To run the test suite: `bundle exec rspec`

The repository is also covered with automatic Github Actions jobs. You can
run those locally with the tool [act](https://github.com/nektos/act).
For example `act -j test`.


## Production Setup

### Container image

Github builds a new container on each commit to `main` at: `ghcr.io/mapforge-org/mapforge:main`. Or, you can build your own image with: `podman build -t mapforge .`.

Before running the container, make sure the services MongoDB (`podman run -d --name mongo -v <local_dir>:/data/db -p 27017:27017 mongo:7.0`) and Redis (`podman run -d --name redis -p 6379:6379 redis`) are running.

Now, you can run the image with: `podman run -e SECRET_KEY_BASE=e3c9f2... -e DEVELOPER_LOGIN_ENABLED=true --network=host ghcr.io/mapforge-org/mapforge:main` (the container expects to be running behind SSL termination like Traefik. Use `-e RAILS_ENV=development` for a test run without SSL)

The Maxmind IP database cat get mounted to the container with: 
`-v /path/on/host/GeoLite2-City.mmdb:/rails/db/GeoLite2-City.mmdb`

### Android App

Mapforge is build as a PWA (progressive web app, see [tutorial](docs/tutorials/pwa_app.md)). An Android app wrapping the pwa and is available in the Android [app store](https://play.google.com/store/apps/details?id=org.mapforge.twa). 

To build the Android app with [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), run: 

```
npm install -g @bubblewrap/cli
# init is only needed on the first run
bubblewrap init --manifest=http://localhost:3000/manifest.json
bubblewrap build
```

To create trust between the app and the website, it needs to host a file `.well-known/assetlinks.json` containing the SHA256 fingerprint of the app signing key. You can get the fingerprint of the local key with `keytool -list -v -keystore android.keystore` and the fingerprint of the production key in the play console (Setup > App Integrity > App Signing > Settings). Add it to the assetlinks.json with `bubblewrap fingerprint add`.