class MapChannel < ApplicationCable::Channel
  # Allow to subscribe to changes with public + private id,
  # Check auth on update methods by looking up map with private id
  def subscribed
    super
    Map.find_by(private_id: params[:map_id]) || Map.find_by(public_id: params[:map_id])
    stream_from "map_channel_#{params[:map_id]}"
    Rails.logger.debug { "MapChannel subscribed for '#{params[:map_id]}'" }
  end

  def unsubscribed
    super
    # Any cleanup needed when channel is unsubscribed
    # Rails.logger.debug "MapChannel unsubscribed"
  end

  def update_map(data)
    Yabeda.websocket.messages_received.increment({ action: "update_map", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    map.update!(map_atts(data))
  end

  def update_layer(data)
    Yabeda.websocket.messages_received.increment({ action: "update_layer", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    layer = map.layers.find(layer_atts(data)["id"])
    layer.update!(layer_atts(data))
  end

  def update_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "update_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    @feature = map.features.find(feature_atts(data)["id"])
    @feature.update!(feature_atts(data))
    associate_image(data["properties"]["marker-image-url"]) if data["properties"] && data["properties"]["marker-image-url"]
  end

  def new_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "new_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    # reset initial map center on first feature
    map.update(center: nil) if map.features_count.zero?
    @feature = map.layers.geojson.first.features.create!(feature_atts(data))
    associate_image(data["properties"]["marker-image-url"]) if data["properties"] && data["properties"]["marker-image-url"]
  end

  def new_layer(data)
    Yabeda.websocket.messages_received.increment({ action: "new_layer", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    map.layers.create!(layer_atts(data))
  end

  def delete_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "delete_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    feature = map.features.find(feature_atts(data)["id"])
    feature.destroy
  end

  def delete_layer(data)
    Yabeda.websocket.messages_received.increment({ action: "delete_layer", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    layer = map.layers.find(layer_atts(data)["id"])
    layer.destroy
  end

  private

  def feature_atts(data)
    # TODO: validate nested atts
    # ActionController::Parameters.new(data).permit(:type, :id, geometry: [:type, coordinates: []], properties: {})
    atts = data.slice("type", "id", "geometry", "properties")
    # drop the id in properties which is a workaround for https://github.com/mapbox/mapbox-gl-js/issues/2716
    atts["properties"]&.delete("id")
    atts
  end

  def map_atts(data)
    data.slice("name", "description", "base_map", "center", "zoom", "pitch",
      "bearing", "terrain", "hillshade", "globe", "contours", "view_permission", "edit_permission")
  end

  def layer_atts(data)
    data.slice("id", "type", "name", "query")
  end

  # load map with write access
  def get_map_rw!(id)
    map = Map.find_by(private_id: id)
    raise "Cannot open map for writing with (public?) id '#{id}'" unless map
    map
  end

  def associate_image(url)
    public_id = url.to_s.sub(%r{^/icon/}, "")
    if img = Image.find_by(public_id:)
      @feature.update!(image: img)
    end
  end
end
