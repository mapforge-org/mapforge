# Self-hosting Mapforge

Mapforge runs as a single container next to MongoDB and Redis. This page describes the setup and
the configuration. For the local development setup, read [DEVELOPMENT.md](DEVELOPMENT.md).

## Quick Start with Docker Compose

[deploy/docker-compose.yml](deploy/docker-compose.yml) starts the application, MongoDB and Redis together.

It uses the [latest released image](https://github.com/mapforge-org/mapforge/pkgs/container/mapforge) from `ghcr.io/mapforge-org/mapforge:main`.

```bash
git clone https://github.com/mapforge-org/mapforge.git
cd mapforge/deploy
cp .env.example .env
docker compose up --detach # podman compose works, too
```

Then open [http://localhost:3000](http://localhost:3000). To watch the logs, run `docker compose logs -f mapforge`.

To sign in, either add [OAuth credentials](#login) to `.env`, or use the local developer login, which is enabled by `DEVELOPER_LOGIN_ENABLED`. Only enable the developer login on a local test instance! The first user that logs in becomes admin.

Uploaded images are stored in `deploy/volumes/storage/`, the database in `deploy/volumes/mongodb/`. To update to the latest version: `docker compose pull`

## Environment Variables

### Required in production

| Variable                                | Description                                                                             | Default                      |
| --------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------- |
| `SECRET_KEY_BASE`                       | [Rails secret key][skb]. Generate one with `openssl rand -hex 64`.                      | none                         |

### Database and cache

| Variable                                | Description                                                                       | Default                            |
| --------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------- |
| `MONGO_URL`                             | MongoDB connection string                                                         | `localhost:27017`                  |
| `MONGO_DB`                              | MongoDB database name                                                             | `mapforge_production`              |
| `MONGO_USER`, `MONGO_PASSWORD`          | MongoDB credentials. Leave both unset to connect without authentication.          | none                               |
| `REDIS_URL`                             | Redis URL for Action Cable                                                        | `redis://localhost:6379/1`         |

### Web server

| Variable           | Description                                                                                       | Default                                 |
| ------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `HTTP_PORT`        | HTTP port inside the container                                                                    | 3001 for thruster, 3000 for puma        |
| `FORCE_SSL`        | HTTPS enforcement. Set it to `true` if a reverse proxy terminates TLS in front of the app.        | unset                                   |

### Login

| Variable                                            | Description                                                                              | Default         |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`          | [GitHub OAuth][gh-oauth] credentials. Set both to enable login via GitHub.               | none            |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`          | [Google OAuth][google-oauth] credentials. Set both to enable login via Google.           | none            |
| `OSM_CLIENT_ID`, `OSM_CLIENT_SECRET`                | [OSM OAuth][osm-oauth] credentials. Set both to enable login via OpenStreetMap.          | none            |
| `DEVELOPER_LOGIN_ENABLED`                           | Local developer login. Only enable this on a test instance.                              | unset           |

### Map and routing service keys

Every key here is optional. Without the key, the application hides the feature.

| Variable               | Description                                                       | Effect if unset                                                     |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `OPENROUTESERVICE_KEY` | API key for [openrouteservice.org](https://openrouteservice.org/) | The map hides the route buttons (walk, bike, car) in the line menu. |
| `INDOOREQUAL_KEY`      | API key for [Indoorequal](https://indoorequal.com/)               | The layer menu hides the "OpenStreetMap indoor" entry.              |
| `THUNDERFOREST_KEY`    | API key for [Thunderforest](https://www.thunderforest.com/) maps  | The app hides the Thunderforest background maps.                    |
| `PROTOMAPS_KEY`        | API key for [Protomaps](https://protomaps.com/api) maps           | The app hides the Protomaps background maps.                        |
| `DEFAULT_MAP`          | Default background map                                            | Falls back to [versatilesColorful](https://versatiles.org/).        |

[gh-oauth]: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app
[google-oauth]: https://developers.google.com/identity/protocols/oauth2/web-server
[osm-oauth]: https://wiki.openstreetmap.org/wiki/OAuth
[skb]: https://api.rubyonrails.org/classes/Rails/Application.html#method-i-secret_key_base
