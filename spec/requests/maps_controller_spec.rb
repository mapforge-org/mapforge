require "rails_helper"

describe MapsController do
  let(:map) { create(:map) }

  # The client's reconnect handler compares the map's updated_at (from /properties)
  # against the value loaded with the full map (from /m/:id.json) to decide whether a
  # full reload is needed. Both endpoints must expose it as a top-level field.
  describe "#show (json)" do
    it "includes the map updated_at" do
      get map_json_path(id: map.public_id)
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["updated_at"]).to be_present
    end
  end

  describe "#properties" do
    it "includes the map updated_at" do
      get map_properties_path(id: map.public_id)
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["updated_at"]).to be_present
    end
  end

  describe "#destroy" do
    it "fails if not called from owning user or admin" do
      response = delete destroy_map_path(id: map.private_id)
      expect(response).to redirect_to(maps_path)
      expect(map.reload).not_to be_destroyed
    end
  end

  describe "#tutorial" do
    let(:user) { create(:user) }

    it "creates new tutorial map for each guest user" do
      post tutorial_path
      post tutorial_path
      expect(Map.tutorial.count).to eq 2
    end

    it "creates persistent tutorial map for each logged in user" do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      post tutorial_path
      post tutorial_path
      expect(Map.tutorial.count).to eq 1
    end
  end

  describe "#layer" do
    let(:layer) { map.layers.first }

    before do
      create(:feature, :point, layer: layer)
      create(:feature, :line_string, layer: layer)
    end

    it "returns the layer's features as a GeoJSON FeatureCollection" do
      get map_layer_geo_path(id: map.public_id, layer_id: layer.id)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["type"]).to eq "FeatureCollection"
      expect(body["features"].size).to eq 2
      # MapLibre's promoteId:'id' reads the id from properties
      expect(body["features"].map { |f| f["properties"]["id"] }).to all(be_present)
    end

    it "returns 404 for an unknown layer id" do
      get map_layer_geo_path(id: map.public_id, layer_id: BSON::ObjectId.new.to_s)
      expect(response).to have_http_status(:not_found)
    end

    it "denies access to a private map for non-owners" do
      map.update!(view_permission: "private")
      get map_layer_geo_path(id: map.public_id, layer_id: layer.id)
      expect(response).to redirect_to(maps_path)
    end
  end

  describe "#map" do
    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    end

    let(:user) { create(:user) }

    it "creates persistent tutorial map for each logged in user" do
      get map_path(id: map.private_id, join: true)

      expect(map.reload.owners).to eq [ user ]
    end
  end

  describe "#load_recent_maps" do
    let(:controller) { described_class.new }
    let(:map1) { create(:map) }
    let(:map2) { create(:map) }
    let(:map3) { create(:map) }

    it "returns [map, true] when ID matches private_id" do
      result = controller.send(:load_recent_maps, [ map1.private_id ])
      expect(result.count).to eq 1
      expect(result.first).to eq [ map1, true ]
    end

    it "returns [map, false] when ID matches public_id" do
      result = controller.send(:load_recent_maps, [ map1.public_id ])
      expect(result.count).to eq 1
      expect(result.first).to eq [ map1, false ]
    end

    it "returns empty array for blank input" do
      expect(controller.send(:load_recent_maps, [])).to eq []
      expect(controller.send(:load_recent_maps, nil)).to eq []
    end

    it "skips IDs that don't match any map" do
      result = controller.send(:load_recent_maps, [ "nonexistent" ])
      expect(result).to eq []
    end

    it "preserves input order, mixing private and public IDs" do
      ids = [ map2.public_id, map1.private_id, map3.public_id ]
      result = controller.send(:load_recent_maps, ids)
      expect(result.count).to eq 3
      expect(result[0]).to eq [ map2, false ]
      expect(result[1]).to eq [ map1, true ]
      expect(result[2]).to eq [ map3, false ]
    end

    it "prioritizes private_id match over public_id for same map" do
      result = controller.send(:load_recent_maps, [ map1.private_id, map1.public_id ])
      expect(result.count).to eq 2
      expect(result[0]).to eq [ map1, true ]
      expect(result[1]).to eq [ map1, false ]
    end

    it "skips missing IDs while preserving order of found maps" do
      ids = [ map1.private_id, "nonexistent", map2.public_id ]
      result = controller.send(:load_recent_maps, ids)
      expect(result.count).to eq 2
      expect(result[0]).to eq [ map1, true ]
      expect(result[1]).to eq [ map2, false ]
    end
  end
end
