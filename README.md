[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Tests](https://github.com/mapforge-org/mapforge/actions/workflows/ci.yml/badge.svg)](https://github.com/mapforge-org/mapforge/actions/workflows/ci.yml)
[![Docker](https://github.com/mapforge-org/mapforge/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/mapforge-org/mapforge/actions/workflows/docker-publish.yml)
[![Coverage Status](https://coveralls.io/repos/github/mapforge-org/mapforge/badge.svg?branch=main)](https://coveralls.io/mapforge-org/mapforge?branch=main)
[![Depfu](https://badges.depfu.com/badges/6ce6b9e47406d4ca01b1192d11b464de/overview.svg)](https://depfu.com/github/mapforge-org/mapforge?project_id=39818)
<!-- [![Code Climate](https://api.codeclimate.com/v1/badges/b56fa0cb960a90502022/maintainability)](https://codeclimate.com/github/mapforge-org/mapforge) -->

# Mapforge

Create individual maps for your places, tracks and events, and share them in real time.

[recording.webm](https://github.com/user-attachments/assets/bc3cb27b-a36e-43e8-a645-2f6c838e9cfa)

Mapforge is an open source GIS web application. Create and share your places, tracks and events as GeoJSON layers on different base maps, with [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) on desktop and mobile. Changes are synced live to all clients.

**[Try it on mapforge.org](https://mapforge.org)** · [Self-host](#selfhosting) · [Changelog](CHANGELOG.md) · [Contributing](CONTRIBUTING.md)

### Features

- Create maps with your own data on top of various available base maps.
- 3D terrain, hillshade, contour lines and globe projection
- [Self-host](#selfhosting) with ready-to-use Docker Compose file
- Draw shapes and [style them](https://mapforge.org/doc/geojson_style_spec): Add pictures, customize colors, symbols, labels, (3D) polygons, indoor maps and more. The style attributes extend the [GeoJSON](https://macwright.com/2015/03/23/geojson-second-bite.html) / [Mapbox simplestyle](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0) spec.
- Plan routes for walking, bike and car with [openrouteservice](https://openrouteservice.org/), with elevation profile and route color coding by steepness or surface
- Import and export GeoJSON, GPX and KML
- Search places and addresses, including the features of the open map
- Real-time collaborative editing, changes sync to every connected client over WebSockets
- Share maps and embed on your own web page
- Desktop and mobile UI
- [Integration](https://mapforge.org/doc/overpass_layers) with [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) for custom OpenStreetMap queries
- Login with Google, GitHub or OSM OAuth, no auth system to maintain
- [PWA support](docs/tutorials/app.md) by default, ships as an [Android app](https://play.google.com/store/apps/details?id=org.mapforge.twa) via Bubblewrap
- Record GPS tracks with the built in [µlogger API](engines/ulogger/README.md)

## Self‑Hosting

### Quick Start with Docker Compose

[deploy/docker-compose.yml](deploy/docker-compose.yml) starts the application, MongoDB and Redis together.

It uses the [latest released image](https://github.com/mapforge-org/mapforge/pkgs/container/mapforge) from `ghcr.io/mapforge-org/mapforge:main`.

```bash
git clone https://github.com/mapforge-org/mapforge.git
cd mapforge/deploy
cp .env.example .env
docker compose up --detach # podman compose works, too
```

Then open [http://localhost:3000](http://localhost:3000). To watch the logs, run `docker compose logs -f mapforge`.

To sign in, either add OAuth credentials to `.env`, or use the local developer login, which is enabled by `DEVELOPER_LOGIN_ENABLED`. Only enable the developer login on a local test instance! The first user that logs in becomes admin.

Uploaded images are stored in `deploy/volumes/storage/`, the database in `deploy/volumes/mongodb/`. To update to the latest version: `docker compose pull`

### Environment Variables

- `SECRET_KEY_BASE` — Rails secret key (must be set in production). Generate one with `openssl rand -hex 64`.
- `DEVELOPER_LOGIN_ENABLED` — optional local developer login (only enable this in test instances)
- `HTTP_PORT` — HTTP port inside the container (default: 3001 for thruster, 3000 for puma).
- `FORCE_SSL` — HTTPS enforcement. Set it to `true` if a reverse proxy terminates TLS in front of the app.
- `MONGO_URL` — MongoDB connection string (default: `localhost:27017`)
- `MONGO_DB` — MongoDB database name (default: 'mapforge_production')
- `MONGO_USER`, `MONGO_PASSWORD` — MongoDB credentials (optional; leave unset to connect without authentication)
- `REDIS_URL` — Redis URL for Action Cable (default: `redis://localhost:6379/1`)
- `OPENROUTESERVICE_KEY` — API key for routing features with [openrouteservice.org](https://openrouteservice.org/). Without this key the map hides the route buttons (walk, bike, car) in the line menu.
- `INDOOREQUAL_KEY` — API key for [Indoorequal](https://indoorequal.com/). Without this key the layer menu hides the "OpenStreetMap indoor" entry.
- `THUNDERFOREST_KEY` — API key for [Thunderforest](https://www.thunderforest.com/) maps. Without this key the app hides the Thunderforest background maps.
- `PROTOMAPS_KEY` — API key for [Protomaps](https://protomaps.com/api) maps. Without this key the app hides the Protomaps background maps.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth credentials. Set to enable login via Github.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth credentials. Set to enable login via Google.
- `OSM_CLIENT_ID`, `OSM_CLIENT_SECRET` — OSM OAuth credentials. Set to enable login via OpenStreetMap.
- `DEFAULT_MAP` — default background map (default: [versatilesColorful](https://versatiles.org/))
