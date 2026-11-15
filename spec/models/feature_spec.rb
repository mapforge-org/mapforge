require "rails_helper"

describe Feature do
  describe ".from_collection" do
    it "creates a feature per geometry" do
      feature = described_class.create(type: "Feature", geometry: { "type" => "Point", "coordinates" => [ 11.0557138, 49.4731983 ] })
      # stringify keys
      features_in = JSON.parse(feature.to_geojson.to_json)
      features_out = described_class.from_collection(features_in)

      expect(features_out.map(&:coordinates)).to eq [ [ 11.0557138, 49.4731983 ] ]
    end
  end

  describe "Mapbox simplestyle properties" do
    let(:point) { { "type" => "Point", "coordinates" => [ 11.0557138, 49.4731983 ] } }

    def saved(properties)
      described_class.create!(geometry: point, properties: properties).reload.properties
    end

    it "stores the 'desc' alias as 'description'" do
      expect(saved("desc" => "Open 9 to 17")).to eq("description" => "Open 9 to 17")
    end

    it "keeps 'desc' and 'description' when both are set" do
      expect(saved("desc" => "a", "description" => "b")).to eq("desc" => "a", "description" => "b")
    end

    it "adds the # to a color without it" do
      expect(saved("marker-color" => "7e7e7e", "stroke" => "555", "fill" => "#555555", "label-color" => "abc"))
        .to eq("marker-color" => "#7e7e7e", "stroke" => "#555", "fill" => "#555555", "label-color" => "abc")
    end

    it "stores an integer marker-symbol as string" do
      expect(saved("marker-symbol" => 5)).to eq("marker-symbol" => "5")
    end

    it "converts an update too" do
      feature = described_class.create!(geometry: point, properties: {})
      feature.update!(properties: { "marker-color" => "312e81" })
      expect(feature.reload.properties).to eq("marker-color" => "#312e81")
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
