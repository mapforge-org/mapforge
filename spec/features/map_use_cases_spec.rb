require "rails_helper"

describe "Map settings use cases" do
  subject(:map) { create(:map) }

  context "with an empty map in rw mode" do
    before do
      visit map.private_map_path
      expect_map_loaded
    end

    it "opens the settings modal" do
      expect(page).to have_css("#settings-modal.show")
      expect(page).to have_text("What do you want to do?")
    end

    it "closes the modal on 'paint objects'" do
      click_button "Paint objects on the map"
      expect(page).to have_no_css("#settings-modal.show")
    end

    it "offers the import without images" do
      expect(page).to have_text("Please log in to upload images")
      click_button "Import data (gpx, kml)"
      expect(page.evaluate_script("document.querySelector('#fileInput').accept"))
        .to eq ".gpx,.kml,.kmz,.geojson,.json"
    end

    it "starts the bike route mode" do
      click_button "Bike route"
      expect(page).to have_no_css("#settings-modal.show")
      expect(page).to have_css(".ctrl-line-menu:not(.hidden) .mapbox-gl-draw_bicycle.active")
      expect(page.evaluate_script("draw.getMode()")).to eq("directions_bike")
    end

    it "opens the layers modal on 'OpenStreetMap data'" do
      click_button "Add OpenStreetMap layers"
      expect(page).to have_no_css("#settings-modal.show")
      expect(page).to have_css("#layers-modal.show")
    end

    it "imports map data but not images from the layers modal" do
      click_button "Add OpenStreetMap layers"
      click_button "Import"
      within("#import-dropdown") do
        expect(page).to have_button("Images and photos", disabled: true)
        expect(page).to have_button("Map data (gpx, kml, geojson)", disabled: false)
        find("li[data-toggle='tooltip']").hover
      end
      expect(page).to have_css(".tooltip-inner", text: "Please log in to upload images")
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "track.gpx"))
      wait_for { map.reload.features.count }.to eq 2
    end
  end

  context "with a named map in rw mode" do
    subject(:map) { create(:map, name: "Use case test") }

    it "collapses the use cases" do
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-map").click
      expect(page).to have_css("details.feature-section-card:not([open])")
      find("summary", text: "What do you want to do?").click
      expect(page).to have_css("details.feature-section-card[open]")
    end
  end

  context "with a logged in user" do
    let(:user) { create :user }

    it "offers the import options" do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit map.private_map_path
      expect_map_loaded
      expect(page).to have_no_text("Please log in to upload images")
      click_button "Import data (gpx, kml, image)"
      expect(page.evaluate_script("document.querySelector('#fileInput').accept"))
        .to eq ".gpx,.kml,.kmz,.geojson,.json,image/*"
    end
  end

  context "in ro mode" do
    it "does not render the use cases" do
      visit map.public_map_path
      expect_map_loaded
      expect(page).to have_no_css(".welcome-tiles", visible: :all)
    end
  end
end
