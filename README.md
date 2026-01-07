[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Tests](https://github.com/digitaltom/mapforge/actions/workflows/ci.yml/badge.svg)](https://github.com/digitaltom/mapforge/actions/workflows/ci.yml)
[![Docker](https://github.com/digitaltom/mapforge/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/digitaltom/mapforge/actions/workflows/docker-publish.yml)
[![Coverage Status](https://coveralls.io/repos/github/digitaltom/mapforge/badge.svg?branch=main)](https://coveralls.io/github/digitaltom/mapforge?branch=main)
[![Depfu](https://badges.depfu.com/badges/6ce6b9e47406d4ca01b1192d11b464de/overview.svg)](https://depfu.com/github/mapforge-org/mapforge?project_id=39818)
<!-- [![Code Climate](https://api.codeclimate.com/v1/badges/b56fa0cb960a90502022/maintainability)](https://codeclimate.com/github/digitaltom/mapforge) -->

# Mapforge

Mapforge is an open source web application that lets you create and share your places, tracks and events as GeoJSON layers on top of different base maps. It uses [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) as its map library and supports both desktop and mobile.

The browser connects to the server via WebSockets, so that changes are immediately synced to all clients. This enables collaborative editing and sharing real-time maps.

The main instance is running at [mapforge.org](https://mapforge.org), see [self-hosting](#selfhosting) how to run your own. Check the [changelog](CHANGELOG.md) for recent changes.

<img width="2550" height="1700" alt="Mapforge Screenshots" src="https://github.com/user-attachments/assets/4c8f2f2a-c12c-4319-9d72-cd9a6d5d7a71" />

### Features

- Create maps with your own data on top of various available base maps. 
- Draw shapes and style them: Add pictures, customize colors, symbols, labels, (3D) polygons and more
- Import your data from GeoJSON, GPX and KML
- Collaborative, real-time editing, synchronized via WebSockets
- Share maps and embed on your own web page
- Desktop and mobile UI
- User login with Google or Github account
- Integration with [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) for custom OpenStreetMap queries
- PWA support and available as [Android app](https://play.google.com/store/apps/details?id=org.mapforge.twa)
- Record your track with the µlogger API

### Styling & Data Sources

GeoJSON layers can be styled using an extended version of the
[GeoJSON](https://macwright.com/2015/03/23/geojson-second-bite.html) /
[Mapbox simplestyle](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0) spec.  
See [docs/tutorials/geojson_style_spec.md](docs/tutorials/geojson_style_spec.md) for supported attributes.

[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) layers can be added to a map, allowing custom queries and display of OpenStreetMap data.  
See [docs/tutorials/overpass_layers.md](https://mapforge.org/doc/overpass_layers) for details.

### Android App / PWA

Mapforge is built as a Progressive Web App (PWA), see
[docs/tutorials/app.md](docs/tutorials/app.md).

An Android app that wraps the PWA is available in the Play Store:  
[Mapforge Android App](https://play.google.com/store/apps/details?id=org.mapforge.twa)

---

## Self‑Hosting

### Container Image

The [latest image](https://github.com/mapforge-org/mapforge/pkgs/container/mapforge) is available from `ghcr.io/mapforge-org/mapforge:main`. 

You can also build your own image locally from the repository with: `podman build -t mapforge .`

### Required Services

Before running the application container, make sure MongoDB and Redis are running. For example with Podman:

```bash
podman run -d --name mongo \
  -v <local_dir>:/data/db \
  -p 27017:27017 \
  mongo:7.0

podman run -d --name redis \
  -p 6379:6379 \
  redis
```

### Running Mapforge

A minimal example using the GitHub Container Registry image:

```bash
podman run \
  -e SECRET_KEY_BASE=e3c9f2... \
  -e DEVELOPER_LOGIN_ENABLED=true \
  -e HTTP_PORT=3001 \
  -e SSL=false \
  --network=host \
  ghcr.io/mapforge-org/mapforge:main
```

To enable geolocation-based centering of maps, mount the
[MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/) database:

```bash
podman run ... -v /path/on/host/GeoLite2-City.mmdb:/rails/db/GeoLite2-City.mmdb ...
```

### Environment Variables

- `SECRET_KEY_BASE` — Rails secret key (must be set in production)
- `DEVELOPER_LOGIN_ENABLED` — optional local developer login (only enable this in test instances)
- `HTTP_PORT` — HTTP port inside the container (default: 3000)
- `SSL` — set to `true` if your container is running behind a TLS terminating reverse proxy (default: true)
- `MONGO_URL` — MongoDB connection string (default: `localhost:27017`)
- `REDIS_URL` — Redis URL for Action Cable (default: `redis://localhost:6379/1`)
- `OPENROUTESERVICE_KEY` — API key for routing features with [openrouteservice.org](https://openrouteservice.org/)
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `DEFAULT_MAP` — default base map identifier (default: [versatilesColorful](https://versatiles.org/))

---

## Development

Mapforge is build with a Ruby on Rails backend and uses Maplibre and Stimulus on the frontend. 

### Install Dependencies

Example for openSUSE (Debian package names in parentheses):

```bash
zypper in proj-devel      # (libproj-dev) for building rgeo-proj4
zypper in proj            # (proj-bin) for running rgeo-proj4
zypper in imlib2 imlib2-devel  # (libimlib2, libimlib2-dev) to resize screenshots
zypper in ImageMagick     # (imagemagick) for dragonfly image processing
zypper in npm             # for running eslint
bundle
```

To resolve users’ client IPs to coordinates for centering new maps, download the
[MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/)
database and save it as:

```text
db/GeoLite2-City.mmdb
```

### Running the Development Server

```bash
bin/thrust rails server
```

In development, environment variables (see above) can be set in `.env.development`. 
The first user that logs in is automatically made admin.


### Base Maps

Available base maps can be customized in:

```text
app/javascript/maplibre/basemaps.js
```

### Rake Tasks

- Import a map from a Mapforge export:

  ```bash
  bin/rake seed:mapforge_file['db/seeds/examples/fosdem.json']
  ```

- Import a map from GeoJSON (samples in `db/seeds`):

  ```bash
  bin/rake seed:geojson_file['db/seeds/examples/germany_areas.geojson']
  ```

  More GeoJSON example files: [exploratory.io](https://exploratory.io/map)

- Take screenshots of updated maps for preview:

  ```bash
  MAPFORGE_HOST=<host> bin/rake maps:screenshots
  ```

- Animate a marker along a line:

  ```bash
  bin/rake animation:path[<map_id>,<line_id>,<point_id>]
  ```

### Tests

Linters:

```bash
bin/rubocop
npm install
npm run lint:css
npm run lint:js
```

Fix JavaScript style with ESLint:

```bash
npm run fix:js
```

Run the test suite:

```bash
bundle exec rspec
```

GitHub Actions workflows run these checks automatically. You can run them locally
with [act](https://github.com/nektos/act), for example:

```bash
act -j test
```

### Build the Android app 

To build the Android app yourself using
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```bash
npm install -g @bubblewrap/cli
# init is only needed on the first run
bubblewrap init --manifest=http://localhost:3000/manifest.json
bubblewrap build
```

To establish trust between the app and the website, host a file
`.well-known/assetlinks.json` containing the SHA256 fingerprint of the app signing key.

- Get the fingerprint of the local key:

  ```bash
  keytool -list -v -keystore android.keystore
  ```

- Get the fingerprint of the production key in the Play Console:  
  **Setup → App Integrity → App Signing → Settings**

Then add the fingerprint(s) to `assetlinks.json` using the
[Digital Asset Links generator](https://developers.google.com/digital-asset-links/tools/generator) or:

```bash
bubblewrap fingerprint add
```
