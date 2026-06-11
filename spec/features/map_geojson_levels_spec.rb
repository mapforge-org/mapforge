require "rails_helper"

describe "Map GeoJSON levels" do
  let(:feature_level_0) {
    create(:feature, :polygon_middle,
      properties: { title: "Level 0 Feature", level: "0" })
  }
  let(:feature_level_1) {
    create(:feature, :point_middle,
      properties: { title: "Level 1 Feature", level: "1" })
  }
  let(:feature_no_level) {
    create(:feature, :point,
      properties: { title: "No Level Feature" })
  }
  let(:map) { create(:map, features: [ feature_level_0, feature_level_1, feature_no_level ]) }
  let(:path) { map.public_map_path }

  before do
    visit path
    expect_map_loaded
  end

  context "initial map load" do
    it "renders level 0 by default" do
      # Level 0 feature should be visible (polygon_middle covers center)
      hover_center_of_screen
      expect(page).to have_text("Level 0 Feature")

      # Feature without level should be visible (point at specific location)
      point_coords = viewport_xy_for_lat_lng(
        feature_no_level.geometry["coordinates"][1],
        feature_no_level.geometry["coordinates"][0]
      )
      hover_coord(point_coords[:x], point_coords[:y])
      expect(page).to have_text("No Level Feature")
    end

    it "shows level control" do
      expect(page).to have_css(".level-control")
      expect(page).to have_css(".level-control button[data-level='0']")
      expect(page).to have_css(".level-control button[data-level='1']")
    end

    it "has level 0 button active" do
      expect(page).to have_css(".level-control button[data-level='0'].active")
      expect(page).not_to have_css(".level-control button[data-level='1'].active")
    end

    it "sets level in url" do
      expect(page).to have_current_path("/m/#{map.public_id}?level=0", ignore_query: false)
    end
  end

  context "switching levels" do
    before do
      # Ensure we start at level 0
      expect(page).to have_css(".level-control button[data-level='0'].active")
    end

    it "renders features of new level only" do
      # Click level 1 button
      find(".level-control button[data-level='1']").click

      # Wait for UI to update AND for GeoJSON layer to re-render with filtered features
      wait_for { page.has_css?(".level-control button[data-level='1'].active") }.to be true
      wait_for {
        page.evaluate_script("document.querySelector('#maplibre-map').dataset.geojsonLoaded")
      }.to eq('true')

      # Hover at center - level 0 polygon should be gone
      hover_center_of_screen
      expect(page).not_to have_text("Level 0 Feature")

      # Hover on level 1 point to verify it IS visible
      point_coords = viewport_xy_for_lat_lng(
        feature_level_1.geometry["coordinates"][1],
        feature_level_1.geometry["coordinates"][0]
      )
      hover_coord(point_coords[:x], point_coords[:y])
      expect(page).to have_text("Level 1 Feature")
    end

    it "updates url level attribute" do
      find(".level-control button[data-level='1']").click

      wait_for do
        page.current_url.include?("level=1")
      end.to be true

      expect(page).to have_current_path("/m/#{map.public_id}?level=1", ignore_query: false)
    end

    it "updates active button state" do
      find(".level-control button[data-level='1']").click

      wait_for do
        page.has_css?(".level-control button[data-level='1'].active")
      end.to be true

      expect(page).not_to have_css(".level-control button[data-level='0'].active")
      expect(page).to have_css(".level-control button[data-level='1'].active")
    end
  end

  context "loading map with specific level url attribute" do
    let(:path) { "/m/#{map.public_id}?level=1" }

    it "shows that level" do
      expect(page).to have_current_path("/m/#{map.public_id}?level=1", ignore_query: false)
      expect(page).to have_css(".level-control button[data-level='1'].active")

      # Level 0 polygon should not be visible
      hover_center_of_screen
      expect(page).not_to have_text("Level 0 Feature")

      # Level 1 point should be visible
      point_coords = viewport_xy_for_lat_lng(
        feature_level_1.geometry["coordinates"][1],
        feature_level_1.geometry["coordinates"][0]
      )
      hover_coord(point_coords[:x], point_coords[:y])
      expect(page).to have_text("Level 1 Feature")
    end
  end

  context "url attribute supports multiple levels separated by comma" do
    # Note: UI only supports single selection for now, but the data model supports multiple levels
    # This test verifies the URL parameter parsing works for future multi-level support
    it "parses comma-separated levels from url" do
      # Create an additional level for this test
      create(:feature, :line_string,
        layer: map.layers.first,
        properties: { title: "Level 2 Feature", level: "2" })

      # Manually set URL with multiple levels
      page.driver.execute_script("window.history.replaceState({}, '', '?level=0,1')")
      page.driver.refresh

      expect_map_loaded

      # Currently, with single-selection UI, only the first level (0) will be active
      # But the URL parsing should not break
      expect(page).to have_css(".level-control")
      expect(page).to have_current_path("/m/#{map.public_id}?level=0", ignore_query: false)
    end
  end

  context "features without level property" do
    let(:map) { create(:map, features: [ feature_level_0, feature_no_level ]) }

    it "are always visible regardless of active level" do
      # At level 0
      expect(page).to have_css(".level-control button[data-level='0'].active")
      point_coords = viewport_xy_for_lat_lng(
        feature_no_level.geometry["coordinates"][1],
        feature_no_level.geometry["coordinates"][0]
      )
      hover_coord(point_coords[:x], point_coords[:y])
      expect(page).to have_text("No Level Feature")
    end
  end

  context "map with no leveled features" do
    let(:map) { create(:map, features: [ feature_no_level ]) }

    it "does not show level control" do
      expect(page).not_to have_css(".level-control")
    end
  end

  context "switching between levels via url" do
    it "updates the map when url changes" do
      expect(page).to have_css(".level-control button[data-level='0'].active")

      # Change URL programmatically to level 1
      page.driver.execute_script("window.location.search = '?level=1'")
      expect_map_loaded

      expect(page).to have_css(".level-control button[data-level='1'].active")

      # Level 0 polygon should not be visible anymore
      hover_center_of_screen
      expect(page).not_to have_text("Level 0 Feature")

      # Level 1 point should be visible
      point_coords = viewport_xy_for_lat_lng(
        feature_level_1.geometry["coordinates"][1],
        feature_level_1.geometry["coordinates"][0]
      )
      hover_coord(point_coords[:x], point_coords[:y])
      expect(page).to have_text("Level 1 Feature")
    end
  end

  context "features with multiple levels (OSM-style semicolon list)" do
    # Place the multi-level point above the polygon_middle bbox so hovering it
    # doesn't also pick up the level-0 polygon.
    def feature_multi
      @feature_multi ||= create(:feature, :point,
        coordinates: [ 11.06, 49.475 ],
        properties: { title: "Multi Level Feature", level: "0;1", "marker-size" => "150" })
    end

    def multi_coords
      @multi_coords ||= viewport_xy_for_lat_lng(
        feature_multi.geometry["coordinates"][1],
        feature_multi.geometry["coordinates"][0]
      )
    end

    context "with multi-level + single-level peers" do
      let(:map) {
        create(:map, features: [
          feature_level_0, feature_level_1, feature_multi,
          create(:feature, :line_string, properties: { title: "Level 2 Feature", level: "2" })
        ])
      }

      it "is visible at level 0" do
        expect(page).to have_css(".level-control button[data-level='0'].active")
        hover_coord(multi_coords[:x], multi_coords[:y])
        expect(page).to have_text("Multi Level Feature")
      end

      it "is still visible after switching to level 1" do
        find(".level-control button[data-level='1']").click
        wait_for { page.has_css?(".level-control button[data-level='1'].active") }.to be true

        hover_coord(multi_coords[:x], multi_coords[:y])
        expect(page).to have_text("Multi Level Feature")
      end
    end

    context "level control reflects the union of declared levels" do
      # Only the multi feature on the map — both its declared levels must produce buttons.
      let(:map) { create(:map, features: [ feature_multi ]) }

      it "shows a button for each level the feature declares" do
        expect(page).to have_css(".level-control button[data-level='0']")
        expect(page).to have_css(".level-control button[data-level='1']")
      end
    end
  end
end
