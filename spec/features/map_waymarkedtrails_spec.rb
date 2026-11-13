require "rails_helper"

describe "Waymarkedtrails layer" do
  # a file the test server serves, extractTheme() reads the theme 'hiking' from the url
  let(:layer) do
    create(:layer, type: "raster", name: "trails",
      query: "/logo/pwa/mapforge-logo-pwa-512.png?waymarkedtrails.org/hiking/{z}/{x}/{y}")
  end
  let(:map) { create(:map, name: "Trails test").tap { |m| m.layers << layer } }

  # 50 units off the click, inside the threshold of about 200 at zoom 12
  let(:near_line) { line_north_of_center(50) }
  let(:far_line) { line_north_of_center(5000) }

  # A line in EPSG:3857, the projection of the waymarkedtrails api. The repeated
  # first point is a segment of zero length.
  def line_north_of_center(offset)
    lng, lat = Map::DEFAULT_CENTER
    x = lng * 20_037_508.34 / 180
    y = Math.log(Math.tan(Math::PI / 4 + lat * Math::PI / 360)) * 6_378_137 + offset
    [ [ x - 1000, y ], [ x - 1000, y ], [ x + 1000, y ] ]
  end

  def stub_json(url, body)
    CapybaraMock.stub_request(:get, url).to_return(
      headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
      status: 200, body: body.to_json
    )
  end

  before do
    # the details of a line show its elevation profile
    stub_fixture(:post, /api\.heigit\.org\/openelevationservice\/v0\/line/, "ors_elevation.json")
    stub_point_elevation
    stub_json(%r{hiking\.waymarkedtrails\.org/api/v1/tiles/12/}, {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { top_relations: [ 4711 ] },
          geometry: { type: "LineString", coordinates: near_line } },
        { type: "Feature", properties: { top_relations: [ 9999 ] },
          geometry: { type: "LineString", coordinates: far_line } }
      ]
    })
    stub_json(%r{hiking\.waymarkedtrails\.org/api/v1/details/relation/4711}, {
      name: "Test Trail", tags: { network: "lwn" },
      route: { main: [ { ways: [ { geometry: { type: "LineString", coordinates: near_line } } ] } ] }
    })
    visit map.private_map_path
    expect_map_loaded
  end

  it "selects the route next to a click and copies it to the geojson layer" do
    center = center_of_screen
    click_coord("#maplibre-map", center[:x], center[:y])
    expect(page).to have_css("#feature-details-modal")
    expect(find("#feature-title").text).to eq("Test Trail")

    click_coord("#maplibre-map", center[:x], center[:y], button: :right)
    find(".context-menu-item", text: "Copy to my layer").click
    wait_for { Feature.count }.to eq(1)

    copied_feature = Feature.first
    expect(copied_feature.layer).to eq(map.layers.first)
    expect(copied_feature.properties["title"]).to eq("Test Trail")
    expect(copied_feature.properties["stroke"]).to eq("#0000FF")
    expect(copied_feature.geometry["type"]).to eq("LineString")
  end
end
