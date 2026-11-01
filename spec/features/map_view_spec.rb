require "rails_helper"

describe "Map public view" do
  let(:map) { create(:map) }
  let(:path) { map.public_map_path }
  let(:current_user) { nil }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    sign_in(current_user) if current_user
    visit path
    expect_map_loaded
  end

  context "with initial map rendering" do
    it "shows map view buttons" do
      expect(page).to have_css(".maplibregl-ctrl-zoom-in")
      expect(page).to have_css(".maplibregl-ctrl-zoom-out")
      expect(page).to have_css(".maplibregl-ctrl-compass")
      expect(page).to have_css(".maplibregl-ctrl-geolocate")
      expect(page).not_to have_css(".maplibregl-ctrl-edit")
    end
  end

  context "maplibre attribution" do
    let(:maplibre_link) { ".maplibregl-ctrl-attrib-inner a[href='https://maplibre.org/']" }

    it "is left to the logo" do
      expect(page).to have_css(".maplibregl-ctrl-logo")
      expect(page).to have_css(".maplibregl-ctrl-attrib")
      expect(page).not_to have_css(maplibre_link, visible: :all)
    end

    it "is in the attribution on phones, where the logo is hidden", :phone do
      expect(page).to have_css(maplibre_link, visible: :all)
    end
  end

  context "with nocontrols=true" do
    let(:path) { "#{map.public_map_path}?nocontrols=true" }

    it "hides the controls but keeps the attribution" do
      expect(page).to have_css(".maplibregl-ctrl-attrib")
      expect(page).not_to have_css(".maplibregl-ctrl-zoom-in")
      expect(page).not_to have_css(".maplibregl-ctrl-geolocate")
      expect(page).not_to have_css(".maplibregl-ctrl-layers")
    end

    context "in edit mode" do
      let(:path) { "#{map.private_map_path}?nocontrols=true" }

      it "hides the mode badge and the edit controls" do
        expect(page).not_to have_css("#map-mode-badge")
        expect(page).not_to have_css(".maplibregl-ctrl-select")
      end
    end
  end

  # features are created before loading the map, to make sure they're loaded via /features
  context "with existing features" do
    # this polygon is in the middle of nbg (default view)
    let(:polygon) { create(:feature, :polygon_middle, title: "Poly Title", desc: "Poly Desc") }
    let(:map) { create(:map, features: [ polygon ]) }

    it "shows feature details on click" do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
      expect(page).to have_text("Poly Title")
      expect(page).to have_text("Poly Desc")
    end

    it "marks a hovered feature without selecting it or showing its details" do
      hover_center_of_screen
      state = "map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id: '#{polygon.id}' })"
      wait_for { page.evaluate_script(state) }.to eq("hover" => true)
      expect(page.evaluate_script("map.getCanvas().style.cursor")).to eq "pointer"
      expect(page).not_to have_css("#feature-details-modal")
    end

    it "sets the selection state on click, but not on hover" do
      selected = "map.getGlobalState().selectedFeatureId"
      hover_center_of_screen
      wait_for { page.evaluate_script("map.getCanvas().style.cursor") }.to eq "pointer"
      expect(page.evaluate_script(selected)).to be_nil

      click_center_of_screen
      wait_for { page.evaluate_script(selected) }.to eq polygon.id.to_s
    end

    it "updates url on feature select" do
      click_center_of_screen
      expect(page).to have_current_path("/m/#{map.public_id}?f=#{polygon.id}")
    end

    it "feature details are sticky on click" do
      click_center_of_screen
      expect(page).to have_text("Poly Desc")
      hover_coord(400, 0)
      expect(page).to have_text("Poly Desc")
      click_coord(".map", 400, 0)
      expect(page).not_to have_text("Poly Desc")
    end

    it "shows layers modal" do
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("#layers-modal")
      expect(page).to have_text("Poly Title")
    end
  end

  context "description popup" do
    let(:map) { create(:map, description: "Map Description") }

    it "hides the popup on later visits when 'Don't show again' is checked" do
      expect(page).to have_css("#description-modal.show")
      check "description-hide", allow_label_click: true

      visit path
      expect_map_loaded
      expect(page).not_to have_css("#description-modal.show")
    end
  end

  context "edit mode without login" do
    let(:map) { create(:map, name: "Named, so the settings modal stays closed") }
    let(:path) { map.private_map_path }

    it "shows the bookmark notice until dismissed, and again on the next visit" do
      expect(page).to have_css("#edit-notice", text: "Bookmark the edit link")
      find("#edit-notice .notice-close").click
      expect(page).not_to have_css("#edit-notice", visible: true)

      visit path
      expect_map_loaded
      expect(page).to have_css("#edit-notice", text: "Bookmark the edit link")
    end

    it "offers the mode toggle and keeps the notice in view mode" do
      find("#map-mode-badge a", text: /view mode/i).click
      expect(page).to have_css("#map-mode-badge .active", text: /view mode/i)
      expect(page).to have_current_path("/m/#{map.public_id}")
      expect(page).to have_css("#edit-notice", text: "Bookmark the edit link")
    end

    # A modal pushes a history entry without Turbo state, and Turbo ignores a popstate
    # to such an entry. The map layout opts out of Turbo, so the login page is a full load.
    it "comes back from the login page with the browser back button" do
      find(".maplibregl-ctrl-map").click
      find("#settings-modal .modal-close-button").click
      within("#edit-notice") { click_link "log in" }
      expect(page).to have_css("#login")

      page.go_back
      expect_map_loaded
      expect(page).to have_css("#edit-notice", text: "Bookmark the edit link")
    end
  end

  context "settings modal" do
    let(:map) { create(:map, description: "Map Description") }

    it "renders live updates to description" do
      find(".maplibregl-ctrl-map").click
      expect(page).to have_text("Map Description")
      map.update(description: "**New De5cr1pt1on**")
      expect(page).to have_text("New De5cr1pt1on")
    end
  end

  context "with feature id in url" do
    # this polygon is in the middle of nbg (default view)
    let!(:polygon) {
      create(:feature, :polygon_middle, layer: map.layers.first,
        properties: { title: "F title" })
    }
    let(:path) { map_path(id: map.private_id, f: polygon.id) }

    it "shows feature" do
      expect(page).to have_css("#feature-details-modal")
      expect(page).to have_text("F title")
    end
  end

  context "with features that don't have properties" do
    # this polygon is in the middle of nbg (default view)
    let(:polygon) { create(:feature, :polygon_middle, properties: nil) }
    let(:map) { create(:map, features: [ polygon ]) }

    it "shows feature details on click" do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
    end
  end

  context "with not clickable features" do
    let(:polygon) {
      create(:feature, :polygon_middle,
        properties: { title: "Not clickable", onclick: false })
    }
    let(:map) { create(:map, features: [ polygon ]) }

    it "does not show feature details on hover" do
      hover_center_of_screen
      expect(page).not_to have_css("#feature-details-modal")
    end

    it "does not mark the feature on hover" do
      hover_center_of_screen
      sleep 0.5 # a hover state would be set in the next frame
      state = "map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id: '#{polygon.id}' })"
      expect(page.evaluate_script(state)).to be_empty
      expect(page.evaluate_script("map.getCanvas().style.cursor")).to eq ""
    end

    it "does not show feature details on click" do
      click_center_of_screen
      expect(page).not_to have_css("#feature-details-modal")
    end
  end

  context "with a script link feature" do
    let(:polygon) {
      create(:feature, :polygon_middle,
        properties: { title: "script link", onclick: "link", "onclick-target": "javascript:window.pwned = true" })
    }
    let(:map) { create(:map, features: [ polygon ]) }

    it "does not run the script on click" do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
      expect(page.evaluate_script("window.pwned")).to be_nil
    end
  end

  context "with description banners" do
    let(:target) { create(:feature, :point, title: "Target point") }
    let(:map) { create(:map, features: [ point, target ]) }

    def banner_point(onclick)
      create(:feature, :point_middle, desc: "Banner text", properties: { "show-desc" => "banner" }.merge(onclick))
    end

    context "with a feature link" do
      let(:point) { banner_point("onclick" => "feature", "onclick-target" => target.id.to_s) }

      it "flies to the target feature on a click on the banner" do
        find(".desc-banner", text: "Banner text").click
        expect(page).to have_current_path("/m/#{map.public_id}?f=#{target.id}")
      end
    end

    context "with no click reaction" do
      let(:point) { banner_point("onclick" => false) }

      it "ignores a click on the banner" do
        find(".desc-banner", text: "Banner text").click
        expect(page).not_to have_css("#feature-details-modal")
      end
    end
  end

  context "with feature link features" do
    let(:point) { create(:feature, :point, title: "Target point") }
    let(:polygon) {
      create(:feature, :polygon_middle,
        properties: { title: "feature link", onclick: "feature", "onclick-target": point.id })
    }
    let(:map) { create(:map, features: [ polygon, point ]) }

    it "flies to target feature on click" do
      click_center_of_screen
      # animation is finished when feature details are shown
      expect(page).to have_text("Target point")
      expect(page.evaluate_script("[map.getCenter().lng.toFixed(4), map.getCenter().lat.toFixed(4)].toString()"))
        .to eq("11.0557,49.4732")
      expect(page).to have_current_path("/m/#{map.public_id}?f=#{point.id}")
    end
  end

  context "with features added server side" do
    # feature is created after loading the map, to make sure it's loaded via websocket
    it "receives new features via websocket channel" do
      create(:feature, :polygon_middle, layer: map.layers.first, title: "New Title")
      wait_for_feature("New Title")
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
      expect(page).to have_text("New Title")
    end
  end
end
