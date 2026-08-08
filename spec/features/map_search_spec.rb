require "rails_helper"

describe "Map places search" do
  let(:map) { create(:map, name: "Search test") }
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

    visit map.public_map_path
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

    expect(page).to have_css("li:nth-child(1) .geocoder-result-icon.bi-building")
    expect(page).to have_css("li:nth-child(2) .geocoder-result-icon.bi-house-door")
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

    it "marks every result on the map" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")

      expect(page).to have_css(".search-marker", count: 2)
      expect(page).to have_no_css(".search-marker.active")
      expect(page).to have_css(".search-marker .bi-building")
      expect(page).to have_css(".search-marker .bi-house-door")
    end

    it "highlights the marker of the hovered result" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Friedrichstrasse 43").hover

      expect(page).to have_css(".search-marker.active", count: 1)
      expect(page).to have_css(".search-marker.active .bi-house-door")
    end

    it "keeps only the picked result on the map" do
      find(".maplibregl-ctrl-geocoder--input").set("Berlin")
      find(".geocoder-result-title", text: "Berlin").click

      expect(page).to have_css(".search-marker.active", count: 1)
      expect(page).to have_css(".search-marker.active .bi-building")
    end
  end
end
