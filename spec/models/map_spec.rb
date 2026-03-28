require "rails_helper"

describe Map do
  subject(:map) { described_class.create_from_file("spec/fixtures/files/mapforge.json") }

  describe "#to_json" do
    it "included properties & layers" do
      expect(map.to_json).to be_a(String)
    end
  end

  describe "#features_count" do
    it "sums up feature count of all layers" do
      expect(map.features_count).to eq(6)
    end
  end

  describe "validations" do
    context "when map with same public_id already exists" do
      before { create(:map, public_id: "frontpage") }

      it "raises error" do
        expect { create(:map, public_id: "frontpage") }
          .to raise_error(Mongoid::Errors::Validations, /public_id already taken/)
      end
    end
  end

  describe "#properties" do
    context "when map has no center defined" do
      before do
        create(:feature, :point_with_elevation, layer: map.layers.first)
        create(:feature, :polygon_middle, layer: map.layers.first)
        create(:feature, :line_string, layer: map.layers.first)
      end

      let(:map) { create(:map, center: nil) }

      it "sets default center to midpoint of all features" do
        expect(map.properties[:default_center]).to eq [ 11.0670007125, 49.4592973375 ]
      end
    end

    context "when map has no zoom defined" do
      let(:map) { create(:map, zoom: nil) }
      let(:layer) { map.layers.first }

      it "sets default zoom to 10 on single point" do
        create(:feature, :point, layer: layer)
        expect(map.properties[:default_zoom]).to eq 10
      end

      it "sets default zoom to 16" do
        create(:feature, :line_string, coordinates: [ [ 11.067, 49.459 ], [ 11.077, 49.459 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 16
      end

      it "sets default zoom to 14" do
        create(:feature, :line_string, layer: layer)
        expect(map.properties[:default_zoom]).to eq 14
      end

      it "sets default zoom to 12" do
        create(:feature, :line_string, coordinates: [ [ 11.067, 49.459 ], [ 11.177, 49.459 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 12
      end

      it "sets default zoom to 10" do
        create(:feature, :line_string, coordinates: [ [ 11.067, 49.459 ], [ 11.177, 49.359 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 10
      end

      it "sets default zoom to 9" do
        create(:feature, :line_string, coordinates: [ [ 10.067, 49.459 ], [ 11.377, 49.259 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 9
      end

      it "sets default zoom to 8" do
        create(:feature, :line_string, coordinates: [ [ 10.067, 49.459 ], [ 11.477, 49.159 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 8
      end

      it "sets default zoom to 6" do
        create(:feature, :line_string, coordinates: [ [ 7.067, 49.459 ], [ 11.477, 49.159 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 6
      end

      it "sets default zoom to 4" do
        create(:feature, :line_string, coordinates: [ [ 7.067, 40.459 ], [ 11.477, 49.159 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 4
      end

      it "sets default zoom to 2" do
        create(:feature, :line_string, coordinates: [ [ 1.067, 49.459 ], [ 31.177, 49.459 ] ], layer: layer)
        expect(map.properties[:default_zoom]).to eq 2
      end
    end

    context "with base_map" do
      let(:map) { create(:map, base_map: "quatsch") }

      it "returns default_base_map when map is not found" do
        expect(map.properties[:base_map]).to eq "test"
      end

      it "returns default_base_map when maptiler key is not set" do
        map.update(base_map: Map::MAPTILER_MAPS.first)
        expect(map.properties[:base_map]).to eq "test"
      end
    end
  end

  describe "#clone_with_layers" do
    it "returns a clone with cloned layers" do
      clone = subject.clone_with_layers

      expect(clone.id).not_to eq subject.id
      expect(clone.layers.count).to eq 3
      expect(clone.layers.first.id).not_to eq(subject.layers.first.id)
      expect(clone.features.count).to eq 6
      expect(clone.features.map(&:id)).not_to match_array(subject.features.map(&:id))
    end
  end

  describe 'multi-owner support' do
    let(:user1) { create(:user) }
    let(:user2) { create(:user) }
    let(:map) { create(:map, owners: [ user1 ]) }

    describe '#owned_by?' do
      it 'returns true for owners' do
        expect(map.owned_by?(user1)).to be true
      end

      it 'returns false for non-owners' do
        expect(map.owned_by?(user2)).to be false
      end
    end

    describe '#add_owner' do
      it 'adds a new owner' do
        expect { map.add_owner(user2) }.to change { map.owners.count }.by(1)
      end

      it 'is idempotent' do
        map.add_owner(user2)
        expect { map.add_owner(user2) }.not_to change { map.owners.count }
      end
    end

    describe '#remove_owner' do
      it 'removes an owner' do
        map.add_owner(user2)
        expect { map.remove_owner(user2) }.to change { map.owners.count }.by(-1)
      end

      it 'allows removing last owner (for anonymous maps)' do
        expect { map.remove_owner(user1) }.to change { map.owners.count }.by(-1)
        expect(map.owners).to be_empty
      end
    end

    describe 'anonymous maps' do
      it 'allows maps without owners' do
        map = create(:map)
        map.owners.clear
        expect(map.owners).to be_empty
        expect(map).to be_valid
      end
    end
  end
end
