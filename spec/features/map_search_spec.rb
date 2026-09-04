require "rails_helper"

describe "Map places search" do
  let(:map) { create(:map, name: "Search test") }
  let(:map_path) { map.public_map_path }
  let(:queries) { [] }
  let(:control_js) { "document.querySelector('.maplibregl-ctrl-geocoder')" }

  def last_query
    queries.last || {}
  end

  # the marker of a result draws only after its circle image is built, and a click on the
  # map before that misses the marker. the result row appears earlier than the marker.
  def wait_for_result_markers
    layer = "symbols-layer_search-source-results"
    wait_for {
      page.evaluate_script(
        "map.getLayer('#{layer}')" \
        " ? map.queryRenderedFeatures({ layers: ['#{layer}'] }).length : 0"
      )
    }.to be > 0
  end

  before do
    photon_file = File.read(Rails.root.join("spec", "fixtures", "files", "photon.json"))
    # photon has no url parameter, so the endpoint can ride along in the recorded query
    CapybaraMock.stub_request(:get, /photon\.komoot\.io/).to_return do |query:, url:, **|
      queries << query.merge("url" => url)
      [ 200,
        { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
        photon_file ]
    end

    visit map_path
    expect_map_loaded
    # the control fades in, a click during the animation misses the icon
    wait_for { page.evaluate_script("getComputedStyle(#{control_js}).opacity") }.to eq("1")
    # the collapsed control takes the click itself, its children have no pointer events
    find(".maplibregl-ctrl-geocoder").click
    # the control expands with a transition, a click during it lands next to the result row
    wait_for { page.evaluate_script("#{control_js}.clientWidth") }.to be > 100
  end

  it "shows results while typing" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")

    expect(page).to have_css(".geocoder-result-title", text: "Berlin")
    expect(page).to have_css(".geocoder-result-address", text: "Germany")
    # the second result has no name, the street is the title
    expect(page).to have_css(".geocoder-result-title", text: "Friedrichstrasse 43")
    expect(page).to have_css(".geocoder-result-address", text: "10117 Berlin")
  end

  it "prefixes every result with a category icon" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")

    expect(page).to have_css("li:nth-child(1) img.geocoder-result-icon[src$='/🏙.png']")
    expect(page).to have_css("li:nth-child(2) img.geocoder-result-icon[src$='/🏠.png']")
  end

  it "prefers results around the current view" do
    page.execute_script("map.jumpTo({ center: [13.4, 52.5], zoom: 5 })")
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    expect(page).to have_css(".geocoder-result-title", text: "Berlin")

    # below zoom 9 the geocoder drops its own proximity, the map center still arrives
    expect(last_query["lon"].to_f).to be_within(0.1).of(13.4)
    expect(last_query["lat"].to_f).to be_within(0.1).of(52.5)
    expect(last_query["zoom"]).to eq("5")
  end

  it "sends query, language and proximity to photon" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    expect(page).to have_css(".geocoder-result-title", text: "Berlin")

    expect(last_query["q"]).to eq("Berlin")
    expect(last_query["lang"]).to eq("en")
    expect(last_query["limit"]).to eq("12")
    expect(last_query["lon"].to_f).to be_within(0.1).of(11.08)
    expect(last_query["lat"].to_f).to be_within(0.1).of(49.45)
  end

  # a plural query still reaches the osm_value, which is singular
  it "asks the reverse endpoint for a category query" do
    find(".maplibregl-ctrl-geocoder--input").set("cafes")
    expect(page).to have_css(".geocoder-result-title", text: "Berlin")

    expect(last_query["url"]).to include("/reverse")
    expect(last_query["osm_tag"]).to eq(":cafe")
    expect(last_query["q"]).to be_nil
    expect(last_query["radius"].to_i).to be >= 10
  end

  it "runs the query again on return, but only after a move" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    expect(page).to have_css(".geocoder-result-title", text: "Berlin")
    typed = queries.size

    # the view did not move, so this return repeats the answer of the typing
    find(".maplibregl-ctrl-geocoder--input").send_keys(:enter)
    page.execute_script("map.jumpTo({ center: [13.4, 52.5], zoom: 5 })")
    find(".maplibregl-ctrl-geocoder--input").send_keys(:enter)

    wait_for { last_query["lon"].to_f }.to be_within(0.1).of(13.4)
    expect(last_query["q"]).to eq("Berlin")
    expect(queries.size).to eq(typed + 1)
  end

  it "moves the map to the selected result" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    find(".geocoder-result-title", text: "Berlin").click

    wait_for { page.evaluate_script("map.getCenter().lng") }.to be_within(0.2).of(13.42)
    wait_for { page.evaluate_script("map.getCenter().lat") }.to be_within(0.3).of(52.51)
    # the picked result must not replace the query, "Berlin, Germany" is the name of it
    expect(find(".maplibregl-ctrl-geocoder--input").value).to eq("Berlin")
  end

  # the map factory starts at zoom 12, and this result carries no extent
  it "zooms in to the selected result" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    find(".geocoder-result-title", text: "Friedrichstrasse 43").click

    wait_for { page.evaluate_script("map.getZoom()") }.to be_within(0.1).of(14)
  end

  it "keeps a closer zoom on the selected result" do
    page.execute_script("map.jumpTo({ center: [13.4, 52.5], zoom: 17 })")
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    find(".geocoder-result-title", text: "Friedrichstrasse 43").click

    # the fly starts after the debounce, and it zooms out and back in on the way. the
    # details open on its moveend, so the modal is the signal that the camera settled.
    expect(page).to have_css("#feature-details-modal.show", text: "Friedrichstrasse 43")
    expect(page.evaluate_script("map.getZoom()")).to be_within(0.1).of(17)
  end

  context "with the results in view" do
    let(:map) { create(:map, name: "Search test", center: [ 13.4, 52.5 ], zoom: 10) }
    # results render into their own source, so they are visible to the map, not to the DOM
    let(:source) { "search-source-results" }

    # the circle and the emoji of a result are one icon, so the symbols layer draws it.
    # the style layer only exists once the first results arrive, and querying it before
    # that logs a console error, which rails_helper turns into a failure
    def result_features
      page.evaluate_script(
        "map.getLayer('symbols-layer_#{source}')" \
        " ? map.queryRenderedFeatures({ layers: ['symbols-layer_#{source}'] }).map(f => [" \
        "     f.properties['marker-symbol']," \
        "     map.getFeatureState({ source: '#{source}', id: f.id }).active === true])" \
        " : []"
      )
    end

    def result_symbols
      result_features.map(&:first)
    end

    def active_symbols
      result_features.select(&:last).map(&:first)
    end

    it "marks every result on the map" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")

      wait_for { result_symbols }.to contain_exactly("🏙", "🏠")
      expect(active_symbols).to eq([])
    end

    it "highlights the marker of the hovered result" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Friedrichstrasse 43").hover

      wait_for { active_symbols }.to eq([ "🏠" ])
    end

    # overpass is not stubbed here, the details fall back to the address of the result
    it "highlights the picked result and keeps the other ones" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Friedrichstrasse 43").click

      wait_for { active_symbols }.to eq([ "🏠" ])
      expect(result_symbols).to contain_exactly("🏙", "🏠")
      expect(page).to have_css("#feature-details-modal.show", text: "Friedrichstrasse 43")
    end
  end

  context "with a matching feature on the map" do
    let(:feature) { create(:feature, :point, title: "Berlin office") }
    let(:map) { create(:map, name: "Search test", features: [ feature ]) }

    def feature_active?
      source = "geojson-source-#{map.layers.first.id}"
      page.evaluate_script(
        "map.getFeatureState({ source: '#{source}', id: '#{feature.id}' }).active === true"
      )
    end

    it "lists the feature of the map above the places" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")

      expect(page).to have_css("li:nth-child(1) .geocoder-result-title", text: "Berlin office")
      # the layer of the map carries no name, so the row shows the type of the feature
      expect(page).to have_css("li:nth-child(1) .geocoder-result-address", text: "Point")
      expect(page).to have_css("li:nth-child(1) .geocoder-result-icon i.bi-record-circle")
      expect(page).to have_css("li:nth-child(2) .geocoder-result-title", text: "Berlin")
    end

    context "with a line feature" do
      let(:feature) { create(:feature, :line_string, title: "Berlin route") }

      it "keeps the icon inside its own column" do
        find(".maplibregl-ctrl-geocoder--input").set("Berlin")

        expect(page).to have_css("li:nth-child(1) .geocoder-result-icon i.bi-signpost")
        # an unclosed icon tag reopens around the text and colors the whole row
        expect(page).to have_no_css(".geocoder-result-text i")
        expect(page).to have_css("i.bi-signpost", count: 1)
      end
    end

    it "highlights the feature while the pointer is on its row" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Berlin office").hover

      wait_for { feature_active? }.to be true
      # the feature is drawn by its own layer, the search layer must not copy it
      expect(page).to have_css("li", count: 3)
    end

    it "moves to the feature and opens its details" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Berlin office").click

      expect(page).to have_css("#feature-details-modal.show", text: "Berlin office")
      expect(page.evaluate_script("map.getCenter().lng")).to be_within(0.01).of(11.0557)
      expect(page.evaluate_script("map.getCenter().lat")).to be_within(0.01).of(49.4732)
      expect(feature_active?).to be true
    end
  end

  context "details of a result" do
    # center matches the first result in spec/fixtures/files/photon.json
    let(:map) { create(:map, name: "Search test", center: [ 13.3888599, 52.5170365 ], zoom: 15) }

    let(:last_body) { String.new }

    before do
      CapybaraMock.stub_request(:post, %r{overpass-api\.de/api/interpreter}).to_return do |body:, **|
        last_body.replace(body)
        [ 200,
          { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
          { elements: [ { tags: { "opening_hours" => "Mo-Fr 08:00-18:00" } } ] }.to_json ]
      end
    end

    # photon knows the address fields only, the tags come from overpass on demand
    it "shows the osm tags of the result" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      expect(page).to have_css(".geocoder-result-title", text: "Berlin")
      wait_for_result_markers

      center = center_of_screen
      click_coord("#maplibre-map", center[:x], center[:y])

      expect(page).to have_css("#feature-details-modal.show", text: "Opening Hours")
      expect(page).to have_css("#feature-details-modal", text: "Mo-Fr 08:00-18:00")
      expect(last_body).to include("node(240109189);out tags;")
    end
  end

  context "copy to my layer context menu" do
    # center matches the first result in spec/fixtures/files/photon.json
    let(:map) { create(:map, name: "Search test", center: [ 13.3888599, 52.5170365 ], zoom: 15) }
    let(:map_path) { map.private_map_path }

    it "copies a result into the geojson layer of the map" do
      expect(Feature.count).to eq(0)
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      expect(page).to have_css(".geocoder-result-title", text: "Berlin")
      wait_for_result_markers

      center = center_of_screen
      click_coord("#maplibre-map", center[:x], center[:y], button: :right)
      find(".context-menu-item", text: "Copy to my layer").click

      wait_for { Feature.count }.to eq(1)
      copied_feature = Feature.first
      expect(copied_feature.properties["title"]).to eq("Berlin")
      expect(copied_feature.properties["marker-symbol"]).to eq("🏙")
      expect(copied_feature.geometry["coordinates"]).to eq([ 13.3888599, 52.5170365 ])
    end
  end
end
