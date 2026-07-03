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

def layer_visibility(layer_id, type = 'geojson')
  visible = page.evaluate_script(<<~JS)
    map.getStyle().layers
      .filter(l => l.source === '#{type}-source-#{layer_id}')
      .every(l => map.getLayoutProperty(l.id, 'visibility') !== 'none')
  JS
  visible
end

def expect_layer_visibility(layer_id, visible, type = 'geojson')
  wait_for { layer_visibility(layer_id, type) }.to be visible
end

def wait_for_geojson_render
  wait_for {
    page.evaluate_script("document.querySelector('#maplibre-map').dataset.geojsonLoaded")
  }.to eq('true')
end

# Wait until a geojson feature with the given title has been applied on the client.
def wait_for_feature(title)
  wait_for {
    page.evaluate_script(<<~JS)
      !!window._layers && window._layers.some(l =>
        l.type === 'geojson' && l.geojson &&
        l.geojson.features.some(f => f.properties && f.properties.title === #{title.to_json}))
    JS
  }.to be true
end

def reset_resource_timings
  page.evaluate_script("performance.clearResourceTimings()")
end

# Number of full map-data (/m/:id.json) fetches recorded since the last reset.
def map_json_fetch_count
  page.evaluate_script(
    "performance.getEntriesByType('resource').filter(e => /\\/m\\/[^\\/]+\\.json/.test(e.name)).length"
  )
end
