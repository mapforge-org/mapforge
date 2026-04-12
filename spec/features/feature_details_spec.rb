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

  context "elevation profile" do
    let(:feature) { create(:feature, :line_string_with_elevation, title: "Elevation Track") }
    let(:map) { create(:map, features: [ feature ]) }

    before do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
    end

    it "shows elevation section with chart" do
      expect(page).to have_css("#feature-details-elevation")
      expect(page).to have_css("#route-elevation-chart")
    end

    it "shows elevation gain and loss stats" do
      expect(page).to have_css("#elevation-stats")
      expect(page).to have_css("#elevation-gain")
      expect(page).to have_css("#elevation-loss")
    end

    it "can toggle between visible section and full track" do
      scope = find("#elevation-scope-toggle")
      expect(scope).to have_text("Visible section")
      scope.click
      expect(scope).to have_text("Full track")
      scope.click
      expect(scope).to have_text("Visible section")
    end

    it "can collapse and expand elevation profile" do
      expect(page).not_to have_css("#elevation-content.hidden", visible: :all)
      find("#elevation-toggle").click
      expect(page).to have_css("#elevation-content.hidden", visible: :all)
      find("#elevation-toggle").click
      expect(page).not_to have_css("#elevation-content.hidden", visible: :all)
    end
  end

  context "route extras analysis" do
    let(:feature) { create(:feature, :line_string_with_route_extras, title: "Route Extras Track") }
    let(:map) { create(:map, features: [ feature ]) }

    before do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
    end

    it "shows analysis sections for available extras" do
      expect(page).to have_css("#feature-details-extras")
      expect(page).to have_text("Steepness analysis")
      expect(page).to have_text("Surface analysis")
      expect(page).to have_text("Green areas analysis")
      expect(page).to have_text("Noise level analysis")
    end

    it "shows stacked color bars for each section" do
      expect(page).to have_css(".extras-totals-bar", count: 4)
    end

    it "can expand steepness details" do
      steepness_header = find(".extras-totals-header", text: "Steepness")
      steepness_header.click
      expect(page).to have_text("Slight uphill")
    end

    it "can expand surface details" do
      surface_header = find(".extras-totals-header", text: "Surface")
      surface_header.click
      expect(page).to have_text("Asphalt")
      expect(page).to have_text("Gravel")
    end

    it "detail rows are collapsed by default" do
      expect(page).to have_css(".extras-totals-list.hidden", count: 4, visible: :all)
    end

    it "shows chevron indicator that toggles on expand" do
      expect(page).to have_css(".extras-totals-chevron.bi-chevron-down", count: 4)
      find(".extras-totals-header", text: "Steepness").click
      expect(page).to have_css(".extras-totals-chevron.bi-chevron-up", minimum: 1)
    end
  end
end
