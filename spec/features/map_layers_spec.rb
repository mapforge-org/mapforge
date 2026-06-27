require "rails_helper"

describe "Map" do
  subject(:map) { create(:map, name: 'Layers test') }

  let(:user) { create(:user) }

  before do
    overpass_file = File.read(Rails.root.join("spec", "fixtures", "files", "overpass.json"))
    CapybaraMock.stub_request(
      :post, "https://overpass-api.de/api/interpreter"
    ).to_return(
      headers: { "Access-Control-Allow-Origin" => "*" },
      status: 200,
      body: overpass_file
    )

    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit map.private_map_path
    expect_map_loaded
  end

  context "with initial map rendering" do
    it "shows map layers button" do
      expect(page).to have_css("#maplibre-map")
      expect(page).to have_css(".maplibregl-ctrl-layers")
    end
  end

  context "feature listing" do
    before do
      feature
      expect(page).to have_text("Added feature")
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

  context "file upload" do
    before do
      find(".maplibregl-ctrl-layers").click
    end

    it "import geojson" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "features.geojson"))
      expect(page).to have_text("(3)")
      expect(page).to have_text("Import1")
      expect(map.reload.features.count).to eq 3
    end

    it "import mapforge json" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "mapforge.json"))
      expect(page).to have_text("(3)")
      expect(map.reload.layers.count).to eq 4 # 1 default + 3 imported
      expect(map.reload.features.count).to eq 6
      expect(map.layers.overpass.count).to eq 1
      # expect(map.reload.center).to eq [ 11.07338990801668, 49.44765470337188 ]
      expect(map.zoom).to eq "14.6"
      expect(map.bearing).to eq "50.4"
      expect(page).to have_text("TestMap")
    end

    it "import image" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "image_with_exif.jpg"))
      click_button "Yes"
      wait_for { map.reload.features.count }.to eq 1
      # flyTo is finished when the feature details are shown
      expect(page).to have_text("Details")
      # flyToFeature() after async image upload doesn't complete in headless test env
      # expect(page.evaluate_script("[map.getCenter().lng.toFixed(4), map.getCenter().lat.toFixed(4)].toString()"))
      #   .to eq("9.9749,53.5445")
      expect(map.features.first.image.public_id).to match(/image_with_exif-\d+.jpeg/)
      expect(map.features.first.geometry["coordinates"]).to eq([ 9.9749, 53.5445 ])
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

  context "layer visibility" do
    it "toggles layer visibility via websocket" do
      map.layers.first.update!(show: false)
      layer_id = map.layers.first.id
      expect_layer_visibility(layer_id, false)
      map.layers.first.update!(show: true)
      expect_layer_visibility(layer_id, true)
    end

    it "toggles layer visibility from show to hidden" do
      layer_id = map.layers.first.id
      expect_layer_visibility(layer_id, true)
      find(".maplibregl-ctrl-layers").click
      find("button.layer-visibility").click

      expect(page).to have_css(".layer-item.layer-dimmed")
      expect(page).to have_css("button.layer-visibility i.bi-eye")
      wait_for { map.layers.first.reload.show }.to be false
      expect_layer_visibility(layer_id, false)
    end

    it "toggles layer visibility from hidden to show" do
      layer_id = map.layers.first.id
      map.layers.first.update!(show: false)
      expect_layer_visibility(layer_id, false)

      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("button.layer-visibility i.bi-eye")
      find("button.layer-visibility").click

      expect(page).to have_css("button.layer-visibility i.bi-eye-slash")
      expect(page).not_to have_css(".layer-item.layer-dimmed")
      wait_for { map.layers.first.reload.show }.to be true
      expect_layer_visibility(layer_id, true)
    end
  end

  context "layer visibility mobile dropdown", :phone do
    it "toggles layer visibility from show to hidden" do
      layer_id = map.layers.first.id

      # When only visibility toggle is available, it shows inline instead of dropdown
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("button.layer-visibility i.bi-eye-slash")
      find("button.layer-visibility").click

      expect(page).to have_css(".layer-item.layer-dimmed")
      wait_for { map.layers.first.reload.show }.to be false
      expect_layer_visibility(layer_id, false)
    end

    it "toggles layer visibility from hidden to show" do
      layer_id = map.layers.first.id
      map.layers.first.update!(show: false)
      expect_layer_visibility(layer_id, false)

      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("button.layer-visibility i.bi-eye")
      find("button.layer-visibility").click

      expect(page).not_to have_css(".layer-item.layer-dimmed")
      wait_for { map.layers.first.reload.show }.to be true
      expect_layer_visibility(layer_id, true)
    end
  end

  context "layer visibility in readonly mode" do
    it "does not sync visibility change to server" do
      map.layers.first.update!(show: false)
      visit map.public_map_path
      expect_map_loaded

      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("button.layer-visibility i.bi-eye")
      find("button.layer-visibility").click
      expect(page).to have_css("button.layer-visibility i.bi-eye-slash")
      expect_layer_visibility(map.layers.first.id, true)
      # server state unchanged
      expect(map.layers.first.reload.show).to be false
    end
  end

  context "add new layer" do
    before do
      find(".maplibregl-ctrl-layers").click
    end

    it "can add predefined query layer" do
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "🍻 Breweries").trigger("click")
      end
      wait_for { map.layers.find { |m| m.name == "🍻 Breweries" } }.to be_present
    end

    it "can add custom query layer" do
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "Custom Overpass query").trigger("click")
      end
      wait_for { map.layers.find { |m| m.name == "Custom query" } }.to be_present
    end
  end

  context "overpass layer visibility" do
    before do
      map.layers << layer
      visit map.private_map_path
      expect_map_loaded
      expect_overpass_loaded
    end

    let(:layer) { create(:layer, :overpass, name: "opass") }

    it "toggles overpass layer visibility via websocket" do
      layer.update!(show: false)
      expect_layer_visibility(layer.id, false, 'overpass')
      layer.update!(show: true)
      expect_layer_visibility(layer.id, true, 'overpass')
    end
  end

  context "layer update via websocket" do
    it "updates layer name via server-side change" do
      layer = map.layers.first
      layer.update!(name: "Renamed Layer")
      # Re-open modal to see updated layer name
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_text("Renamed Layer")
    end
  end

  context "wikipedia layer" do
    before do
      wikipedia_file = File.read(Rails.root.join("spec", "fixtures", "files", "wikipedia.json"))
      CapybaraMock.stub_request(
        :get, /de\.wikipedia\.org\/w\/api\.php/
      ).to_return(
        headers: { "Access-Control-Allow-Origin" => "*" },
        status: 200,
        body: wikipedia_file
      )
      visit map.private_map_path
      expect_map_loaded
    end

    it "can add wikipedia layer" do
      find(".maplibregl-ctrl-layers").click
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "Wikipedia articles").trigger("click")
      end
      wait_for { map.layers.find { |m| m.name == "Wikipedia" } }.to be_present
    end
  end

  context "basemap change preserves layers" do
    before do
      stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
      feature
      visit map.private_map_path
      expect_map_loaded
    end

    let(:feature) { create(:feature, :point, title: "Basemap Test Feature", layer: map.layers.first) }

    it "features remain visible after basemap change" do
      layer_id = map.layers.first.id
      expect_layer_visibility(layer_id, true)

      map.update(base_map: "test2")
      expect(page).to have_text(/Loaded base map test2|Map properties updated|Map view updated/)
      expect_layer_visibility(layer_id, true)
    end
  end

  context "copy to my layer context menu" do
    # center matches the feature in spec/fixtures/files/overpass.json
    subject(:map) { create(:map, name: 'Copy test', center: [ 12.3651437, 44.9165141 ], zoom: 15) }

    let(:layer) { create(:layer, :overpass, name: "opass") }

    before do
      map.layers << layer
    end

    context "in read-write mode" do
      before do
        visit map.private_map_path
        expect_map_loaded
        expect_overpass_loaded
      end

      it "successfully copies overpass feature to user's geojson layer" do
        expect(Feature.count).to eq(0)

        center = center_of_screen
        click_coord("#maplibre-map", center[:x], center[:y], button: :right)
        expect(page).to have_text("Copy to my layer")

        find(".context-menu-item", text: "Copy to my layer").click
        wait_for { Feature.count }.to eq(1)

        copied_feature = Feature.first
        expect(copied_feature.layer).to eq(map.layers.first)
        expect(copied_feature.properties["name"]).to eq("Agriturismo Caprissio")
        expect(copied_feature.properties["tourism"]).to eq("camp_site")
        expect(copied_feature.geometry["type"]).to eq("Point")
        expect(copied_feature.geometry["coordinates"]).to eq([ 12.3651437, 44.9165141 ])
      end
    end

    context "in read-only mode" do
      before do
        visit map.public_map_path
        expect_map_loaded
        expect_overpass_loaded
      end

      it "does not show copy to my layer option on overpass feature right-click" do
        center = center_of_screen
        click_coord("#maplibre-map", center[:x], center[:y], button: :right)
        expect(page).not_to have_text("Copy to my layer")
      end
    end
  end

  context "reordering features" do
    let!(:f1) { create(:feature, :point, title: "Reorder A", layer: map.layers.first) }
    let!(:f2) { create(:feature, :point_middle, title: "Reorder B", layer: map.layers.first) }
    let!(:f3) { create(:feature, :polygon_middle, title: "Reorder C", layer: map.layers.first) }

    # reload after features exist so they render server-side in created_at order
    before do
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("li[data-feature-id='#{f1.id}'] .feature-drag-handle")
    end

    def feature_ids = page.all("#layers li[data-feature-id]").map { |li| li["data-feature-id"] }

    it "drags a feature to a new position and persists the order" do
      # listed top-first: the last-created feature (drawn on top) appears first
      expect(feature_ids).to eq [ f3.id.to_s, f2.id.to_s, f1.id.to_s ]

      # drag the bottom feature (f1) up onto the top one (f3)
      drag_element("li[data-feature-id='#{f1.id}'] .feature-drag-handle",
        "li[data-feature-id='#{f3.id}']")

      new_order = feature_ids
      expect(new_order.first).to eq f1.id.to_s
      expect(new_order).not_to eq [ f3.id.to_s, f2.id.to_s, f1.id.to_s ]

      # feature_order is the draw order (bottom first) — the reverse of the shown list
      wait_for { map.layers.first.reload.feature_order }.to eq new_order.reverse

      # dragging must not select a feature or open its details
      expect(page).not_to have_css("#feature-details-modal.show")
    end
  end
end
