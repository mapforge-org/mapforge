require "rails_helper"

describe "Styling docs playground" do
  let(:preview_property) do
    ->(name) { within_frame(find(".styling-preview iframe")) { page.evaluate_script("window._layers[0].geojson.features[0].properties['#{name}']") } }
  end

  before do
    visit doc_path(id: "geojson_style_spec")
    within_frame(find(".styling-preview iframe")) do
      expect(page).to have_css("#maplibre-map[data-map-loaded='true']", wait: 30, visible: :all)
    end
  end

  it "draws the preset on the preview map" do
    expect(page).to have_css(".styling-status", text: "valid")
    expect(preview_property.call("fill-pattern")).to eq("hatch")
  end

  it "applies a value of the property under the cursor" do
    find("#property-fill-pattern").click_link("Load in playground ↑")
    within(".styling-cursor") do
      expect(page).to have_css(".styling-cursor-name", text: "fill-pattern")
      click_button "dots", exact: true
    end
    expect(find(".styling-code").value).to include('"fill-pattern": "dots"')
    expect(preview_property.call("fill-pattern")).to eq("dots")
  end

  it "switches to a matching preset for a property of another geometry" do
    find("#property-marker-shape").click_link("Load in playground ↑")
    expect(find(".styling-code").value).to include('"type": "Point"', '"marker-shape": "circle"')
    expect(preview_property.call("marker-shape")).to eq("circle")
  end

  it "draws a pinhead icon for a name in marker-symbol, also for a maki name" do
    feature = { type: "Feature", geometry: { type: "Point", coordinates: [ 11.077, 49.447 ] },
                properties: { "marker-symbol" => "cafe" } }
    # application.js drops input events before the first user activation
    find(".styling-code").click
    page.execute_script("const editor = document.querySelector('.styling-code'); editor.value = arguments[0];" \
                        "editor.dispatchEvent(new Event('input', { bubbles: true }))", feature.to_json)
    within_frame(find(".styling-preview iframe")) do
      wait_for do
        page.evaluate_script("performance.getEntriesByType('resource')" \
                             ".find(entry => entry.name.endsWith('/icon-sets/pinhead/cafe.png'))?.responseStatus")
      end.to eq(200)
    end
  end

  it "filters the cards by group and search" do
    click_button "Marker"
    expect(page).to have_css("#property-marker-shape")
    expect(page).to have_no_css("#property-fill-pattern")
    fill_in "style-search", with: "rotate"
    expect(page).to have_css("#property-marker-rotate")
    expect(page).to have_no_css("#property-marker-shape")
  end
end
