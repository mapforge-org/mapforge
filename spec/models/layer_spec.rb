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
      expect(layer.show).to eq true
    end

    it "can be set to false" do
      layer = create(:layer, show: false)
      expect(layer.show).to eq false
    end
  end

  describe "#to_summary_json" do
    it "includes show: true by default" do
      layer = create(:layer)
      expect(layer.to_summary_json[:show]).to eq true
    end

    it "includes show: false when hidden" do
      layer = create(:layer, show: false)
      expect(layer.to_summary_json[:show]).to eq false
    end
  end

  describe "#broadcast_update" do
    let!(:map) { create(:map) }
    let!(:layer) { map.layers.first }

    it "broadcasts when show changes" do
      expect(ActionCable.server).to receive(:broadcast).twice
      layer.update!(show: false)
    end

    it "does not broadcast when show is unchanged" do
      expect(ActionCable.server).not_to receive(:broadcast)
      layer.update!(features_count: 5)
    end
  end
end
