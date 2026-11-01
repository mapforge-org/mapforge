require "rails_helper"

describe "Feature edit, line features" do
  include_context "with an editable map and an elevation stub"

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
