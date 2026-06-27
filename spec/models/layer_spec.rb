require "rails_helper"

describe Layer do
  subject { create(:layer, :with_features) }

  describe "#clone_with_features" do
    it "returns a clone with cloned features" do
      clone = subject.clone_with_features
      expect(clone.features.count).to eq 2
      expect(clone.features.map(&:id)).not_to match_array(subject.features.map(&:id))
      expect(clone.id).not_to eq subject.id
    end
  end

  describe "#show" do
    it "defaults to true" do
      layer = create(:layer)
      expect(layer.show).to be true
    end

    it "can be set to false" do
      layer = create(:layer, show: false)
      expect(layer.show).to be false
    end
  end

  describe "#to_summary_json" do
    it "includes show: true by default" do
      layer = create(:layer)
      expect(layer.to_summary_json[:show]).to be true
    end

    it "includes show: false when hidden" do
      layer = create(:layer, show: false)
      expect(layer.to_summary_json[:show]).to be false
    end
  end

  describe "#to_geojson" do
    it "returns a FeatureCollection with features" do
      map = create(:map)
      layer = create(:layer, :with_features)
      map.layers << layer

      result = layer.to_geojson
      expect(result[:type]).to eq "FeatureCollection"
      expect(result[:features].count).to eq 2
      expect(result[:features].first).to have_key(:id)
      expect(result[:features].first).to have_key(:type)
      expect(result[:features].first).to have_key(:geometry)
      expect(result[:features].first).to have_key(:properties)
    end

    it "returns an empty features array when layer has no features" do
      map = create(:map)
      layer = map.layers.first

      result = layer.to_geojson
      expect(result[:type]).to eq "FeatureCollection"
      expect(result[:features]).to eq []
    end

    context "with feature_order set" do
      let(:map) { create(:map) }
      let(:layer) { map.layers.first }
      let!(:a) { create(:feature, :point, title: "A", layer: layer) }
      let!(:b) { create(:feature, :point, title: "B", layer: layer) }
      let!(:c) { create(:feature, :point, title: "C", layer: layer) }

      def ids(result) = result[:features].map { |f| f[:id] }

      it "orders features by feature_order" do
        layer.update!(feature_order: [ c.id.to_s, a.id.to_s, b.id.to_s ])
        expect(ids(layer.to_geojson)).to eq [ c.id.to_s, a.id.to_s, b.id.to_s ]
      end

      it "appends features missing from feature_order after the listed ones" do
        layer.update!(feature_order: [ c.id.to_s, a.id.to_s ])
        expect(ids(layer.to_geojson)).to eq [ c.id.to_s, a.id.to_s, b.id.to_s ]
      end

      it "ignores stale ids in feature_order" do
        layer.update!(feature_order: [ "deadbeef", b.id.to_s, a.id.to_s ])
        expect(ids(layer.to_geojson)).to eq [ b.id.to_s, a.id.to_s, c.id.to_s ]
      end
    end
  end

  describe "#to_json" do
    it "includes summary fields and geojson" do
      map = create(:map)
      layer = create(:layer, :with_features, name: "Test Layer")
      map.layers << layer

      result = layer.to_json
      expect(result[:id]).to eq layer.id
      expect(result[:type]).to eq "geojson"
      expect(result[:name]).to eq "Test Layer"
      expect(result[:geojson]).to be_present
      expect(result[:geojson]).to eq layer.to_geojson
    end

    it "includes geojson matching to_geojson output" do
      map = create(:map)
      layer = map.layers.first

      result = layer.to_json
      expect(result[:geojson]).to eq layer.to_geojson
    end
  end

  describe "#broadcast_update" do
    let!(:map) { create(:map) }
    let!(:layer) { map.layers.first }

    it "broadcasts when show changes" do
      allow(ActionCable.server).to receive(:broadcast)
      layer.update!(show: false)
      expect(ActionCable.server).to have_received(:broadcast).once
    end

    it "does not broadcast when show is unchanged" do
      allow(ActionCable.server).to receive(:broadcast)
      layer.update!(features_count: 5)
      expect(ActionCable.server).not_to have_received(:broadcast)
    end

    it "broadcasts update_layer to the map channel when feature_order changes" do
      allow(ActionCable.server).to receive(:broadcast)
      layer.update!(feature_order: [ "a", "b" ])
      expect(ActionCable.server).to have_received(:broadcast)
        .with("map_channel_#{map.public_id}", hash_including(event: "update_layer")).once
    end
  end
end
