# Ensure that:
# * Map basemap style is loaded
# * GeoJSON features loaded + drawn
# * Websocket is established
def expect_map_loaded
  expect(page).to have_css("#maplibre-map[data-geojson-loaded='true']", wait: 30)
  expect(page).to have_css("#maplibre-map[data-map-loaded='true']", wait: 30)
  expect(page).to have_css("#maplibre-map[data-online='true']")
end

def expect_overpass_loaded
  expect(page).to have_css("#maplibre-map[data-overpass-loaded='true']", wait: 30)
end

def layer_visibility(layer_id)
  visible = page.evaluate_script(<<~JS)
    map.getStyle().layers
      .filter(l => l.source === 'geojson-source-#{layer_id}')
      .every(l => map.getLayoutProperty(l.id, 'visibility') !== 'none')
  JS
  visible
end

def expect_layer_visibility(layer_id, visible)
  wait_for { layer_visibility(layer_id) }.to be visible
end
