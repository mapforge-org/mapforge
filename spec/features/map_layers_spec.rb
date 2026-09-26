require "rails_helper"

describe "Map layers" do
  include_context "with an editable map and an overpass stub"

  context "with initial map rendering" do
    it "shows map layers button" do
      expect(page).to have_css("#maplibre-map")
      expect(page).to have_css(".maplibregl-ctrl-layers")
    end
  end

  context "feature listing" do
    before do
      feature
      expect(page).to have_text("Point 'Feature 1' added")
      find(".maplibregl-ctrl-layers").click
    end

    let(:feature) { create(:feature, :point, title: "Feature 1", desc: "F1 desc", layer: map.layers.first) }

    it "lists all features" do
      expect(page).to have_text("Feature 1")
    end

    it "flies to feature on click" do
      find("li[data-feature-id='#{feature.id}']").click
      # flyTo is finished when the feature details are shown
      expect(page).to have_text("F1 desc")
      center = page.evaluate_script("[map.getCenter().lng, map.getCenter().lat]")
      expect(center[0]).to be_within(1e-6).of(feature.coordinates[0])
      expect(center[1]).to be_within(1e-6).of(feature.coordinates[1])
    end
  end

  context "geojson layer" do
    it "adds a new layer as first layer" do
      find(".maplibregl-ctrl-layers").click
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "New layer").trigger("click")
      end
      wait_for { Layer.find_by(name: "New layer") }.not_to be_nil
      expect(map.reload.layers.first.name).to eq "New layer"
    end

    it "adds new features to the active layer" do
      second = create(:layer, map: map, name: "Second")
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-layers").click
      find("#layer-list-#{second.id} button.layer-active").click
      expect(page).to have_text("New features go to layer Second")

      find(".maplibregl-ctrl-layers").click
      find(".mapbox-gl-draw_point").click
      click_coord("#maplibre-map", 50, 50)
      wait_for { Feature.point.last&.layer }.to eq(second)
    end

    it "can delete a geojson layer, but not the last one" do
      first = map.layers.geojson.first
      create(:layer, map: map, name: "Second")
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-layers").click
      accept_alert do
        find("#layer-list-#{first.id} .btn-layer-actions.layer-delete").click
      end
      wait_for { Layer.find(first.id) }.to be_nil
      expect(page).to have_no_css(".btn-layer-actions.layer-delete", visible: true)
    end
  end

  context "overpass layer" do
    before do
      map.layers << layer
      visit map.private_map_path
      expect_map_loaded
      expect_overpass_loaded
      find(".maplibregl-ctrl-layers").click
    end

    let(:layer) { create(:layer, :overpass, name: "opass") }

    it "Shows overpass layer" do
      expect(page).to have_text("opass(1)")
    end

    it "can add overpass layer" do
      expect(page).to have_text("opass")
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "🚰 Drinking water").trigger("click")
      end
      wait_for { Layer.find_by(name: "🚰 Drinking water") }.not_to be_nil
    end

    it "can edit overpass layer" do
      expect(page).to have_text("opass")
      find(".layer-edit").click
      expect(page).to have_field("overpass-query", with: layer.query)
      fill_in "overpass-query", with: "nwr[highway=bus];out center 1;"
      click_button "Update Layer"
      wait_for { layer.reload.query }.to eq("nwr[highway=bus];out center 1;")
    end

    it "can delete overpass layer" do
      expect(page).to have_text("opass")
      accept_alert do
        find('.btn-layer-actions.layer-delete').click
      end
      wait_for { Layer.find(layer.id) }.to be_nil
    end
  end
end
