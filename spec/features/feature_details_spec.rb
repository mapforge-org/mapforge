require "rails_helper"

describe "Feature details" do
  let(:feature) { create(:feature, :polygon_middle, title: "Poly Title") }
  let(:map) { create(:map, features: [ feature ]) }
  let(:path) { map.private_map_path }

  before do
    visit path
    expect_map_loaded
  end

  context "mobile", :phone do
    before do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
    end

    context "with selected feature" do
      it "opens a feature without description at the height of its content" do
        expect(page).to have_css("#feature-details-modal.modal-pull-min")
        scroll = ".feature-modal-scroll"
        wait_for { page.evaluate_script("document.querySelector('#{scroll}').scrollHeight") }
          .to eq(page.evaluate_script("document.querySelector('#{scroll}').clientHeight"))
        viewport = page.evaluate_script("window.innerHeight")
        expect(element_offset_height("#feature-details-modal")).to be < viewport * 0.45
        # the edit tabs of the rw mode need the meta line
        expect(page).to have_css("#feature-details-meta")
      end

      it "can enlarge modal with pull-up button" do
        initial_height = element_offset_height("#feature-details-modal")
        find(".modal-pull-button").click
        sleep(0.3)
        enlarged_height = element_offset_height("#feature-details-modal")
        expect(enlarged_height).to be > initial_height
      end
    end

    context "with a description" do
      let(:feature) { create(:feature, :polygon_middle, title: "Poly Title", description: "Some text") }

      it "opens at modal-pull-middle" do
        expect(page).to have_css("#feature-details-modal.modal-pull-middle")
      end
    end

    context "in view mode" do
      let(:path) { map.public_map_path }

      it "shows the title only" do
        expect(page).to have_css("#feature-details-modal.modal-pull-min")
        expect(page).to have_css("#feature-title", text: "Poly Title")
        expect(page).not_to have_css("#feature-details-meta")
      end
    end
  end

  context "mobile with a selected line with elevation", :phone do
    let(:feature) { create(:feature, :line_string_with_elevation) }
    let(:path) { map_path(id: map.public_id, f: feature.id) }

    it "opens at modal-pull-middle for the elevation chart" do
      expect(page).to have_css("#feature-details-modal.modal-pull-middle")
    end

    it "shows the export bar only at the end of the content" do
      expect(page).to have_css("#feature-details-modal.modal-pull-middle")
      bar_below_view = <<~JS
        (() => {
          const scroll = document.querySelector('.feature-modal-scroll').getBoundingClientRect()
          return document.querySelector('#feature-export-bar').getBoundingClientRect().top >= scroll.bottom
        })()
      JS
      wait_for { page.evaluate_script(bar_below_view) }.to be true
      page.execute_script("document.querySelector('.feature-modal-scroll').scrollTo(0, 100000)")
      wait_for { page.evaluate_script(bar_below_view) }.to be false
    end
  end

  context "click tolerance on a thin line" do
    # horizontal line, so a vertical offset is the perpendicular distance in pixels.
    # At zoom 5 the line renders 4px wide, and the click tolerance adds 8px on each side.
    let(:feature) do
      create(:feature, title: "Thin Track",
        geometry: { "type" => "LineString", "coordinates" => [ [ 10.0, 49.47 ], [ 12.0, 49.47 ] ] })
    end
    let(:map) { create(:map, features: [ feature ], center: [ 11.0, 49.47 ], zoom: 5) }

    it "selects the line when the click misses it by 8 pixels" do
      point = viewport_xy_for_lat_lng(49.47, 11.0)
      click_coord("#maplibre-map", point[:x], point[:y] + 8)
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
    let(:map) do
      create(:map, features: [
        create(:feature, :polygon_middle, title: "Poly"),
        create(:feature, :point_middle, title: "Point 1"),
        create(:feature, :point_middle, title: "Point 2"),
        create(:feature, :point_middle, title: "Hidden", properties: { "marker-size" => "150", "onclick" => false })
      ])
    end

    it "cycles through all overlapping features on repeated clicks" do
      titles = []
      4.times do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal.show")
        titles << find("#feature-title").text
      end
      expect(titles.uniq).to contain_exactly("Poly", "Point 1", "Point 2", "Hidden")
    end

    context "mobile", :phone do
      it "keeps a manual sheet height for the next feature" do
        click_center_of_screen
        expect(page).to have_css("#feature-details-modal.show")
        first_title = find("#feature-title").text
        # the state that a drag of the sheet leaves behind
        page.execute_script(<<~JS)
          const modal = document.querySelector('#feature-details-modal')
          modal.dataset.userSized = 'true'
          modal.style.height = '35vh'
        JS
        viewport = page.evaluate_script("window.innerHeight")

        click_center_of_screen
        expect(page).not_to have_css("#feature-title", text: first_title, exact_text: true)
        expect(element_offset_height("#feature-details-modal")).to be_within(5).of(viewport * 0.35)
      end
    end

    context "in view mode" do
      let(:path) { map.public_map_path }

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

  # the export responses are covered by the request spec spec/requests/maps_controller_spec.rb,
  # these links get the feature id and title from JavaScript
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
    end
  end

  context "tabs" do
    it "keeps the open tab when the open feature is selected again, the details tab goes back" do
      click_center_of_screen
      find("#edit-button-style").click
      expect(page).to have_css("#edit-button-style.active")

      click_center_of_screen
      expect(page).to have_css("#edit-button-style.active")
      expect(page).to have_no_css("#feature-details-body")

      find("#edit-button-details").click
      expect(page).to have_css("#edit-button-details.active")
      expect(page).to have_css("#feature-details-body")
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

    def fake_standalone
      # headless Chrome cannot emulate display-mode, so fake it for isApp()
      page.execute_script(<<~JS)
        const original = window.matchMedia.bind(window)
        window.matchMedia = query => query.includes('display-mode: standalone') ? { matches: true } : original(query)
      JS
    end

    it "opens the image inside the map when the app runs standalone" do
      fake_standalone
      find(".feature-symbol a").click

      expect(page).to have_css("#image-viewer[open] img[src='/image/none.webp']", visible: :all)
      expect(page).to have_css("#feature-details-modal.show")
      expect(page).to have_current_path(map.private_map_path, ignore_query: true)
    end

    def viewport_content
      page.evaluate_script("document.querySelector('meta[name=\"viewport\"]').content")
    end

    it "allows pinch zoom while the maximized image is open" do
      fake_standalone
      expect(viewport_content).to include("user-scalable=no")

      find(".feature-symbol a").click
      expect(page).to have_css("#image-viewer[open]", visible: :all)
      expect(viewport_content).not_to include("user-scalable", "maximum-scale")

      find("#image-viewer .modal-close-button").click
      expect(page).to have_no_css("#image-viewer[open]", visible: :all)
      # the page viewport returns one frame after the scale lock, so let the matcher retry
      expect(page).to have_css('meta[name="viewport"][content*="user-scalable=no"][content*="maximum-scale=1.0"]',
        visible: :all)
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

    it "shows the length, ascent and descent and counts the points of a line without waypoints" do
      expect(page).to have_css("#feature-title", text: "Elevation Track")
      expect(page).to have_css("#feature-subtitle", text: "Line · 6 points")
      expect(page).to have_css(".feature-stat", text: /Ascent\s+50 m/)
      expect(page).to have_css(".feature-stat", text: /Descent\s+60 m/)
      expect(page).to have_css(".feature-stat", text: "Length")
    end

    it "shows the point under the mouse" do
      expect(page).to have_css("#elevation-here.idle", text: "Point at the profile or the route")
      find("#route-elevation-chart").hover
      expect(page).to have_css("#elevation-here:not(.idle)", text: "km")
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

    context "with a route" do
      let(:feature) {
        create(:feature, :line_string_with_elevation, title: "Elevation Track").tap { |feature|
          feature.update!(properties: feature.properties.merge("route" => { "profile" => "foot" }))
        }
      }

      it "marks the hovered point of the track in the chart" do
        xy = viewport_xy_for_lat_lng(49.45, 11.08)
        hover_coord(xy[:x], xy[:y])
        expect(page).to have_css(".feature-hover-info .hover-position .bi-triangle")
        expect(page).to have_css("#elevation-here", text: "350 m")
        active = page.evaluate_async_script(<<~JS)
          const done = arguments[0]
          import('chart.js').then(m => done(
            m.Chart.getChart(document.getElementById('route-elevation-chart')).getActiveElements().map(e => e.index)))
        JS
        expect(active).to eq [ 2 ]

        hover_coord(xy[:x] + 300, xy[:y] - 300)
        expect(page).to have_css("#elevation-here.idle")
      end
    end

    context "with a routed duration" do
      let(:feature) {
        create(:feature, :line_string_with_elevation).tap { |feature|
          feature.update!(properties: feature.properties.merge(
            "route" => { "profile" => "foot", "duration" => 9900, "waypoints" => [ [ 11.06, 49.46 ], [ 11.095, 49.435 ] ] }))
        }
      }

      it "shows the walking time and counts the waypoints" do
        expect(page).to have_css("#feature-title", text: "Untitled route")
        expect(page).to have_css("#feature-subtitle", text: "Hike · 2 waypoints")
        expect(page).to have_css(".feature-stat", text: /Walking time\s+≈ 2:45 h/)
      end
    end
  end

  context "route extras analysis" do
    let(:feature) { create(:feature, :line_string_with_route_extras, title: "Route Extras Track") }
    let(:map) { create(:map, features: [ feature ]) }

    before do
      click_center_of_screen
      expect(page).to have_css("#feature-details-modal")
    end

    it "shows the gradient from the elevation, with the steepest spots" do
      card = find(".extras-card", text: "Steepness")
      expect(card).to have_css(".extras-totals-label", count: 3)
      expect(card).to have_text("Downhill")
      expect(card).to have_text("Flat")
      expect(card).to have_text("Uphill")
      expect(card).to have_text("Steepest point +3 % at km")
      expect(card).to have_text(/Steepest descent −\d+ % at km/)
    end

    it "lists the surfaces, the longest first" do
      card = find(".extras-card", text: "Surface")
      expect(card.all(".extras-totals-label").map(&:text)).to eq [ "Asphalt", "Gravel" ]
    end

    it "draws the surface band below the chart" do
      # the alpha of a pixel in the band, near its end, behind the label at its start
      alpha = page.evaluate_async_script(<<~JS)
        const done = arguments[0]
        import('chart.js').then(m => {
          const chart = m.Chart.getChart(document.getElementById('route-elevation-chart'))
          const { right, bottom } = chart.chartArea
          const ratio = chart.currentDevicePixelRatio
          done(chart.ctx.getImageData((right - 5) * ratio, (bottom + 12) * ratio, 1, 1).data[3])
        })
      JS
      expect(alpha).to eq 255
    end
  end
end
