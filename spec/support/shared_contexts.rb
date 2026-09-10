RSpec.shared_context "with an editable map and an elevation stub" do
  let(:map) { create(:map, name: "Feature edit test") }
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })

    elevation_file = File.read(Rails.root.join("spec", "fixtures", "files", "ors_elevation.json"))
    CapybaraMock.stub_request(
      :post, /api\.openrouteservice\.org\/elevation\/line/
    ).to_return(
      headers: { "Access-Control-Allow-Origin" => "*", "Content-Type" => "application/json" },
      status: 200,
      body: elevation_file
    )

    visit map.private_map_path
    expect_map_loaded
  end
end

RSpec.shared_context "with an editable map and an overpass stub" do
  subject(:map) { create(:map, name: "Layers test") }

  let(:user) { create(:user) }

  before do
    overpass_file = File.read(Rails.root.join("spec", "fixtures", "files", "overpass.json"))
    CapybaraMock.stub_request(
      :post, "https://overpass-api.de/api/interpreter"
    ).to_return(
      headers: { "Access-Control-Allow-Origin" => "*" },
      status: 200,
      body: overpass_file
    )

    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit map.private_map_path
    expect_map_loaded
  end
end
