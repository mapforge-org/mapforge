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

    # the accept value per login state is server rendered, see spec/requests/maps_controller_spec.rb
    it "copies the accept value of the import tile to the file picker" do
      click_button "Import data (gpx, kml)"
      expect(page.evaluate_script("document.querySelector('#fileInput').accept"))
        .to eq ".gpx,.kml,.kmz,.geojson,.json"
    end

    it "starts the bike route mode" do
      click_button "Bicycle route"
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
end
