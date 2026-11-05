require "rails_helper"

describe "Feature directions" do
  let(:map) { create(:map, name: "Feature directions test") }

  before do
    stub_fixture(:post, /api\.heigit\.org\/openrouteservice\/v2\/directions\/foot-hiking/, "ors_foot.json")
    stub_fixture(:post, /api\.heigit\.org\/openrouteservice\/v2\/snap\/foot-hiking/, "ors_snap.json")
    # the elevation api has its own domain, because of CORS
    stub_fixture(:post, /api\.heigit\.org\/openelevationservice\/v0\/line/, "ors_elevation.json")
  end

  context "with empty map" do
    before do
      visit map.private_map_path
      expect_map_loaded
    end

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

  context "with a route that leaves the terrain" do
    let(:straight) { [ 1000, 1010, 1020, 1030, 1040 ] }

    before do
      visit map.private_map_path
      expect_map_loaded
    end

    # The vertices are about 33 m apart, the terrain is above the route by the offsets of the edges
    def off_terrain(elevations, extras = nil, offsets = Array.new(elevations.size - 1, 30))
      page.evaluate_async_script(<<~JS, elevations, extras, offsets)
        const [elevations, extras, offsets, done] = arguments
        import('maplibre/routing/openrouteservice').then(({ offTerrainValues }) => {
          const coords = elevations.map((e, i) => [11, 47 + i * 0.0003, e])
          const terrain = offsets.map((offset, i) => (coords[i][2] + coords[i + 1][2]) / 2 + offset)
          done(offTerrainValues(coords, terrain, extras))
        })
      JS
    end

    it "keeps a straight range" do
      expect(off_terrain(straight)).to eq([ [ 0, 4, -1 ] ])
      expect(off_terrain(straight, { surface: { values: [ [ 0, 4, 0 ] ] } })).to eq([ [ 0, 4, -1 ] ])
    end

    it "drops a range with a bent elevation" do
      expect(off_terrain([ 1000, 1015, 1000, 1015, 1000 ])).to eq([])
    end

    it "checks the elevation from way end to way end" do
      offsets = [ 0, 30, 0, 0 ]
      expect(off_terrain([ 1000, 1010.01, 1020.02, 1030.01, 1040 ], nil, offsets)).to eq([ [ 1, 2, -1 ] ])
      expect(off_terrain([ 1000, 1013.3, 1023.4, 1033.3, 1040 ], nil, offsets)).to eq([])
    end

    it "drops a straight range on a natural surface" do
      expect(off_terrain(straight, { surface: { values: [ [ 0, 4, 12 ] ] } })).to eq([])
    end

    it "drops a straight range on a mountain trail" do
      expect(off_terrain(straight, { traildifficulty: { values: [ [ 0, 4, 3 ] ] } })).to eq([])
    end

    context "with a trail" do
      let(:path) { { values: [ [ 0, 4, 4 ] ] } }

      it "drops a straight range below the trail height" do
        expect(off_terrain(straight, { waytype: path })).to eq([])
      end

      it "drops a range below the trail length" do
        expect(off_terrain(straight.first(2), { waytype: path }, [ 45 ])).to eq([])
      end

      it "keeps a range above both trail limits" do
        expect(off_terrain(straight, { waytype: path }, [ 45 ] * 4)).to eq([ [ 0, 4, -1 ] ])
      end

      it "keeps a shallow range on a built surface" do
        extras = { waytype: path, surface: { values: [ [ 0, 4, 7 ] ] } }
        expect(off_terrain(straight, extras)).to eq([ [ 0, 4, -1 ] ])
      end

      it "keeps a shallow range on a road" do
        expect(off_terrain(straight, { waytype: { values: [ [ 0, 4, 1 ] ] } })).to eq([ [ 0, 4, -1 ] ])
      end
    end

    it "keeps a bridge way of one edge inside a natural trail" do
      extras = { surface: { values: [ [ 0, 1, 12 ], [ 1, 2, 7 ], [ 2, 3, 12 ] ] } }
      expect(off_terrain([ 1000, 1010, 1020, 1030 ], extras, [ 0, 30, 0 ])).to eq([ [ 1, 2, -1 ] ])
    end
  end

  context "without an openrouteservice key" do
    before do
      allow(Map).to receive(:provider_keys).and_return(Map.provider_keys.merge(openrouteservice: nil))
      visit map.private_map_path
      expect_map_loaded
    end

    it "hides the route buttons" do
      find(".mapbox-gl-draw_line").click
      expect(page).to have_css(".mapbox-gl-draw_paint")
      expect(page).not_to have_css(".mapbox-gl-draw_foot")
      expect(page).not_to have_css(".mapbox-gl-draw_bicycle")
      expect(page).not_to have_css(".mapbox-gl-draw_road")
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
      expect(page).to have_text("Convert to route")

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

    it "adds a waypoint via context menu on the route line" do
      expect(page).to have_css(".maplibregl-canvas.cursor-crosshair")
      xy = viewport_xy_for_lat_lng(49.472, 11.0485)
      click_coord("#maplibre-map", xy[:x], xy[:y], button: :right)

      find(".context-menu-item", text: "Add waypoint here").click
      expect(page).to have_no_css(".context-menu-item")
      wait_for { routed_feature.reload.properties["route"]["waypoints"].length }.to eq(3)
    end
  end
end
