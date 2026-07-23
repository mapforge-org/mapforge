Mime::Type.register("application/geo+json", :geojson)
Mime::Type.register("application/gpx+xml", :gpx)
Mime::Type.register("application/javascript", :mjs)

Rack::Mime::MIME_TYPES[".mjs"] = "application/javascript"

# Sprockets keeps its own mime type registry (separate from Rack's above) and only
# recognizes .js by default, so .mjs assets (e.g. maplibre-gl's split-out worker chunk)
# get served with no content type and browsers refuse to load them as modules.
Rails.application.config.assets.configure do |env|
  # register_mime_type replaces the whole entry rather than merging, so re-list
  # .js alongside .mjs to avoid dropping it from Sprockets' internal mime_types map.
  env.register_mime_type "application/javascript", extensions: [".js", ".mjs"], charset: :unicode
end
