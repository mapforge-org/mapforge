require "rails_helper"

describe "Feature details" do
  let(:feature) { create(:feature, :polygon_middle, title: "Poly Title") }
  let(:map) { create(:map, features: [ feature ]) }

  before do
    visit map.private_map_path
    expect_map_loaded
  end

  context "mobile", :phone do
    context "with selected feature" do
      before do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal")
      end

      it "opens at the height of its content" do
        viewport = page.evaluate_script("window.innerHeight")
        # a feature without a description used to open at the 25% of modal-pull-down
        wait_for { element_offset_height("#feature-details-modal") }.to be > (viewport * 0.25)
        # the map of the feature stays visible above the sheet
        expect(element_offset_height("#feature-details-modal")).to be < (viewport * 0.8)
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

  context "click tolerance on a thin line" do
    # horizontal line, so a vertical offset is the perpendicular distance in pixels.
    # At zoom 5 the line renders 4px wide, and the click tolerance adds 12px on each side.
    let(:feature) do
      create(:feature, title: "Thin Track",
        geometry: { "type" => "LineString", "coordinates" => [ [ 10.0, 49.47 ], [ 12.0, 49.47 ] ] })
    end
    let(:map) { create(:map, features: [ feature ], center: [ 11.0, 49.47 ], zoom: 5) }

    it "selects the line when the click misses it by 12 pixels" do
      point = viewport_xy_for_lat_lng(49.47, 11.0)
      click_coord("#maplibre-map", point[:x], point[:y] + 12)
      expect(page).to have_css("#feature-details-modal")
      expect(find("#feature-title").text).to eq("Thin Track")
    end

    it "selects nothing when the click misses it by 40 pixels" do
      point = viewport_xy_for_lat_lng(49.47, 11.0)
      click_coord("#maplibre-map", point[:x], point[:y] + 40)
      expect(page).not_to have_css("#feature-details-modal")
    end
  end

  context "cycling through overlapping features" do
    let(:polygon) { create(:feature, :polygon_middle, title: "Poly") }
    let(:point1) { create(:feature, :point_middle, title: "Point 1") }
    let(:point2) { create(:feature, :point_middle, title: "Point 2") }
    let(:map) { create(:map, features: [ polygon, point1, point2, create(:feature, :point_middle, title: "Hidden", properties: { "marker-size" => "150", "onclick" => false }) ]) }

    it "cycles through all overlapping features on repeated clicks" do
      titles = []
      4.times do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal.show")
        titles << find("#feature-title").text
      end
      expect(titles.uniq).to contain_exactly("Poly", "Point 1", "Point 2", "Hidden")
    end

    context "in view mode" do
      before do
        visit map.public_map_path
        expect_map_loaded
      end

      it "skips features with onclick false" do
        titles = []
        4.times do
          click_center_of_screen
          expect(page).to have_css("#feature-details-modal.show")
          titles << find("#feature-title").text
        end
        expect(titles).not_to include("Hidden")
        expect(titles.uniq).to contain_exactly("Poly", "Point 1", "Point 2")
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

  context "image marker" do
    let(:feature) do
      create(:feature, :point_middle, properties: { "marker-size" => "150", "marker-image-url" => "/icon/none.webp" })
    end
    let(:map) { create(:map, features: [ feature ]) }

    before do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
    end

    it "opens the image in a new window" do
      expect(page).to have_css(".feature-symbol a[target='_blank'][href='/image/none.webp']")
      find(".feature-symbol a").click
      expect(page).to have_no_css("#image-viewer[open]")
    end

    it "opens the image inside the map when the app runs standalone" do
      # headless Chrome cannot emulate display-mode, so fake it for isApp()
      page.execute_script(<<~JS)
        const original = window.matchMedia.bind(window)
        window.matchMedia = query => query.includes('display-mode: standalone') ? { matches: true } : original(query)
      JS
      find(".feature-symbol a").click

      expect(page).to have_css("#image-viewer[open] img[src='/image/none.webp']", visible: :all)
      expect(page).to have_css("#feature-details-modal.show")
      expect(page).to have_current_path(map.private_map_path, ignore_query: true)
    end
  end

  context "elevation profile" do
    let(:feature) { create(:feature, :line_string_with_elevation, title: "Elevation Track") }
    let(:map) { create(:map, features: [ feature ]) }

    def gps_chart_index
      page.evaluate_async_script(<<~JS)
        const done = arguments[0]
        import('chart.js').then(m => done(
          m.Chart.getChart(document.getElementById('route-elevation-chart'))?._gpsChartIndex ?? null))
      JS
    end

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

    it "keeps the gps position marker when the chart is rebuilt" do
      # 11.08, 49.45 is the third vertex of the :line_string_with_elevation track
      page.execute_script(
        "window.dispatchEvent(new CustomEvent('gps-position', " \
        "{ detail: { lng: 11.08, lat: 49.45 } }))"
      )
      wait_for { gps_chart_index }.not_to be_nil

      # returning to the details tab destroys the chart and builds a new one
      find("#edit-button-details").click
      wait_for { gps_chart_index }.not_to be_nil
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
    end

    it "shows stacked color bars for each section" do
      expect(page).to have_css(".extras-totals-bar", count: 2)
    end

    it "can expand steepness details" do
      steepness_header = find(".feature-details-card-header", text: "Steepness")
      steepness_header.click
      expect(page).to have_text("Slight uphill")
    end

    it "can expand surface details" do
      surface_header = find(".feature-details-card-header", text: "Surface")
      surface_header.click
      expect(page).to have_text("Asphalt")
      expect(page).to have_text("Gravel")
    end

    it "detail rows are collapsed by default" do
      expect(page).to have_css(".extras-totals-list.hidden", count: 2, visible: :all)
    end

    it "shows chevron indicator that toggles on expand" do
      expect(page).to have_css(".extras-totals-chevron.bi-chevron-down", count: 2)
      find(".feature-details-card-header", text: "Steepness").click
      expect(page).to have_css(".extras-totals-chevron.bi-chevron-up", minimum: 1)
    end
  end
end
