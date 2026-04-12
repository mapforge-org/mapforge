require "rails_helper"

describe "Feature directions" do
  let(:map) { create(:map, name: "Feature directions test") }

  before do
    ors_file = File.read(Rails.root.join("spec", "fixtures", "files", "ors_foot.json"))
    CapybaraMock.stub_request(
      :post, /api\.openrouteservice\.org\/v2\/directions\/foot-hiking/
    ).to_return(
      headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
      status: 200,
      body: ors_file
    )

    visit map.private_map_path
    expect_map_loaded
  end

  context "with empty map" do
    it "can create foot track" do
      find(".mapbox-gl-draw_line").click
      find(".mapbox-gl-draw_foot").click
      click_coord("#maplibre-map", 250, 250)
      click_coord("#maplibre-map", 450, 450)
      wait_for { Feature.line_string.count }.to eq(1)
    end
  end
end
