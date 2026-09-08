## Development

Mapforge is build with a Ruby on Rails backend and uses Maplibre and Stimulus on the frontend.

To report a bug or to send a pull request, see [CONTRIBUTING.md](CONTRIBUTING.md).

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
database and save it as `db/GeoLite2-City.mmdb`.

### Running the Development Server

Before running the application, make sure MongoDB and Redis are running. For example with Podman:

```bash
podman run -d --name mongo \
  -v <local_dir>:/data/db:U,z \
  -p 27017:27017 \
  mongo:8.2

podman run -d --name redis \
  -p 6379:6379 \
  redis
```

Then start the Mapforge app:

```bash
HTTP_PORT=3001 bin/thrust rails server
```

In development, environment variables (see [README](README.md#environment-variables)) can be set in `.env.development`.


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

- Setup database indexes:

  ```bash
  bin/rake db:mongoid:create_indexes
  ```

- Animate a marker along a line, at a constant speed in m/s (default 10):

  ```bash
  bin/rake animation:path[<map_id>,<line_id>,<point_id>,<speed>]
  ```
- Update .pot/.po files with new translatable strings from the code: `bin/rake gettext:find`

- Export translation for use in js: `bin/rake gettext:po_to_json` (automatically called in container image build)

### Importmap updates

* `bin/importmap outdated` shows outdated dependencies, `bin/importmap update` updates them
* Updating a single package: `bin/importmap pin <pkg>`
* Some dependencies in importmap.rb are marked with vX.Y so they don't get picked up automatically, they need a manual upgrade.

### Translations

Mapforge uses [gettext](https://github.com/grosser/gettext_i18n_rails) (via `fast_gettext`, `gettext_i18n_rails` and `gettext_i18n_rails_js`) for translations, locale files are in `locale/<lang>/app.po`.

Mark a string as translatable:

```ruby
# Ruby / Haml
_("Delete this feature?")
n_("%{count} feature", "%{count} features", count) % { count: count }
```

```js
// JavaScript
window.__('Delete this feature?')
window.n__('%d feature', '%d features', count)
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
bin/rspec
```

GitHub Actions workflows run these checks automatically. You can run them locally
with [act](https://github.com/nektos/act), for example:

```bash
act -j test
```

### Container Images

You can build the app container image with:

```bash
podman build -t mapforge -f deploy/Dockerfile .
```

Now run Mapforge with the local image or the latest image from the GitHub Container Registry:

```bash
podman run \
  --name mapforge
  -e SECRET_KEY_BASE=e3c9f2... \
  -e DEVELOPER_LOGIN_ENABLED=true \
  --network=host \
  ghcr.io/mapforge-org/mapforge:main
```

To persist data like uploaded images in your storage, mount these to the container by adding to the podman command:

```bash
-v /path/on/host/maps:/rails/public/previews
-v /path/on/host/rails_storage:/rails/storage
-v /path/on/host/rack_cache:/rails/tmp/cache/rack
```

To enable geolocation-based centering of maps, mount the
[MaxMind GeoLite2](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data/) database:

```bash
-v /path/on/host/GeoLite2-City.mmdb:/rails/db/GeoLite2-City.mmdb
```

### Build the Android app

To build the Android app yourself using
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):

```bash
npm install -D @bubblewrap/cli
# init is only needed on the first run
cd android
npx bubblewrap init --manifest=http://localhost:3000/manifest.json
npx bubblewrap build
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

- Create a Playstore release: "Test and Release" -> "Production" -> "Create new release"
