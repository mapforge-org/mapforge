require "rails_helper"

describe "Map places search" do
  let(:map) { create(:map, name: "Search test") }
  let(:map_path) { map.public_map_path }
  let(:last_query) { {} }
  let(:control_js) { "document.querySelector('.maplibregl-ctrl-geocoder')" }

  before do
    photon_file = File.read(Rails.root.join("spec", "fixtures", "files", "photon.json"))
    CapybaraMock.stub_request(:get, /photon\.komoot\.io/).to_return do |query:, **|
      last_query.replace(query)
      [ 200,
        { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
        photon_file ]
    end

    visit map_path
    expect_map_loaded
    # the control fades in, a click during the animation misses the icon
    wait_for { page.evaluate_script("getComputedStyle(#{control_js}).opacity") }.to eq("1")
    find(".maplibregl-ctrl-geocoder--icon-search").click
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
    expect(last_query["lon"].to_f).to be_within(0.1).of(11.08)
    expect(last_query["lat"].to_f).to be_within(0.1).of(49.45)
  end

  it "moves the map to the selected result" do
    find(".maplibregl-ctrl-geocoder--input").set("Berlin")
    find(".geocoder-result-title", text: "Berlin").click

    wait_for { page.evaluate_script("map.getCenter().lng") }.to be_within(0.2).of(13.42)
    wait_for { page.evaluate_script("map.getCenter().lat") }.to be_within(0.3).of(52.51)
  end

  context "with the results in view" do
    let(:map) { create(:map, name: "Search test", center: [ 13.4, 52.5 ], zoom: 10) }
    # results render into their own source, so they are visible to the map, not to the DOM
    let(:source) { "search-source-results" }

    # the style layer only exists once the first results arrive, and querying it before
    # that logs a console error, which rails_helper turns into a failure
    def result_features
      page.evaluate_script(
        "map.getLayer('points-layer_#{source}')" \
        " ? map.queryRenderedFeatures({ layers: ['points-layer_#{source}'] }).map(f => [" \
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

    it "keeps only the picked result on the map" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Berlin").click

      wait_for { result_symbols }.to eq([ "🏙" ])
      expect(active_symbols).to eq([ "🏙" ])
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
