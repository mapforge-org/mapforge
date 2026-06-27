require "rails_helper"

RSpec.describe MapChannel, type: :channel do
  let(:map) { create(:map) }
  let(:layer) { map.layers.first }
  let!(:a) { create(:feature, :point, layer: layer) }
  let!(:b) { create(:feature, :point, layer: layer) }

  before { stub_connection(uuid: SecureRandom.uuid) }

  describe "#update_layer with feature_order" do
    let(:order) { [ b.id.to_s, a.id.to_s ] }

    it "persists the new order and broadcasts to the map channel" do
      subscribe(map_id: map.private_id)
      allow(ActionCable.server).to receive(:broadcast).and_call_original

      perform :update_layer, id: layer.id.to_s, map_id: map.private_id, feature_order: order

      expect(layer.reload.feature_order).to eq order
      expect(ActionCable.server).to have_received(:broadcast)
        .with("map_channel_#{map.public_id}", hash_including(event: "update_layer")).once
    end

    it "rejects writes made with the public id" do
      subscribe(map_id: map.public_id)

      expect {
        perform :update_layer, id: layer.id.to_s, map_id: map.public_id, feature_order: order
      }.to raise_error(/public/)
      expect(layer.reload.feature_order).to eq []
    end
  end
end
