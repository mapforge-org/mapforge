require 'rails_helper'

describe Feature do
  describe '.from_collection' do
    it 'can convert formats' do
      feature = described_class.create(type: 'Feature', geometry: { 'type' => 'Point', 'coordinates' => [ 11.0557138, 49.4731983 ] })
     # stringify keys
     features_in = JSON.parse(feature.to_geojson.to_json)
     features_out = described_class.from_collection(features_in, collection_format: 4326, db_format: 3857)

      expect(features_out.map { |f| f.coordinates.map { |c| c.round } }).to eq [ [ 1230716, 6355538 ] ]
    end
  end
end
