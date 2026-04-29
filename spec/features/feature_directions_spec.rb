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

      # Verify modal opened and switched to properties tab
      expect(page).to have_css("#feature-details-modal.show")
      expect(page).to have_css("#edit-button-edit.active")

      # Verify directions mode is deactivated (no longer in foot mode)
      expect(page).not_to have_css(".mapbox-gl-draw_foot.active")
      # Verify cursor no longer has crosshair
      expect(page).not_to have_css(".maplibregl-canvas.cursor-crosshair")
      # Verify draw mode returned to simple_select
      draw_mode = page.evaluate_script("window.draw.getMode()")
      expect(draw_mode).to eq("simple_select")
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

  context "edit existing routed feature" do
    let(:routed_feature) do
      create(:feature, :line_string,
        coordinates: [ [ 11.041, 49.481, 350 ], [ 11.056, 49.463, 320 ] ],
        title: "Existing Route",
        properties: {
          "route" => {
            "provider" => "ors",
            "profile" => "foot",
            "waypoints" => [ [ 11.041, 49.481 ], [ 11.056, 49.463 ] ]
          }
        })
    end
    let(:map) { create(:map, features: [ routed_feature ], center: [ 11.048, 49.472 ], zoom: 13) }

    before do
      # Load map and wait for it to be ready
      visit map.private_map_path
      expect_map_loaded

      # Click on the route to open feature details
      xy = viewport_xy_for_lat_lng(
        routed_feature.geometry['coordinates'][0][1],
        routed_feature.geometry['coordinates'][0][0]
      )
      click_coord("#maplibre-map", xy[:x], xy[:y])
      expect(page).to have_css("#feature-details-modal")

      # Switch to geometry editing mode
      find("#edit-button-geometry").click
      expect(page).to have_css("#edit-button-geometry.active")
    end

    it "stays in geometry tab and directions mode after waypoint drag" do
      # Wait for directions mode to be active
      expect(page).to have_css(".maplibregl-canvas.cursor-crosshair")
      draw_mode = page.evaluate_script("window.draw.getMode()")
      expect(draw_mode).to eq("directions_foot")

      # Simulate a waypoint drag by clicking at a new position
      # This triggers fetchroutesend via the directions library
      click_coord("#maplibre-map", 300, 300)

      # Wait for route recalculation
      sleep(0.5)

      # Verify geometry tab is still active (not switched to properties)
      expect(page).to have_css("#edit-button-geometry.active")
      expect(page).not_to have_css("#edit-button-edit.active")

      # Verify directions mode is still active
      expect(page).to have_css(".maplibregl-canvas.cursor-crosshair")
      draw_mode = page.evaluate_script("window.draw.getMode()")
      expect(draw_mode).to eq("directions_foot")
    end
  end
end
