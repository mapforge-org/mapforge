require "rails_helper"

describe StyleSpec do
  let(:properties) { described_class.properties.index_by { |property| property[:name] } }

  it "reads the geometries, group and values of a property" do
    fill_pattern = properties["fill-pattern"]
    expect(fill_pattern[:group]).to eq("Fill")
    expect(fill_pattern[:geometries].keys).to eq([ "Polygon" ])
    expect(fill_pattern[:values]).to include("hatch", "dots-big")
    expect(fill_pattern[:values]).not_to include("stroke")
  end

  it "keeps a description and a default per geometry" do
    stroke_width = properties["stroke-width"]
    expect(stroke_width[:geometries].keys).to eq([ "Point", "LineString", "Polygon" ])
    expect(stroke_width[:geometries]["Polygon"][:default]).to eq("3")
    expect(stroke_width[:geometries]["Point"][:html]).to include("circle border")
  end

  it "reads the default in its different notations" do
    expect(properties["label-anchor"][:geometries]["All"][:default]).to eq("top")
    expect(properties["label-color"][:geometries]["All"][:default]).to eq("#000000")
    expect(properties["label-size"][:geometries]["All"][:default]).to eq("16")
    expect(properties["marker-size"][:geometries]["Point"][:default]).to eq("6")
    expect(properties["label-offset"][:geometries]["All"][:default]).to be_nil
  end

  it "stops before the label fonts section" do
    expect(properties.keys).to include("onclick-target", "fill-extrusion-shadow")
    expect(properties.keys).not_to include("thin")
  end

  it "offers true and false for a boolean property" do
    expect(properties["stroke-dasharray"][:values]).to eq(%w[true false])
  end

  it "gives every property a typed example value" do
    expect(properties["label-size"][:example]).to eq(16)
    expect(properties["marker-opacity"][:example]).to eq(0.7)
    expect(properties["stroke-dasharray"][:example]).to be(false)
    expect(properties["fill-pattern"][:example]).to eq("hatch")
    expect(properties["min-zoom"][:example]).to eq(10)
  end

  it "drops a default that names another property" do
    expect(properties["fill-extrusion-opacity"][:geometries]["Polygon"][:default]).to be_nil
  end
end
