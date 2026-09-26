RSpec.shared_context "with an editable map and an elevation stub" do
  let(:map) { create(:map, name: "Feature edit test") }
  let(:user) { create(:user) }

  before do
    sign_in(user)
    stub_fixture(:post, /api\.openrouteservice\.org\/elevation\/line/, "ors_elevation.json")
    visit map.private_map_path
    expect_map_loaded
  end
end

RSpec.shared_context "with an editable map and an overpass stub" do
  subject(:map) { create(:map, name: "Layers test") }

  let(:user) { create(:user) }
  # a spec overrides these instead of a second visit, which would load the map twice
  let(:overpass_fixture) { "overpass.json" }
  let(:map_path) { map.private_map_path }

  before do
    stub_fixture(:post, "https://overpass-api.de/api/interpreter", overpass_fixture)
    sign_in(user)
    visit map_path
    expect_map_loaded
  end
end
