require 'rails_helper'

describe Map do
  subject { Map.create_from_file('spec/fixtures/files/mapforge.json') }

  describe '#to_json' do
    it 'included properties & layers' do
      expect(subject.to_json).to be_a(String)
    end
  end

  describe '#features_count' do
    it 'sums up feature count of all layers' do
      expect(subject.features_count).to eq(3)
    end
  end

  describe '#public_id_must_be_unique_or_nil' do
    context 'when map with same public_id already exists' do
      before { create(:map, public_id: 'frontpage') }

      it 'raises error' do
        expect { create(:map, public_id: 'frontpage') }
          .to raise_error(Mongoid::Errors::Validations, /has already been taken/)
      end
    end
  end

  describe '#properties' do
    context 'when map has no center defined' do
      let(:map) { create(:map, center: nil) }
      let!(:point) { create(:feature, :point_with_elevation, layer: map.layers.first) }
      let!(:poly) { create(:feature, :polygon_middle, layer: map.layers.first) }
      let!(:line) { create(:feature, :line_string, layer: map.layers.first) }

      it 'sets default center to midpoint of all features' do
        expect(map.properties[:default_center]).to eq [ 11.0670007125, 49.4592973375 ]
      end
    end

    context 'when map has no zoom defined' do
      let(:map) { create(:map, zoom: nil) }
      let(:layer) { map.layers.first }

      it 'sets default zoom to 12 on single point' do
        create(:feature, :point, layer: layer)
        expect(map.properties[:default_zoom]).to eq 12
      end

      it 'sets default zoom to 16' do
        create(:feature, :line_string, coordinates: ([ [ 11.067, 49.459 ], [ 11.077, 49.459 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 16
      end

      it 'sets default zoom to 14' do
        create(:feature, :line_string, layer: layer)
        expect(map.properties[:default_zoom]).to eq 14
      end

      it 'sets default zoom to 12' do
        create(:feature, :line_string, coordinates: ([ [ 11.067, 49.459 ], [ 11.177, 49.459 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 12
      end

      it 'sets default zoom to 10' do
        create(:feature, :line_string, coordinates: ([ [ 11.067, 49.459 ], [ 11.177, 49.359 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 10
      end

      it 'sets default zoom to 9' do
        create(:feature, :line_string, coordinates: ([ [ 10.067, 49.459 ], [ 11.377, 49.259 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 9
      end

      it 'sets default zoom to 8' do
        create(:feature, :line_string, coordinates: ([ [ 10.067, 49.459 ], [ 11.477, 49.159 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 8
      end

      it 'sets default zoom to 6' do
        create(:feature, :line_string, coordinates: ([ [ 7.067, 49.459 ], [ 11.477, 49.159 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 6
      end

      it 'sets default zoom to 4' do
        create(:feature, :line_string, coordinates: ([ [ 7.067, 40.459 ], [ 11.477, 49.159 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 4
      end

      it 'sets default zoom to 2' do
        create(:feature, :line_string, coordinates: ([ [ 1.067, 49.459 ], [ 31.177, 49.459 ] ]), layer: layer)
        expect(map.properties[:default_zoom]).to eq 2
      end
    end

    context 'base_map' do
      let(:map) { create(:map, base_map: 'quatsch') }

      it 'returns default_base_map when map is not found' do
        expect(map.properties[:base_map]).to eq "osmRasterTiles"
      end

      it 'returns default_base_map when maptiler key is not set' do
        map.update(base_map: Map::MAPTILER_MAPS.first)
        expect(map.properties[:base_map]).to eq "osmRasterTiles"
      end
    end
  end
end
