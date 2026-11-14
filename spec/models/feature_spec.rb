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

  describe "#to_garmin_course" do
    let(:feature) { build(:feature, :line_string_with_elevation, title: "Hike") }
    let(:course) { feature.to_garmin_course }

    it "sums the climb and the descent" do
      expect(course).to include(courseName: "Hike", elevationGain: 50.0, elevationLoss: 60.0,
                                activityType: "HIKING", coordinateSystem: "WGS84")
    end

    it "keeps the vertexes in lat/lon order with elevation" do
      expect(course[:geoPoints].first).to eq(latitude: 49.46, longitude: 11.06, elevation: 300)
      expect(course[:geoPoints].last).to include(latitude: be_within(1e-9).of(49.435), elevation: be_within(1e-9).of(290))
    end

    it "keeps points at most 100m apart" do
      factory = RGeo::Geographic.spherical_factory
      gaps = course[:geoPoints].each_cons(2).map do |a, b|
        factory.point(a[:longitude], a[:latitude]).distance(factory.point(b[:longitude], b[:latitude]))
      end
      expect(gaps.max).to be <= 100
      expect(gaps.sum).to be_within(1).of(course[:distance])
    end

    it "uses a cycling course for bike routes" do
      feature.properties["route"] = { "profile" => "bike" }
      expect(course[:activityType]).to eq("ROAD_CYCLING")
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
