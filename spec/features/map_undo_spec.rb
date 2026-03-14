require "rails_helper"

describe "Map Undo/Redo" do
  let(:user) { create(:user) }
  let(:map) { create(:map, name: "Undo test") }

  before do
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
end
