Mime::Type.register("application/geo+json", :geojson)
Mime::Type.register("application/gpx+xml", :gpx)
Mime::Type.register("application/javascript", :mjs)

Rack::Mime::MIME_TYPES[".mjs"] = "application/javascript"
