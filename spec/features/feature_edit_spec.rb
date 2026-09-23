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
        expect(page).to have_text("Polygon 'Poly Title' deleted")
        # need to wait until feature is saved server side
        wait_for { Feature.count }.to eq(0)
      end

      it "shows feature meta data" do
        find("#edit-button-edit").click
        expect(page).to have_text("27.64 km²")
      end

      it "can upload a background image" do
        find("#edit-button-edit").click
        find("#edit-button-style").click
        image_path = Rails.root.join("spec", "fixtures", "files", "mapforge-logo-icon.png")
        page.driver.execute_script("document.querySelector('#fill-image').classList.remove('visually-hidden')")
        attach_file("fill-image", image_path)

        wait_for { polygon.reload.properties["fill-image-url"] }.to match(%r{image/.+})
        # the image covers the fill, so the fill steps back and the slider fades the image
        expect(polygon.properties["fill"]).to eq("transparent")
        expect(polygon.properties["fill-opacity"]).to eq(1)
        # the channel stores the properties first and attaches the image after that
        wait_for { polygon.reload.image&.public_id }.to match(/mapforge-logo-icon-\d+.webp/)
      end

      it "can set a background pattern" do
        find("#edit-button-edit").click
        find("#edit-button-style").click
        check("fill-color-transparent")
        wait_for { polygon.reload.properties["fill"] }.to eq("transparent")

        # the first pattern is on right away, the menu changes it
        find("#fill-pattern-button").click
        wait_for { polygon.reload.properties["fill-pattern"] }.to eq("hatch")
        find("#fill-pattern-menu [data-pattern='dots']").click
        wait_for { polygon.reload.properties["fill-pattern"] }.to eq("dots")
        # a second component on the button would keep the menu open, see the comment in _edit_ui
        expect(page).to have_no_css("#fill-pattern-menu.show")
        # the map draws the tile of the pattern on demand, see pattern_image.js
        wait_for { page.evaluate_script("window.map.listImages().filter(n => n.startsWith('pattern-'))") }
          .to include(a_string_starting_with("pattern-dots|"))

        # 'Fill' takes the pattern off again, so the row needs no remove button
        find("#fill-plain-button").click
        wait_for { polygon.reload.properties["fill-pattern"] }.to be_nil
        # the background buttons leave the transparent fill of the owner alone
        expect(polygon.properties["fill"]).to eq("transparent")
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

      it "can move the whole polygon" do
        original = polygon.geometry["coordinates"][0]
        find("#edit-button-geometry").click
        find("#geometry-mode-ui [data-geometry-mode='move']").click
        expect(page).to have_text("Drag the polygon to move it")
        # draw hands the move mode layers to a worker, a forced repaint makes 'idle' fire after that
        page.evaluate_async_script("window.map.once('idle', arguments[0]); window.map.triggerRepaint()")
        drag_coord(512, 430, 612, 430)

        wait_for { polygon.reload.geometry["coordinates"][0].first }.not_to eq(original.first)
        moved = polygon.geometry["coordinates"][0]
        expect(moved.length).to eq(original.length)
        offsets = moved.zip(original).map { |m, o| [ (m[0] - o[0]).round(6), (m[1] - o[1]).round(6) ] }
        expect(offsets.uniq.length).to eq(1)
        expect(offsets.first[0]).to be > 0
      end

      it "can rotate the whole polygon" do
        original = polygon.geometry["coordinates"][0]
        find("#edit-button-geometry").click
        find("#geometry-mode-ui [data-geometry-mode='rotate']").click
        expect(page).to have_text("Drag the polygon to rotate it")
        page.evaluate_async_script("window.map.once('idle', arguments[0]); window.map.triggerRepaint()")
        center = viewport_xy_for_lat_lng(49.4476, 11.0853)
        drag_coord(center[:x] + 60, center[:y], center[:x], center[:y] - 60)

        wait_for { polygon.reload.geometry["coordinates"][0].first }.not_to eq(original.first)
        rotated = polygon.geometry["coordinates"][0]
        expect(rotated.length).to eq(original.length)
        offsets = rotated.zip(original).map { |m, o| [ (m[0] - o[0]).round(6), (m[1] - o[1]).round(6) ] }
        expect(offsets.uniq.length).to be > 1
        centroid = ->(ring) { ring[0..-2].transpose.map { |c| c.sum / c.length } }
        centroid.(rotated).zip(centroid.(original)).each { |r, o| expect(r).to be_within(0.0001).of(o) }
      end
    end
  end

  context "with triangle on map" do
    let!(:triangle) {
      create(:feature, :polygon_middle, geometry: { "type" => "Polygon", "coordinates" =>
        [ [ [ 11.0406078, 49.4665013 ], [ 11.0402645, 49.4285336 ],
          [ 11.130215, 49.4283102 ], [ 11.0406078, 49.4665013 ] ] ] })
    }
    let(:map) { create(:map, features: [ triangle ]) }

    # an image source takes four corners, so the button stays off and its tooltip says why
    it "offers no background image" do
      xy = viewport_xy_for_lat_lng(49.435, 11.055)
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-edit").click
      find("#edit-button-style").click

      expect(page).to have_css("#fill-image-button[disabled]")
      find("#fill-image-button").hover
      expect(page).to have_css(".tooltip-inner", text: "Needs a polygon with four corners")
    end
  end

  context "with line on map" do
    let!(:line) do
      create(:feature, :line_string,
        coordinates: [ [ 11.041, 49.481 ], [ 11.056, 49.463 ], [ 11.061, 49.450 ] ],
        title: "Line Title")
    end
    let(:map) { create(:map, features: [ line ], center: [ 11.056, 49.463 ], zoom: 15) }

    it "can move the whole line" do
      coords = line.geometry["coordinates"]
      xy = viewport_xy_for_lat_lng(coords[1][1], coords[1][0])
      click_coord("#maplibre-map", xy[:x], xy[:y])
      find("#edit-button-geometry").click
      find("#geometry-mode-ui [data-geometry-mode='move']").click
      # draw hands the move mode layers to a worker, a forced repaint makes 'idle' fire after that
      page.evaluate_async_script("window.map.once('idle', arguments[0]); window.map.triggerRepaint()")
      drag_coord(xy[:x], xy[:y], xy[:x] + 100, xy[:y])

      # the elevation stub replaces the saved coordinates, so the moved line is read from draw
      moved = page.evaluate_script("window.draw.get('#{line.id}').geometry.coordinates")
      expect(moved.length).to eq(3)
      offsets = moved.zip(coords).map { |m, o| (m[0] - o[0]).round(6) }
      expect(offsets.uniq.length).to eq(1)
      expect(offsets.first).to be > 0
    end

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
