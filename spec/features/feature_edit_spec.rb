require "rails_helper"

describe "Feature edit" do
  include_context "with an editable map and an elevation stub"

  context "with empty map" do
    it "shows feature edit buttons" do
      expect(page).to have_css(".mapbox-gl-draw_line")
      expect(page).to have_css(".mapbox-gl-draw_polygon")
      expect(page).to have_css(".mapbox-gl-draw_point")
    end

    context "when adding features" do
      it "adding a point to the map" do
        find(".mapbox-gl-draw_point").click
        click_coord("#maplibre-map", 50, 50)
        wait_for { Feature.point.count }.to eq(1)
      end

      it "adding a line to the map" do
        find(".line-menu-btn").click
        find(".ctrl-line-menu .mapbox-gl-draw_line").click
        click_coord("#maplibre-map", 250, 250)
        click_coord("#maplibre-map", 350, 350)
        click_coord("#maplibre-map", 450, 450)
        click_coord("#maplibre-map", 450, 450)

        # need to wait until feature is saved server side
        wait_for { Feature.line_string.count }.to eq(1)
      end

      it "shows the freehand line while it is painted" do
        find(".line-menu-btn").click
        find(".ctrl-line-menu .mapbox-gl-draw_paint").click

        mouse = page.driver.browser.mouse
        mouse.move(x: 250, y: 250)
        mouse.down
        mouse.move(x: 350, y: 300, steps: 5)
        mouse.move(x: 450, y: 400, steps: 5)
        painted = page.evaluate_script(
          "window.map.queryRenderedFeatures({ layers: " \
          "['gl-draw-line-active.hot', 'gl-draw-line-paint.hot'] })" \
          ".map(f => f.layer.id)")
        mouse.up

        expect(painted).to include("gl-draw-line-active.hot", "gl-draw-line-paint.hot")
        wait_for { Feature.line_string.count }.to eq(1)
      end

      it "adding a polygon to the map" do
        find(".mapbox-gl-draw_polygon").click

        click_coord("#maplibre-map", 10, 10)
        click_coord("#maplibre-map", 10, 50)
        click_coord("#maplibre-map", 50, 50)
        click_coord("#maplibre-map", 50, 10)
        click_coord("#maplibre-map", 10, 10)

        # need to wait until feature is saved server side
        wait_for { Feature.polygon.count }.to eq(1)
      end

      # A stored center always comes from the owner, so the first feature must not clear it
      it "keeps the map center when adding the first feature" do
        expect(map.center).to eq(Map::DEFAULT_CENTER)
        find(".mapbox-gl-draw_point").click
        click_coord("#maplibre-map", 50, 50)
        wait_for { Feature.point.count }.to eq(1)
        expect(map.reload.center).to eq(Map::DEFAULT_CENTER)
      end
    end
  end

  context "with existing feature on map" do
    let!(:existing_point) { create(:feature, :point_middle) }
    let(:map) { create(:map, features: [ existing_point ], center: [ 11.0, 49.0 ]) }

    it "preserves the map center when adding subsequent features" do
      find(".mapbox-gl-draw_point").click
      click_coord("#maplibre-map", 80, 80)
      wait_for { Feature.point.count }.to eq(2)
      expect(map.reload.center).to eq([ 11.0, 49.0 ])
    end
  end

  context "with polygon on map" do
    let!(:polygon) { create(:feature, :polygon_middle, title: "Poly Title") }
    let(:map) { create(:map, features: [ polygon ]) }

    context "with selected polygon feature" do
      before do
        click_coord("#maplibre-map", 512, 430)
        expect(page).to have_css("#edit-button-edit")
      end

      it "shows feature title + details" do
        expect(page).to have_text("Poly Title")
      end

      it "adds feature id to url" do
        expect(page).to have_current_path("/m/#{map.private_id}?f=#{polygon.id}")
      end

      it "can raw update feature" do
        find("#edit-button-advanced").click
        # Move mouse away from button to dismiss tooltip
        find("#style-json-section-header").hover
        # Click on the Style JSON section header to expand it
        find("#style-json-section-header").click
        expect(page).to have_selector('textarea[name="properties"]', visible: true)
        fill_in "properties", with: '{"title": "TEST"}'
        find(".feature-update").click
        wait_for { polygon.reload.properties["title"] }.to eq("TEST")
      end

      it "can update raw geometry" do
        find("#edit-button-edit").click
        sleep(0.3) # edit triggers modal pull-up
        find("#edit-button-advanced").click
        find("#geometry-json-section-header").click
        expect(page).to have_selector('textarea[name="geometry"]', visible: true)

        coords = [ [ [ 11.0, 49.0 ], [ 11.0, 49.1 ], [ 11.1, 49.1 ], [ 11.1, 49.0 ], [ 11.0, 49.0 ] ] ]
        valid_polygon = { "type" => "Polygon", "coordinates" => coords }.to_json

        fill_in "geometry", with: valid_polygon
        find("#feature-edit-raw-geometry .feature-update").click

        wait_for { polygon.reload.geometry["coordinates"][0].count }.to eq(5)
        expect(polygon.geometry["coordinates"][0].first).to eq([ 11.0, 49.0 ])
        expect(polygon.geometry["coordinates"][0].last).to eq([ 11.0, 49.0 ])
      end

      it "can delete feature" do
        accept_alert do
          find("#edit-button-advanced").click
          find("#edit-button-trash").click
        end
        expect(page).to have_text("Polygon deleted")
        # need to wait until feature is saved server side
        wait_for { Feature.count }.to eq(0)
      end

      it "shows feature meta data" do
        find("#edit-button-edit").click
        expect(page).to have_text("27.64 km²")
      end

      it "can delete a line vertex via context menu (delete midpoint)" do
        xy = viewport_xy_for_lat_lng(polygon.geometry['coordinates'][0][3][1], polygon.geometry['coordinates'][0][3][0])
        find("#edit-button-geometry").click
        # Wait for MapLibre to finish rendering vertex handles after mode change
        page.evaluate_async_script("window.map.once('idle', arguments[0])")
        # click on line vertex with right mouse
        click_coord("#maplibre-map", xy[:x], xy[:y], button: :right)

        expect(page).to have_text("Delete midpoint")
        find(".context-menu-item", text: "Delete midpoint").click
        wait_for { polygon.reload.geometry["coordinates"][0].length }.to eq(4)
      end
    end
  end

  context "with line on map" do
    let!(:line) do
      create(:feature, :line_string,
        coordinates: [ [ 11.041, 49.481 ], [ 11.056, 49.463 ], [ 11.061, 49.450 ] ],
        title: "Line Title")
    end
    let(:map) { create(:map, features: [ line ], center: [ 11.056, 49.463 ], zoom: 15) }

    it "can delete a line vertex via context menu (delete midpoint)" do
      xy = viewport_xy_for_lat_lng(line.geometry['coordinates'][1][1], line.geometry['coordinates'][1][0])
      # click on line
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-geometry").click
      # Wait for MapLibre to finish rendering vertex handles after mode change
      page.evaluate_async_script("window.map.once('idle', arguments[0])")
      # click on line vertex with right mouse
      click_coord("#maplibre-map", xy[:x], xy[:y], button: :right)

      expect(page).to have_text("Delete midpoint")
      find(".context-menu-item", text: "Delete midpoint").click
      wait_for { line.reload.geometry["coordinates"].length }.to eq(2)
    end

    it "can cut line into two segments via context menu (cut line)" do
      xy = viewport_xy_for_lat_lng(line.geometry['coordinates'][1][1], line.geometry['coordinates'][1][0])
      # click on line
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-geometry").click
      # Wait for MapLibre to finish rendering vertex handles after mode change
      page.evaluate_async_script("window.map.once('idle', arguments[0])")
      # click on line vertex with right mouse
      click_coord("#maplibre-map", xy[:x], xy[:y], button: :right)

      find(".context-menu-item", text: "Divide line here").click
      wait_for { map.features.count }.to eq(2)
      expect(map.features.first.geometry["coordinates"]).to eq([ [ 11.041, 49.481 ], [ 11.056, 49.463 ] ])
      expect(map.features.last.geometry["coordinates"]).to eq([ [ 11.056, 49.463 ], [ 11.061, 49.450 ] ])
    end

    it "can reverse line via context menu (reverse track)" do
      xy = viewport_xy_for_lat_lng(line.geometry['coordinates'][1][1], line.geometry['coordinates'][1][0])
      original_coords = line.geometry["coordinates"].dup
      # click on line to select it
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-geometry").click
      # Wait for MapLibre to finish rendering vertex handles after mode change
      page.evaluate_async_script("window.map.once('idle', arguments[0])")
      # right-click directly on the vertex to see if our menu item appears
      click_coord("#maplibre-map", xy[:x], xy[:y], button: :right)

      # Should show both vertex menu items AND reverse track
      expect(page).to have_text("Delete midpoint")
      expect(page).to have_text("Reverse track")
      find(".context-menu-item", text: "Reverse track").click
      expect(page).to have_text("Track reversed")
      wait_for { line.reload.geometry["coordinates"] }.to eq(original_coords.reverse)
    end
  end

  context "with line with route extras on map" do
    let!(:line) { create(:feature, :line_string_with_route_extras, title: "Route Extras Line") }
    let(:map) { create(:map, features: [ line ], center: [ 11.0775, 49.4475 ], zoom: 13) }

    it "can reverse track with route extras indices correctly transformed" do
      xy = viewport_xy_for_lat_lng(line.geometry['coordinates'][2][1], line.geometry['coordinates'][2][0])
      original_coords = line.geometry["coordinates"].dup
      # click on line to select it
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-geometry").click
      # right-click on vertex to open context menu
      click_coord("#maplibre-map", xy[:x], xy[:y], button: :right)

      expect(page).to have_text("Reverse track")
      all(".context-menu-item", text: "Reverse track").first.click
      expect(page).to have_text("Track reversed")

      wait_for { line.reload.geometry["coordinates"] }.to eq(original_coords.reverse)

      extras = line.properties["route"]["extras"]
      expect(extras["steepness"]["values"]).to eq([ [ 0, 1, -2 ], [ 1, 3, 3 ], [ 3, 5, 1 ] ])
      expect(extras["surface"]["values"]).to eq([ [ 0, 2, 10 ], [ 2, 5, 3 ] ])
    end

    it "hides the color picker while the line is colored by a route extra" do
      xy = viewport_xy_for_lat_lng(line.geometry['coordinates'][2][1], line.geometry['coordinates'][2][0])
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-style").click

      expect(page).to have_selector("#stroke-color", visible: true)

      find("#stroke-color-mode").select("Surface")
      expect(page).to have_selector("#stroke-color", visible: false)

      find("#stroke-color-mode").select("Color")
      expect(page).to have_selector("#stroke-color", visible: true)
    end
  end
end
