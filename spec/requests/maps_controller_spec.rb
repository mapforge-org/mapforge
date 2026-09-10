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

    it "leaves the view defaults empty on a map without features" do
      get map_properties_path(id: create(:map, center: nil, zoom: nil).public_id)
      properties = JSON.parse(response.body)["properties"]
      expect(properties["default_center"]).to be_nil
      expect(properties["default_zoom"]).to be_nil
    end
  end

  # The client view is per request and never stored, so it travels on gon and not in
  # map_properties. A model broadcast has no request context and would overwrite it.
  describe "#show (client view)" do
    let(:map) { create(:map, center: nil, zoom: nil) }

    def gon_view(raw, params = {})
      result = MaxMindDB::Result.new(raw)
      stub_const("MAXMIND_DB", instance_double(MaxMindDB::Client, lookup: result))
      get map_path({ id: map.public_id }.merge(params))
      { center: JSON.parse(response.body[/^gon\.client_center=(.*?);$/, 1]),
        zoom: JSON.parse(response.body[/^gon\.client_zoom=(.*?);$/, 1]) }
    end

    it "derives the client zoom from the accuracy radius" do
      view = gon_view("location" => { "longitude" => 11.0, "latitude" => 49.0, "accuracy_radius" => 20 })
      expect(view[:center]).to eq [ 11.0, 49.0 ]
      expect(view[:zoom]).to eq 10
    end

    it "zooms out on a country wide accuracy radius" do
      view = gon_view("location" => { "longitude" => 11.0, "latitude" => 49.0, "accuracy_radius" => 1000 })
      expect(view[:zoom]).to eq 4
    end

    it "keeps the default zoom when the accuracy radius is missing" do
      view = gon_view("location" => { "longitude" => 11.0, "latitude" => 49.0 })
      expect(view[:center]).to eq [ 11.0, 49.0 ]
      expect(view[:zoom]).to eq Map::DEFAULT_ZOOM
    end

    it "falls back to the static defaults when the record has no coordinates" do
      view = gon_view("country" => { "names" => { "en" => "Germany" } })
      expect(view[:center]).to eq Map::DEFAULT_CENTER
      expect(view[:zoom]).to eq Map::DEFAULT_ZOOM
    end

    it "skips the lookup and uses the static zoom when the map has a center" do
      map.update!(center: [ 1.0, 2.0 ])
      view = gon_view("location" => { "longitude" => 11.0, "latitude" => 49.0, "accuracy_radius" => 20 })
      expect(view[:center]).to eq Map::DEFAULT_CENTER
      expect(view[:zoom]).to eq Map::DEFAULT_ZOOM
    end

    it "falls back to the creator region when the lookup finds nothing" do
      map.update!(creator_center: [ 7.6, 51.9 ], creator_zoom: 9)
      view = gon_view("country" => { "names" => { "en" => "Germany" } })
      expect(view[:center]).to eq [ 7.6, 51.9 ]
      expect(view[:zoom]).to eq 9
    end

    # The screenshot browser runs on the server, so its own location must not be used
    it "skips the lookup in static mode and uses the creator region" do
      map.update!(creator_center: [ 7.6, 51.9 ], creator_zoom: 9)
      view = gon_view({ "location" => { "longitude" => 11.0, "latitude" => 49.0, "accuracy_radius" => 20 } },
        { static: true })
      expect(view[:center]).to eq [ 7.6, 51.9 ]
      expect(view[:zoom]).to eq 9
    end
  end

  describe "access control" do
    let(:user) { create(:user) }

    def login
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    end

    context "with edit_permission private" do
      let(:map) { create(:map, edit_permission: "private", owners: [ user ]) }

      it "is not accessible via link" do
        get map.private_map_path
        expect(response).to redirect_to(maps_path)
      end

      it "is accessible for the owner" do
        login
        get map.private_map_path
        expect(response).to have_http_status(:ok)
      end
    end

    context "with edit_permission link" do
      let(:map) { create(:map, edit_permission: "link") }

      it "is accessible via link" do
        get map.private_map_path
        expect(response).to have_http_status(:ok)
      end
    end

    context "with view_permission private" do
      let(:map) { create(:map, view_permission: "private", owners: [ user ]) }

      it "is not accessible via link" do
        get map.public_map_path
        expect(response).to redirect_to(maps_path)
      end

      it "is accessible for the owner" do
        login
        get map.public_map_path
        expect(response).to have_http_status(:ok)
      end
    end

    context "with view_permission link" do
      let(:map) { create(:map, view_permission: "link") }

      it "is accessible via link" do
        get map.public_map_path
        expect(response).to have_http_status(:ok)
      end
    end

    context "with view_permission public" do
      let(:map) { create(:map, view_permission: "public") }

      it "is accessible via link" do
        get map.public_map_path
        expect(response).to have_http_status(:ok)
      end
    end
  end

  describe "#index" do
    let(:user) { create(:user) }

    it "lists the public link of a listed map" do
      map = create(:map, view_permission: "listed")
      get maps_path
      expect(response.body).to include("/m/#{map.public_id}")
    end

    it "searches in map names" do
      create(:map, name: "Map1", view_permission: "listed")
      create(:map, name: "Map2", view_permission: "listed")
      get maps_path, params: { search: "Map1" }
      expect(response.body).to include("Map1")
      expect(response.body).not_to include("Map2")
    end

    it "searches for map owners" do
      create(:map, name: "Map1", view_permission: "listed")
      create(:map, name: "Map2", owners: [ user ], view_permission: "listed")
      get maps_path, params: { search: "user:#{user.id}" }
      expect(response.body).to include("Map2")
      expect(response.body).not_to include("Map1")
    end

    it "lists every map again without a search" do
      create(:map, name: "Map1", view_permission: "listed")
      create(:map, name: "Map2", view_permission: "listed")
      get maps_path
      expect(response.body).to include("Map1")
      expect(response.body).to include("Map2")
    end
  end

  describe "#my" do
    let(:user) { create(:user) }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    end

    it "lists the private link of an own map" do
      map = create(:map, owners: [ user ])
      get my_path
      expect(response.body).to include("/m/#{map.private_id}")
    end

    it "searches in map names" do
      create(:map, name: "Map1", owners: [ user ])
      create(:map, name: "Map2", owners: [ user ])
      get my_path, params: { search: "Map1" }
      expect(response.body).to include("Map1")
      expect(response.body).not_to include("Map2")
    end
  end

  describe "#create" do
    let(:user) { create(:user) }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      result = MaxMindDB::Result.new("location" => { "longitude" => 11.0776, "latitude" => 49.4471,
                                                     "accuracy_radius" => 20 })
      stub_const("MAXMIND_DB", instance_double(MaxMindDB::Client, lookup: result))
    end

    it "stores no center and no zoom, so every visitor resolves the view themselves" do
      post create_map_path
      map = user.reload.owned_maps.first
      expect(map.center).to be_nil
      expect(map.zoom).to be_nil
    end

    it "stores the rounded creator region for the preview screenshot" do
      post create_map_path
      map = user.reload.owned_maps.first
      expect(map.creator_center).to eq [ 11.1, 49.4 ]
      expect(map.creator_zoom).to eq 10
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

    it "lists a map viewed in both modes once, in rw mode" do
      result = controller.send(:load_recent_maps, [ map1.private_id, map1.public_id ])
      expect(result).to eq [ [ map1, true ] ]
    end

    it "lists a map in rw mode even if the public_id was viewed last" do
      result = controller.send(:load_recent_maps, [ map1.public_id, map2.public_id, map1.private_id ])
      expect(result).to eq [ [ map1, true ], [ map2, false ] ]
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
