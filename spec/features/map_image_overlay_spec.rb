require "rails_helper"

describe "Map image overlay" do
  let(:polygon) {
    create(:feature, :polygon_middle,
      properties: { "title" => "Floor plan", "fill-image-url" => "/icons/direction-arrow.png" })
  }
  let(:map) { create(:map, features: [ polygon ]) }
  let(:layer_id) { map.layers.first.id }
  let(:source_id) { "image-overlay-source-#{layer_id}-#{polygon.id}" }

  before do
    visit map.public_map_path
    expect_map_loaded
  end

  def overlay_source
    page.evaluate_script("map.getStyle().sources['#{source_id}']")
  end

  it "pins the image to the polygon corners" do
    wait_for { overlay_source&.dig("url") }.to eq "/icons/direction-arrow.png"
    expect(overlay_source["coordinates"]).to eq polygon.geometry["coordinates"][0].first(4)
    expect(page.evaluate_script("map.getLayoutProperty('image-overlay-layer_#{source_id}', 'visibility')"))
      .to eq "visible"
  end

  context "with a fill opacity" do
    let(:polygon) {
      create(:feature, :polygon_middle,
        properties: { "fill-opacity" => 0.4, "fill-image-url" => "/icons/direction-arrow.png" })
    }

    it "fades the image" do
      wait_for {
        page.evaluate_script("map.getPaintProperty('image-overlay-layer_#{source_id}', 'raster-opacity')")
      }.to eq 0.4
    end
  end

  context "with levels" do
    let(:polygon) {
      create(:feature, :polygon_middle,
        properties: { "level" => "0", "fill-image-url" => "/icons/direction-arrow.png" })
    }
    let(:map) { create(:map, features: [ polygon, create(:feature, :point, properties: { "level" => "1" }) ]) }

    it "hides the image on a level the polygon does not declare" do
      wait_for { overlay_source }.not_to be_nil
      find(".level-control button[data-level='1']").click
      wait_for {
        page.evaluate_script("map.getLayoutProperty('image-overlay-layer_#{source_id}', 'visibility')")
      }.to eq "none"
    end
  end
end
