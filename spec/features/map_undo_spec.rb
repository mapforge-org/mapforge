require "rails_helper"

describe "Map Undo/Redo" do
  let(:user) { create(:user) }
  let(:map) { create(:map, name: "Undo test") }

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

  it "can undo adding a point via undo button" do
    find(".mapbox-gl-draw_point").click
    click_coord("#maplibre-map", 50, 50)
    wait_for { Feature.point.count }.to eq(1)

    find("button.maplibregl-ctrl-undo").click
    expect(page).to have_text("Undo")

    wait_for { Feature.count }.to eq(0)
  end

  it "can redo adding a point via redo button" do
    find(".mapbox-gl-draw_point").click
    click_coord("#maplibre-map", 50, 50)
    wait_for { Feature.point.count }.to eq(1)

    find("button.maplibregl-ctrl-undo").click
    wait_for { Feature.count }.to eq(0)

    find("button.maplibregl-ctrl-redo").click
    expect(page).to have_text("Redo")

    wait_for { Feature.count }.to eq(1)
  end

  it "shows undo button after a change and hides it after undoing" do
    # undo button starts hidden
    expect(page).to have_css("button.maplibregl-ctrl-undo.hidden", visible: :all)

    find(".mapbox-gl-draw_point").click
    click_coord("#maplibre-map", 50, 50)
    wait_for { Feature.point.count }.to eq(1)

    # undo button becomes visible after adding a feature
    expect(page).not_to have_css("button.maplibregl-ctrl-undo.hidden", visible: :all)
    expect(page).to have_css("button.maplibregl-ctrl-redo.hidden", visible: :all)

    find("button.maplibregl-ctrl-undo").click
    wait_for { Feature.count }.to eq(0)

    # undo button hidden again after undoing the only change
    expect(page).to have_css("button.maplibregl-ctrl-undo.hidden", visible: :all)
    expect(page).not_to have_css("button.maplibregl-ctrl-redo.hidden", visible: :all)
  end

  context "layer operations" do
    it "can undo adding a layer" do
      initial_layer_count = map.layers.count

      # Open layers modal and add a new layer
      find(".maplibregl-ctrl-layers").click
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "🚰 Drinking water").trigger("click")
      end

      wait_for { map.reload.layers.count }.to eq(initial_layer_count + 1)
      expect(page).to have_text("🚰 Drinking water")

      # Undo the layer addition
      find("button.maplibregl-ctrl-undo").click
      expect(page).to have_text("Undo: Layer added")
      wait_for { map.reload.layers.count }.to eq(initial_layer_count)
      expect(page).not_to have_text("🚰 Drinking water")
    end

    it "can redo adding a layer" do
      initial_layer_count = map.layers.count

      # Add a layer
      find(".maplibregl-ctrl-layers").click
      click_button "Add layer"
      within("#query-dropdown") { find("button.dropdown-item", text: "🍻 Breweries").trigger("click") }
      wait_for { map.reload.layers.count }.to eq(initial_layer_count + 1)
      # Close modal
      page.execute_script("document.querySelector('.modal-center.show')?.classList.remove('show')")

      # Undo adding the layer
      find("button.maplibregl-ctrl-undo").click
      wait_for { map.reload.layers.count }.to eq(initial_layer_count)

      # Redo adding the layer
      expect(page).to have_css("button.maplibregl-ctrl-redo")
      find("button.maplibregl-ctrl-redo").click
      expect(page).to have_text("Redo: Layer added")
      wait_for { map.reload.layers.count }.to eq(initial_layer_count + 1)
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_text("🍻 Breweries")
    end

    it "can undo deleting a layer" do
      # Create a layer first
      layer = create(:layer, name: "Test Layer", map: map)
      visit map.private_map_path
      expect_map_loaded

      # Open layers modal and verify layer exists
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_text("Test Layer")

      # Delete the layer
      accept_alert do
        find('.btn-layer-actions.layer-delete').click
      end
      wait_for { Layer.find_by(id: layer.id) }.to be_nil

      # Undo the deletion
      find("button.maplibregl-ctrl-undo").click
      expect(page).to have_text("Undo")

      # Layer should be restored
      wait_for { map.reload.layers.find_by(name: "Test Layer") }.not_to be_nil
      expect(page).to have_text("Test Layer")
    end
  end
end
