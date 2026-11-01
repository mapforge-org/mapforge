require "rails_helper"

describe "Feature edit, polygon features" do
  include_context "with an editable map and an elevation stub"

  context "with polygon and target point on map" do
    let!(:polygon) { create(:feature, :polygon_middle, title: "Poly Title") }
    let!(:target) { create(:feature, :point, title: "Target point") }
    let(:map) { create(:map, features: [ polygon, target ]) }

    before do
      click_coord("#maplibre-map", 512, 430)
      find("#edit-button-advanced").click
    end

    def choose_feature_onclick(label)
      find("#feature-onclick").click
      find("#feature-onclick-ui .dropdown-item", text: label).click
    end

    it "can set the click behavior" do
      choose_feature_onclick("Open link")
      find("#feature-onclick-link").fill_in(with: "https://example.org")
      wait_for { polygon.reload.properties.values_at("onclick", "onclick-target") }.to eq([ "link", "https://example.org" ])

      choose_feature_onclick("Go to feature")
      wait_for { polygon.reload.properties.values_at("onclick", "onclick-target") }.to eq([ "feature", nil ])
      find("#feature-onclick-feature").click
      find("#feature-onclick-feature-menu .dropdown-item", text: "Target point").click
      wait_for { polygon.reload.properties["onclick-target"] }.to eq(target.id.to_s)
      expect(page).to have_css("#feature-onclick-feature", text: "Target point")

      choose_feature_onclick("Do nothing")
      wait_for { polygon.reload.properties.values_at("onclick", "onclick-target") }.to eq([ false, nil ])

      choose_feature_onclick("Show details")
      wait_for { polygon.reload.properties.key?("onclick") }.to be false
    end
  end

  context "with polygon on map" do
    let!(:polygon) { create(:feature, :polygon_middle, title: "Poly Title") }
    let(:map) { create(:map, features: [ polygon ]) }

    it "marks the hovered feature with the hover state and the pointer cursor" do
      page.driver.browser.mouse.move(x: 512, y: 430)
      state = "map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id: '#{polygon.id}' })"
      wait_for { page.evaluate_script(state) }.to eq("hover" => true)
      expect(page.evaluate_script("map.getCanvas().style.cursor")).to eq "pointer"
    end

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

  context "with a polygon that does nothing on click" do
    let!(:polygon) { create(:feature, :polygon_middle, properties: { title: "Not clickable", onclick: false }) }
    let(:map) { create(:map, features: [ polygon ]) }

    it "still marks the hovered feature in edit mode" do
      page.driver.browser.mouse.move(x: 512, y: 430)
      state = "map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id: '#{polygon.id}' })"
      wait_for { page.evaluate_script(state) }.to eq("hover" => true)
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
end
