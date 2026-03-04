require "rails_helper"

describe "Feature details" do
  let(:feature) { create(:feature, :polygon_middle, title: "Poly Title") }
  let(:map) { create(:map, features: [ feature ]) }

  before do
    visit map.private_map_path
    expect_map_loaded
  end

  context "mobile", :mobile do
    context "with selected feature" do
      before do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal")
      end

      it "can enlarge modal with pull-up button" do
        initial_height = element_offset_height("#feature-details-modal")
        find(".modal-pull-button").click
        sleep(0.3)
        enlarged_height = element_offset_height("#feature-details-modal")
        expect(enlarged_height).to be > initial_height
      end
    end
  end

  context "export" do
    let(:feature) { create(:feature, :polygon_middle, title: "Poly Title") }
    let(:map) { create(:map, features: [ feature ]) }

    context "with selected feature" do
      before do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal")
      end

      it "has share geojson link" do
        expect(page).to have_link("GeoJSON", href: "/m/" + map.public_id + "/feature/" + feature.id + ".geojson" + "/Poly_Title.geojson")
      end

      it "has share gpx link" do
        expect(page).to have_link("GPX", href: "/m/" + map.public_id + "/feature/" + feature.id + ".gpx" + "/Poly_Title")
      end

      it "can download feature gpx export" do
        visit "/m/" + map.public_id + "/feature/" + feature.id + ".gpx" + "/Poly_Title"
        file = wait_for_download("Poly Title.gpx", timeout: 10)
        expect(File.read(file).scan(/<gpx/i).size).to eq(1)
      end

      it "can download feature geojson export" do
        find("#feature-export-geo").click
      end
    end
  end
end
