# Ensure that:
# * Map basemap style is loaded
# * GeoJSON features loaded + drawn
# * Websocket is established
def expect_map_loaded
  expect(page).to have_css("#maplibre-map[data-map-loaded='true']")
  expect(page).to have_css("#maplibre-map[data-geojson-loaded='true']")
  expect(page).to have_css("#maplibre-map[data-online='true']")
end

def expect_overpass_loaded
  expect(page).to have_css("#maplibre-map[data-overpass-loaded='true']")
end
