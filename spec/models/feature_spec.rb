require "rails_helper"

describe Feature do
  describe ".from_collection" do
    it "can convert formats" do
      feature = described_class.create(type: "Feature", geometry: { "type" => "Point", "coordinates" => [ 11.0557138, 49.4731983 ] })
      # stringify keys
      features_in = JSON.parse(feature.to_geojson.to_json)
      features_out = described_class.from_collection(features_in, collection_format: 4326, db_format: 3857)

      expect(features_out.map { |f| f.coordinates.map { |c| c.round } }).to eq [ [ 1230716, 6355538 ] ]
    end
  end

  describe "#to_gpx" do
    it "exports valid gpx" do
      feature = described_class.create(type: "Feature", geometry: { "type" => "Point", "coordinates" => [ 11.0557138, 49.4731983 ] })
      gpx_data = feature.to_gpx.to_s

      expect(gpx_data).to include('<?xml version="1.0" encoding="UTF-8"?>')
      expect(gpx_data).to include("<gpx")
      expect(gpx_data).to include('<wpt lat="49.4731983" lon="11.0557138"/>')
    end
  end

  describe "#coordinates" do
    context "with corrupted geometry containing nil values" do
      it "handles nil in LineString coordinates" do
        feature = described_class.create(
          type: "Feature",
          geometry: { "type" => "LineString", "coordinates" => [ [ 11.0, 49.0 ], nil, [ 12.0, 50.0 ] ] }
        )

        expect { feature.coordinates(include_height: false) }.not_to raise_error
        expect(feature.coordinates(include_height: false)).to eq [ [ 11.0, 49.0 ], [ 12.0, 50.0 ] ]
      end

      it "handles nil in Polygon coordinates" do
        feature = described_class.create(
          type: "Feature",
          geometry: {
            "type" => "Polygon",
            "coordinates" => [ [ [ 11.0, 49.0 ], [ 12.0, 49.0 ], nil, [ 11.0, 49.0 ] ] ]
          }
        )

        expect { feature.coordinates(include_height: false) }.not_to raise_error
        result = feature.coordinates(include_height: false)
        expect(result).to eq [ [ [ 11.0, 49.0 ], [ 12.0, 49.0 ], [ 11.0, 49.0 ] ] ]
      end

      it "handles nil as entire coordinates value" do
        feature = described_class.create(
          type: "Feature",
          geometry: { "type" => "Point", "coordinates" => nil }
        )

        expect { feature.coordinates(include_height: false) }.not_to raise_error
        expect(feature.coordinates(include_height: false)).to eq []
      end
    end
  end

  describe "coordinate sanitization on save" do
    it "removes nil from LineString coordinates" do
      feature = described_class.create!(
        type: "Feature",
        geometry: { "type" => "LineString", "coordinates" => [ [ 11.0, 49.0 ], nil, [ 12.0, 50.0 ] ] }
      )
      expect(feature.geometry["coordinates"]).to eq [ [ 11.0, 49.0 ], [ 12.0, 50.0 ] ]
    end

    it "removes nil from Polygon coordinates" do
      feature = described_class.create!(
        type: "Feature",
        geometry: {
          "type" => "Polygon",
          "coordinates" => [ [ [ 11.0, 49.0 ], [ 12.0, 49.0 ], nil, [ 11.0, 49.0 ] ] ]
        }
      )
      expect(feature.geometry["coordinates"]).to eq [ [ [ 11.0, 49.0 ], [ 12.0, 49.0 ], [ 11.0, 49.0 ] ] ]
    end

    it "removes nil from MultiLineString coordinates" do
      feature = described_class.create!(
        type: "Feature",
        geometry: {
          "type" => "MultiLineString",
          "coordinates" => [ [ [ 11.0, 49.0 ], [ 12.0, 50.0 ] ], nil, [ [ 13.0, 51.0 ], nil, [ 14.0, 52.0 ] ] ]
        }
      )
      expect(feature.geometry["coordinates"]).to eq [
        [ [ 11.0, 49.0 ], [ 12.0, 50.0 ] ],
        [ [ 13.0, 51.0 ], [ 14.0, 52.0 ] ]
      ]
    end

    it "removes nil from MultiPolygon coordinates" do
      feature = described_class.create!(
        type: "Feature",
        geometry: {
          "type" => "MultiPolygon",
          "coordinates" => [
            [ [ [ 11.0, 49.0 ], [ 12.0, 49.0 ], [ 11.0, 49.0 ] ] ],
            nil,
            [ [ [ 13.0, 51.0 ], nil, [ 14.0, 51.0 ], [ 13.0, 51.0 ] ] ]
          ]
        }
      )
      expect(feature.geometry["coordinates"]).to eq [
        [ [ [ 11.0, 49.0 ], [ 12.0, 49.0 ], [ 11.0, 49.0 ] ] ],
        [ [ [ 13.0, 51.0 ], [ 14.0, 51.0 ], [ 13.0, 51.0 ] ] ]
      ]
    end

    it "leaves clean coordinates unchanged" do
      coords = [ [ 11.0, 49.0 ], [ 12.0, 50.0 ] ]
      feature = described_class.create!(
        type: "Feature",
        geometry: { "type" => "LineString", "coordinates" => coords }
      )
      expect(feature.geometry["coordinates"]).to eq coords
    end
  end
end
