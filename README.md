[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Tests](https://github.com/mapforge-org/mapforge/actions/workflows/ci.yml/badge.svg)](https://github.com/mapforge-org/mapforge/actions/workflows/ci.yml)
[![Docker](https://github.com/mapforge-org/mapforge/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/mapforge-org/mapforge/actions/workflows/docker-publish.yml)
[![Coverage Status](https://coveralls.io/repos/github/mapforge-org/mapforge/badge.svg?branch=main)](https://coveralls.io/mapforge-org/mapforge?branch=main)
[![Depfu](https://badges.depfu.com/badges/6ce6b9e47406d4ca01b1192d11b464de/overview.svg)](https://depfu.com/github/mapforge-org/mapforge?project_id=39818)
<!-- [![Code Climate](https://api.codeclimate.com/v1/badges/b56fa0cb960a90502022/maintainability)](https://codeclimate.com/github/mapforge-org/mapforge) -->

# Mapforge

Create individual maps for your places, tracks and events. Share your maps in real-time. Try it now on  [mapforge.org](https://mapforge.org).

Mapforge is an open source, easy to use GIS software. It's a web application that lets you create and share your places, tracks and events as GeoJSON layers on top of different base maps. It uses [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) as map library and supports both desktop and mobile.

Your browser connects to the server via WebSockets, so that changes are immediately synced to all clients. This enables collaborative editing and sharing real-time maps.

The main instance is running at [mapforge.org](https://mapforge.org), see [self-hosting](#selfhosting) how to run your own. Check the [changelog](CHANGELOG.md) for recent changes. Contributions are welcome, see [CONTRIBUTING.md](CONTRIBUTING.md).

<a href="https://mapforge.org">
<img width="2550" height="1700" alt="Mapforge Screenshots" src="https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/public/images/frontpage/github.png" />
</a>

### Features

- Create maps with your own data on top of various available base maps.
- [Self-host](#selfhosting) with Docker Compose or a container image, needs only Redis and MongoDB
- Draw shapes and [style them](https://mapforge.org/doc/geojson_style_spec): Add pictures, customize colors, symbols, labels, (3D) polygons and more
- Import and export GeoJSON, GPX and KML
- Real-time collaborative editing, changes sync to every connected client over WebSockets
- Share maps and embed on your own web page
- Desktop and mobile UI
- [Integration](https://mapforge.org/doc/overpass_layers) with [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) for custom OpenStreetMap queries
- Login with Google, GitHub or OSM OAuth, no auth system to maintain
- PWA support by default, ships as an [Android app](https://play.google.com/store/apps/details?id=org.mapforge.twa) via Bubblewrap
- Record GPS tracks with the built in [µlogger API](engines/ulogger/README.md)

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

## Self‑Hosting

### Quick Start with Docker Compose

[deploy/docker-compose.yml](deploy/docker-compose.yml) starts the application, MongoDB and Redis together.

It uses the [latest released image](https://github.com/mapforge-org/mapforge/pkgs/container/mapforge) from `ghcr.io/mapforge-org/mapforge:main`.

```bash
git clone https://github.com/mapforge-org/mapforge.git
cd mapforge/deploy
cp .env.example .env
docker compose up --detach
```

Then open [http://localhost:3000](http://localhost:3000). To watch the logs, run `docker compose logs -f mapforge`.

To sign in, either add OAuth credentials to `.env`, or use the local developer login, which is enabled by
`DEVELOPER_LOGIN_ENABLED`. Only enable the developer login on a local test instance! The first user that logs in becomes admin.

Uploaded images are stored in `deploy/storage/`, the database in `deploy/mongo-db/`. To update to the latest version: `docker compose pull`

The compose file contains commented sections for a reverse proxy, for the geolocation database and
for map preview picture generation.

### Environment Variables

- `SECRET_KEY_BASE` — Rails secret key (must be set in production). Change the default from `.env.example` before you expose the instance, because anybody who knows the key can forge session cookies. Generate one with `openssl rand -hex 64`.
- `DEVELOPER_LOGIN_ENABLED` — optional local developer login (only enable this in test instances)
- `HTTP_PORT` — HTTP port inside the container (default: 3001 for thruster, 3000 for puma). The container image serves thruster on port 3001.
- `SSL` — set to `true` if your container is running behind a TLS terminating reverse proxy. The default is `true`, but the container image sets it to `false`.
- `MONGO_URL` — MongoDB connection string (default: `localhost:27017`)
- `MONGO_DB` — MongoDB database name (default: 'mapforge_production')
- `MONGO_USER`, `MONGO_PASSWORD` — MongoDB credentials (optional; leave unset to connect without authentication)
- `REDIS_URL` — Redis URL for Action Cable (default: `redis://localhost:6379/1`)
- `OPENROUTESERVICE_KEY` — API key for routing features with [openrouteservice.org](https://openrouteservice.org/). Without this key the map hides the route buttons (walk, bike, car) in the line menu.
- `INDOOREQUAL_KEY` — API key for [Indoorequal](https://indoorequal.com/). Without this key the layer menu hides the "OpenStreetMap indoor" entry.
- `THUNDERFOREST_KEY` — API key for [Thunderforest](https://www.thunderforest.com/) maps. Without this key the app hides the Thunderforest background maps.
- `PROTOMAPS_KEY` — API key for [Protomaps](https://protomaps.com/api) maps. Without this key the app hides the Protomaps background maps.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — GitHub OAuth credentials
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth credentials
- `OSM_CLIENT_ID`, `OSM_CLIENT_SECRET` — OSM OAuth credentials
- `DEFAULT_MAP` — default base map identifier (default: [versatilesColorful](https://versatiles.org/))
