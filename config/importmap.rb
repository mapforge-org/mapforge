# Pin npm packages by running ./bin/importmap pin <npm module name>@<version> --from jspm|unpkg|jsdelivr --download
# https://github.com/rails/importmap-rails

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@rails/actioncable", to: "actioncable.esm.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"

pin_all_from "app/javascript/controllers", under: "controllers", preload: false
pin_all_from "app/javascript/channels", under: "channels", preload: false

pin_all_from "app/javascript/maplibre", under: "maplibre", preload: false
pin_all_from "app/javascript/helpers", under: "helpers", preload: false

# page initializers
pin "frontpage", preload: false
pin "deck", preload: false
pin "maplibre", preload: false
pin "animate", preload: false

# vendor
# examples: https://generator.jspm.io/

# https://github.com/piraveenankirupakaran/mapbox-gl-draw-paint-mode
# free hand draw; local download because of removal of css import, latest git version, feature id generation
pin "mapbox-gl-draw-paint-mode", preload: false
pin_all_from "vendor/javascript/mapbox-gl-draw-paint-mode",
  under: "mapbox-gl-draw-paint-mode", preload: false

# https://github.com/maplibre/maplibre-gl-js
pin "maplibre-gl", preload: false # @5.6.1
# https://github.com/maplibre/maplibre-gl-geocoder
pin "maplibre-gl-geocoder",
to: "https://ga.jspm.io/npm:@maplibre/maplibre-gl-geocoder@1.7.1/dist/maplibre-gl-geocoder.mjs", preload: false
# https://github.com/GIScience/openrouteservice-js?tab=readme-ov-file
pin "openrouteservice-js", preload: false # @0.4.1
# https://github.com/maplibre/maplibre-gl-directions/tree/main
pin "@maplibre/maplibre-gl-directions", preload: false, to: "@maplibre--maplibre-gl-directions.js" # @0.8.0
# https://github.com/onthegomap/maplibre-contour
pin "maplibre-contour", preload: false # @0.1.0

# Elevation chart
pin "chart.js", to: "chart-js.js", preload: false # @4.5.0
pin "@kurkle/color", to: "@kurkle--color", preload: false # @0.3.4

# render markdown
pin "marked"# @15.0.8

# https://github.com/mapbox/mapbox-gl-draw
# Unminified + patched version to style midpoints & vertexes (https://github.com/mapbox/mapbox-gl-draw/pull/964)
pin "@mapbox/mapbox-gl-draw", to: "@mapbox--mapbox-gl-draw.js", preload: false # @1.5.0
pin "@mapbox/geojson-area", to: "@mapbox--geojson-area.js", preload: false # @0.2.2
pin "@mapbox/geojson-normalize", to: "@mapbox--geojson-normalize.js", preload: false # @0.0.1
pin "@mapbox/point-geometry", to: "@mapbox--point-geometry.js", preload: false # @1.1.0
pin "fast-deep-equal", preload: false # @3.1.3
pin "nanoid/non-secure", to: "nanoid--non-secure.js", preload: false # @5.1.2
pin "wgs84", preload: false # @0.0.0

# Animations for frontpage: https://github.com/michalsnik/aos
pin "aos" # @2.3.4
