require "rails_helper"

RSpec.describe Mapforge::OsmElement do
  subject(:route) { described_class.new(elements, "relation", 99) }

  # 1 -- 2 -- 3 -- 4, drawn as three ways: forwards, backwards, forwards. Way 14 closes 1-2-3-1.
  let(:elements) do
    [ { "type" => "node", "id" => 1, "lon" => 11.0, "lat" => 49.0, "tags" => { "name" => "Start" } },
      { "type" => "node", "id" => 2, "lon" => 11.1, "lat" => 49.0 },
      { "type" => "node", "id" => 3, "lon" => 11.2, "lat" => 49.0 },
      { "type" => "node", "id" => 4, "lon" => 11.3, "lat" => 49.0, "tags" => { "name" => "End" } },
      { "type" => "way", "id" => 10, "nodes" => [ 1, 2 ] },
      { "type" => "way", "id" => 11, "nodes" => [ 3, 2 ] },
      { "type" => "way", "id" => 12, "nodes" => [ 3, 4 ] },
      { "type" => "way", "id" => 13, "nodes" => [ 2, 3 ] },
      { "type" => "way", "id" => 14, "nodes" => [ 1, 2, 3, 1 ] },
      { "type" => "relation", "id" => 99, "members" => members,
        "tags" => { "name" => "RB 21: Nürnberg Nordost => Gräfenberg" } } ]
  end
  let(:members) do
    [ { "type" => "node", "ref" => 1, "role" => "stop_entry_only" },
      { "type" => "node", "ref" => 4, "role" => "stop" },
      { "type" => "node", "ref" => 2, "role" => "platform" },
      { "type" => "way", "ref" => 13, "role" => "platform" },
      { "type" => "way", "ref" => 10, "role" => "" },
      { "type" => "way", "ref" => 11, "role" => "" },
      { "type" => "way", "ref" => 12, "role" => "" } ]
  end

  it "stitches member ways into one continuous line without duplicating shared nodes" do
    expect(route.geometry).to eq("type" => "LineString",
      "coordinates" => [ [ 11.0, 49.0 ], [ 11.1, 49.0 ], [ 11.2, 49.0 ], [ 11.3, 49.0 ] ])
  end

  it "flips the first way when it points away from the rest of the route" do
    elements.find { |e| e["id"] == 10 }["nodes"] = [ 2, 1 ]
    expect(route.geometry["coordinates"].first).to eq([ 11.0, 49.0 ])
  end

  it "takes its name from the relation" do
    expect(route.name).to eq("RB 21: Nürnberg Nordost => Gräfenberg")
  end

  it "raises when the relation has no ways" do
    members.reject! { |m| m["type"] == "way" }
    expect { route.geometry }.to raise_error(ArgumentError)
  end

  it "builds a Point from a node" do
    expect(described_class.new(elements, "node", 1).geometry)
      .to eq("type" => "Point", "coordinates" => [ 11.0, 49.0 ])
  end

  it "builds a LineString from an open way" do
    expect(described_class.new(elements, "way", 10).geometry)
      .to eq("type" => "LineString", "coordinates" => [ [ 11.0, 49.0 ], [ 11.1, 49.0 ] ])
  end

  it "builds a Polygon from a closed way" do
    expect(described_class.new(elements, "way", 14).geometry)
      .to eq("type" => "Polygon",
             "coordinates" => [ [ [ 11.0, 49.0 ], [ 11.1, 49.0 ], [ 11.2, 49.0 ], [ 11.0, 49.0 ] ] ])
  end

  it "raises when the element is not in the response" do
    expect { described_class.new(elements, "way", 999) }.to raise_error(ArgumentError, /no way 999/)
  end

  describe ".fetch" do
    def stub_get(path, elements)
      allow(Net::HTTP).to receive(:get)
        .with(URI("#{described_class::API_URL}/#{path}"), { "User-Agent" => "mapforge" })
        .and_return({ "elements" => elements }.to_json)
    end

    it "rejects an id without a known type prefix" do
      [ "banana/1", "2213233", "relation/", "relation/abc" ].each do |id|
        expect { described_class.fetch(id) }.to raise_error(ArgumentError, /expected an id like/)
      end
    end

    it "asks for the resolved members of a relation" do
      stub_get("relation/99/full.json", elements)
      expect(described_class.fetch("relation/99").name).to eq("RB 21: Nürnberg Nordost => Gräfenberg")
    end

    it "asks for the bare node, which has no /full" do
      stub_get("node/1.json", elements)
      expect(described_class.fetch("node/1").geometry)
        .to eq("type" => "Point", "coordinates" => [ 11.0, 49.0 ])
    end
  end
end
