require "rails_helper"

describe "Feature directions" do
  let(:map) { create(:map, name: "Feature directions test") }

  before do
    ors_file = File.read(Rails.root.join("spec", "fixtures", "files", "ors_foot.json"))
    CapybaraMock.stub_request(
      :post, /api\.openrouteservice\.org\/v2\/directions\/foot-hiking/
    ).to_return(
      headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
      status: 200,
      body: ors_file
    )

    visit map.private_map_path
    expect_map_loaded
  end

  context "with empty map" do
    it "can create foot track" do
      find(".mapbox-gl-draw_line").click
      find(".mapbox-gl-draw_foot").click
      click_coord("#maplibre-map", 250, 250)
      click_coord("#maplibre-map", 450, 450)
      wait_for { Feature.line_string.count }.to eq(1)
    end
  end

  context "convert GPX to routed track" do
    let(:gpx_feature) do
      create(:feature, :line_string,
        coordinates: [ [ 11.041, 49.481 ], [ 11.056, 49.463 ] ],
        title: "Imported GPX Track")
    end
    let(:map) { create(:map, features: [ gpx_feature ], center: [ 11.048, 49.472 ], zoom: 13) }

    before do
      # Mock ORS Snap API
      snap_file = File.read(Rails.root.join("spec", "fixtures", "files", "ors_snap.json"))
      CapybaraMock.stub_request(
        :post, /api\.openrouteservice\.org\/v2\/snap\/foot-hiking/
      ).to_return(
        headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
        status: 200,
        body: snap_file
      )

      # Mock ORS Directions API (reuse existing fixture)
      ors_file = File.read(Rails.root.join("spec", "fixtures", "files", "ors_foot.json"))
      CapybaraMock.stub_request(
        :post, /api\.openrouteservice\.org\/v2\/directions\/foot-hiking/
      ).to_return(
        headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
        status: 200,
        body: ors_file
      )

      # Mock ORS Elevation API
      elevation_file = File.read(Rails.root.join("spec", "fixtures", "files", "ors_elevation.json"))
      CapybaraMock.stub_request(
        :post, /api\.openrouteservice\.org\/elevation\/line/
      ).to_return(
        headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
        status: 200,
        body: elevation_file
      )

      # Load map and wait for it to be ready
      visit map.private_map_path
      expect_map_loaded

      # Click on the line to open feature details
      xy = viewport_xy_for_lat_lng(
        gpx_feature.geometry['coordinates'][0][1],
        gpx_feature.geometry['coordinates'][0][0]
      )
      click_coord("#maplibre-map", xy[:x], xy[:y])
      expect(page).to have_css("#feature-details-modal")
    end

    it "converts non-routed LineString to foot route" do
      # Verify initial state: only 1 feature, no route property
      expect(Feature.count).to eq(1)
      expect(Feature.first.properties["route"]).to be_nil

      # Click Advanced tab
      find("#edit-button-advanced").click

      # Verify convert section is visible
      expect(page).to have_text("Convert to routed track")

      # Expand the convert section by clicking the header
      find("#convert-to-route-header").click

      # Click foot profile button
      find("[data-convert-profile='foot']").click

      # Wait for conversion to complete and new feature to be created
      wait_for { Feature.count }.to eq(2)

      # Verify new routed feature was created
      routed_feature = Feature.order(created_at: :desc).first
      expect(routed_feature.properties["route"]).not_to be_nil
      expect(routed_feature.properties["route"]["provider"]).to eq("ors")
      expect(routed_feature.properties["route"]["profile"]).to eq("foot")
      expect(routed_feature.properties["route"]["waypoints"]).to be_present
      expect(routed_feature.properties["route"]["extras"]).to be_present

      # Verify original feature still exists
      expect(Feature.find(gpx_feature.id)).to be_present
    end
  end
end
