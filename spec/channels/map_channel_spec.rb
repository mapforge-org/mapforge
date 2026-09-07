require "rails_helper"

RSpec.describe MapChannel, type: :channel do
  let(:map) { create(:map) }
  let(:layer) { map.layers.first }
  let!(:a) { create(:feature, :point, layer: layer) }
  let!(:b) { create(:feature, :point, layer: layer) }

  before { stub_connection(uuid: SecureRandom.uuid) }

  describe "#subscribed" do
    it "rejects the subscription for an unknown map id" do
      subscribe(map_id: "nonexistent")

      expect(subscription).to be_rejected
    end

    it "rejects a map id that is a mongo operator" do
      subscribe(map_id: { "$ne" => nil })

      expect(subscription).to be_rejected
    end
  end

  describe "#new_layer" do
    it "skips invalid features and keeps the valid ones" do
      subscribe(map_id: map.private_id)
      layer_id = BSON::ObjectId.new.to_s
      valid_feature = { "id" => BSON::ObjectId.new.to_s, "type" => "Feature", "properties" => {},
                        "geometry" => { "type" => "Point", "coordinates" => [ 8.1, 47.2 ] } }
      invalid_feature = { "id" => BSON::ObjectId.new.to_s, "type" => "Feature", "properties" => {},
                          "geometry" => { "type" => "Point" } }

      perform :new_layer, id: layer_id, map_id: map.private_id, type: "geojson",
        geojson: { "features" => [ invalid_feature, valid_feature ] }

      features = map.reload.layers.find(layer_id).features
      expect(features.count).to eq 1
      expect(features.first.id.to_s).to eq valid_feature["id"]
    end
  end

  describe "#update_layer with feature_order" do
    let(:order) { [ b.id.to_s, a.id.to_s ] }

    it "persists the new order and broadcasts to the map channel" do
      subscribe(map_id: map.private_id)
      allow(ActionCable.server).to receive(:broadcast).and_call_original

      perform :update_layer, id: layer.id.to_s, map_id: map.private_id, feature_order: order

      expect(layer.reload.feature_order).to eq order
      expect(ActionCable.server).to have_received(:broadcast)
        .with("map_channel_#{map.public_id}", hash_including(:map_updated_at, event: "update_layer")).once
    end

    it "rejects writes made with a mongo operator as map id" do
      subscribe(map_id: map.private_id)

      expect {
        perform :update_layer, id: layer.id.to_s, map_id: { "$ne" => nil }, feature_order: order
      }.to raise_error(/public/)
      expect(layer.reload.feature_order).to eq []
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
