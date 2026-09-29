require "rails_helper"

describe "Map km markers" do
  let(:line) {
    create(:feature, :line_string, properties: { "title" => "Track", "show-km-markers" => true })
  }
  let(:map) { create(:map, features: [ line ]) }
  let(:source_id) { "km-marker-source-#{map.layers.first.id}" }

  before do
    visit map.public_map_path
    expect_map_loaded
  end

  def marker_kms
    page.evaluate_async_script(<<~JS)
      const done = arguments[0]
      map.getSource('#{source_id}').getData().then(data => done(data.features.map(f => f.properties.km)))
    JS
  end

  it "places one marker per km and an end marker with the total length" do
    wait_for { marker_kms }.to eq [ 0, 1, 2, 2.3 ]
  end

  it "renders the markers below user points" do
    wait_for { marker_kms }.to eq [ 0, 1, 2, 2.3 ]
    ids = page.evaluate_script("map.getStyle().layers.map(l => l.id)")
    points = ids.index { |id| id.start_with?("points-layer") }
    ids.each_with_index.select { |id, _| id.start_with?("km-marker") }.each do |id, index|
      expect(index).to be < points, "#{id} is above the points layer"
    end
  end
end
