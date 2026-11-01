require "rails_helper"

describe "Map connection" do
  let(:map) { create(:map) }
  let(:path) { map.public_map_path }
  let(:current_user) { nil }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    sign_in(current_user) if current_user
    visit path
    expect_map_loaded
  end

  context "with server gone" do
    it "shows connection error icon" do
      ActionCable.server.connections.each(&:close)
      expect(page).to have_css("div:not(.hidden):has(> button.maplibregl-ctrl-connection)")
    end
  end

  context "with client going offline" do
    it "shows connection error icon" do
      go_offline
      expect(page).to have_css("div:not(.hidden):has(> button.maplibregl-ctrl-connection)")
    end

    it "catches up with new features on reconnect" do
      go_offline

      expect(page).to have_css("div:not(.hidden):has(> button.maplibregl-ctrl-connection)")
      expect(page).to have_css("#maplibre-map[data-online='false']")

      create(:feature, :polygon_middle, layer: map.layers.geojson.first, title: "Poly Title")
      go_online

      expect_map_loaded
      click_center_of_screen
      expect(page).to have_text("Poly Title")
    end

    it "catches up with map property changes on reconnect" do
      reset_resource_timings

      go_offline
      expect(page).to have_css("div:not(.hidden):has(> button.maplibregl-ctrl-connection)")
      map.update!(base_map: "test2")
      go_online
      expect_map_loaded

      expect(map_json_fetch_count).to eq(1) # changed → one reload
      base_map = page.driver.evaluate_script("window.gon.map_properties['base_map']")
      expect(base_map).to eq "test2"
    end

    # When nothing changed server-side (map updated_at unchanged),
    # reconnect must NOT re-fetch + re-parse the full /m/:id.json payload
    it "does not re-fetch the full map on reconnect when nothing changed" do
      reset_resource_timings

      go_offline
      expect(page).to have_css("#maplibre-map[data-online='false']")
      go_online
      expect(page).to have_css("#maplibre-map[data-online='true']")

      expect(map_json_fetch_count).to eq(0)
    end

    # A change received live (while online) advances the loaded map version via the
    # map_updated_at on the broadcast, so a later reconnect with nothing new must NOT trigger
    # the full reload. Also verifies the broadcast's map_updated_at matches /properties.
    it "does not reload on reconnect for changes already applied while online" do
      create(:feature, :polygon_middle, layer: map.layers.geojson.first, title: "Live Poly")
      wait_for_feature("Live Poly") # confirms the live update was received + applied

      reset_resource_timings
      go_offline
      expect(page).to have_css("#maplibre-map[data-online='false']")
      go_online
      expect(page).to have_css("#maplibre-map[data-online='true']")

      expect(map_json_fetch_count).to eq(0)
    end
  end
end
