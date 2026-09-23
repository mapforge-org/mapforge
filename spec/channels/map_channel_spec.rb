require "rails_helper"

RSpec.describe MapChannel, type: :channel do
  let(:map) { create(:map) }
  let(:layer) { map.layers.first }
  let!(:a) { create(:feature, :point, layer: layer) }
  let!(:b) { create(:feature, :point, layer: layer) }

  before { stub_connection(uuid: SecureRandom.uuid, current_user: nil) }

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

  describe "#mouse" do
    let(:map) { create(:map, share_cursor: true) }

    it "broadcasts only the cursor position, never the private id" do
      subscribe(map_id: map.private_id)

      expect {
        perform :mouse, lng: 8.1, lat: 47.2, map_id: map.private_id, uuid: "spoofed",
          user_image: "https://evil.example/pixel.png"
      }.to have_broadcasted_to("map_channel_#{map.public_id}")
        .with(event: "mouse", uuid: connection.uuid, lng: 8.1, lat: 47.2)
    end

    it "broadcasts nothing when the map does not share cursors" do
      map.update!(share_cursor: false)
      subscribe(map_id: map.private_id)

      expect { perform :mouse, lng: 8.1, lat: 47.2 }.not_to have_broadcasted_to("map_channel_#{map.public_id}")
    end

    context "with a logged in user" do
      let(:user) { create(:user) }

      before { stub_connection(uuid: SecureRandom.uuid, current_user: user) }

      it "names the cursor after the user" do
        subscribe(map_id: map.private_id)

        expect { perform :mouse, lng: 8.1, lat: 47.2 }
          .to have_broadcasted_to("map_channel_#{map.public_id}")
          .with(event: "mouse", uuid: connection.uuid, lng: 8.1, lat: 47.2,
            user_name: user.name, user_image: user.image)
      end

      it "keeps the cursor anonymous on the playground" do
        map.update!(private_id: Map::PLAYGROUND_ID)
        subscribe(map_id: map.private_id)

        expect { perform :mouse, lng: 8.1, lat: 47.2 }
          .to have_broadcasted_to("map_channel_#{map.public_id}")
          .with(event: "mouse", uuid: connection.uuid, lng: 8.1, lat: 47.2)
      end
    end
  end

  describe "#update_map with a private permission" do
    let(:user) { create(:user) }

    before do
      stub_connection(uuid: SecureRandom.uuid, current_user: user)
      subscribe(map_id: map.private_id)
    end

    it "refuses a user who does not own the map" do
      expect { perform :update_map, map_id: map.private_id, view_permission: "private" }.to raise_error(/owner/)
      expect { perform :update_map, map_id: map.private_id, edit_permission: "private" }.to raise_error(/owner/)
      expect(map.reload.attributes.values_at("view_permission", "edit_permission")).to eq %w[link link]
    end

    it "lets the owner set the map to private" do
      map.add_owner(user)
      perform :update_map, map_id: map.private_id, view_permission: "private"
      expect(map.reload.view_permission).to eq "private"
    end

    it "lets a visitor list the map in the gallery" do
      perform :update_map, map_id: map.private_id, view_permission: "listed"
      expect(map.reload.view_permission).to eq "listed"
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

    context "with a bulk import" do
      let(:ids) { Array.new(5) { BSON::ObjectId.new.to_s } }

      before do
        subscribe(map_id: map.private_id)
        allow(ActionCable.server).to receive(:broadcast).and_call_original
        image = create(:image)
        features = ids.map do |id|
          { "id" => id, "type" => "Feature", "properties" => { "marker-image-url" => "/image/#{image.public_id}" },
            "geometry" => { "type" => "LineString", "coordinates" => [ [ 8.1, 47.2 ], nil, [ 8.2, 47.3 ] ] } }
        end
        perform :new_layer, id: BSON::ObjectId.new.to_s, map_id: map.private_id, type: "geojson",
          geojson: { "features" => features }
      end

      it "stores the features in order, sanitized, counted and with their image" do
        imported = map.reload.layers.last
        expect(imported.features.map { |f| f.id.to_s }).to eq ids
        expect(imported.features_count).to eq 5
        expect(imported.features.first.image).to eq Image.last
        expect(imported.features.first.geometry["coordinates"]).to eq [ [ 8.1, 47.2 ], [ 8.2, 47.3 ] ]
      end

      it "broadcasts the layer once instead of each feature" do
        expect(ActionCable.server).to have_received(:broadcast)
          .with("map_channel_#{map.public_id}", hash_including(event: "update_layer")).once
        expect(ActionCable.server).not_to have_received(:broadcast)
          .with("map_channel_#{map.public_id}", hash_including(event: "update_feature"))
      end
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

  describe "moving a feature to another layer" do
    let!(:target) { create(:layer, map: map) }

    def move(layer_id, map_id: map.private_id)
      perform :update_feature, id: a.id.to_s, map_id:, layer_id: layer_id.to_s,
        geometry: a.geometry, properties: a.properties
    end

    it "moves the feature, updates both counters and broadcasts the new layer" do
      subscribe(map_id: map.private_id)

      expect { move(target.id) }.to have_broadcasted_to("map_channel_#{map.public_id}")
        .with(hash_including(event: "update_feature", layer_id: target.id.to_s))
      expect(a.reload.layer).to eq target
      expect(layer.reload.features_count).to eq 1
      expect(target.reload.features_count).to eq 1
    end

    it "rejects a layer of another map" do
      other_layer = create(:map).layers.first
      subscribe(map_id: map.private_id)

      expect { move(other_layer.id) }.to raise_error(/not found/)
      expect(a.reload.layer).to eq layer
    end

    it "rejects a move with the public id" do
      subscribe(map_id: map.public_id)

      expect { move(target.id, map_id: map.public_id) }.to raise_error(/public/)
      expect(a.reload.layer).to eq layer
    end
  end

  describe "image relation" do
    let(:image) { Image.create!(img: File.new(Rails.root.join("public/logo/pwa/mapforge-logo-pwa-512.png"))) }

    before { subscribe(map_id: map.private_id) }

    def geometry
      { "type" => "Point", "coordinates" => [ 8.1, 47.2 ] }
    end

    it "sets the relation for each property that carries a hosted image" do
      %w[marker-image-url fill-image-url marker-symbol].each do |property|
        perform :update_feature, id: a.id.to_s, map_id: map.private_id, geometry: geometry,
          properties: { property => "/icon/#{image.public_id}" }

        expect(a.reload.image).to eq image
      end
    end

    it "clears the relation when the image is removed from the properties" do
      perform :update_feature, id: a.id.to_s, map_id: map.private_id, geometry: geometry,
        properties: { "marker-image-url" => "/image/#{image.public_id}" }
      expect(a.reload.image).to eq image

      perform :update_feature, id: a.id.to_s, map_id: map.private_id, geometry: geometry, properties: {}

      expect(a.reload.image).to be_nil
    end

    it "leaves the relation empty for an image that is not hosted on mapforge" do
      perform :update_feature, id: a.id.to_s, map_id: map.private_id, geometry: geometry,
        properties: { "marker-image-url" => "https://example.com/photo.png" }

      expect(a.reload.image).to be_nil
    end
  end
end
