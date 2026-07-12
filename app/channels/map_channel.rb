class MapChannel < ApplicationCable::Channel
  # Accept subscriptions with either private_id or public_id; write operations
  # are authorized by requiring the private_id in the message payload.
  def subscribed
    super
    map = Map.find_by(private_id: params[:map_id]) || Map.find_by(public_id: params[:map_id])
    unless map
      Rails.logger.warn "Invalid map id #{params[:map_id]} for subscribing to channel"
      reject
      return
    end

    @public_id = map.public_id
    stream_from "map_channel_#{@public_id}"
    transmit({ event: "connection", uuid: uuid })
    Rails.logger.debug { "MapChannel subscribed '#{uuid}' for '#{params[:map_id]}'" }
  end

  def unsubscribed
    super
    payload = { event: "mouse_disconnect", uuid: uuid }
    ActionCable.server.broadcast("map_channel_#{@public_id}", payload) if @public_id
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
    layer = map.layers.find(data["id"])
    layer.update!(layer_atts(data))
  end

  def update_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "update_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    @feature = map.features.find(data["id"])
    raise "Feature #{data["id"]} not found on map #{data["map_id"]}" unless @feature
    @feature.update!(feature_atts(data))
    associate_image(data["properties"]["marker-image-url"]) if data["properties"] && data["properties"]["marker-image-url"]
  end

  # new_feature uses the feature id set by the client
  def new_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "new_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    first_feature = map.features_count.zero?
    @feature = map.layers.geojson.first.features.create!(feature_atts(data).merge({ id: data["id"] }))
    associate_image(data["properties"]["marker-image-url"]) if data["properties"] && data["properties"]["marker-image-url"]
    # Clear IP-derived center on first feature, so the view recomputes from features
    map.update!(center: nil, zoom: nil) if first_feature && map.center.present?
  end

  # new_layer uses the layer + feature ids set by the client
  def new_layer(data)
    Yabeda.websocket.messages_received.increment({ action: "new_layer", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    layer = map.layers.create!(layer_atts(data).merge({ id: data["id"] }))
    Yabeda.layers_created.increment(type: layer.type)
    if data["geojson"] && data["geojson"]["features"]
      data["geojson"]["features"].each do |feature|
        layer.features.create!(feature_atts(feature).merge({ id: feature["id"] }))
      end
    end
  end

  def delete_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "delete_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    feature = map.features.find(data["id"])
    feature.destroy
  end

  def delete_layer(data)
    Yabeda.websocket.messages_received.increment({ action: "delete_layer", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    layer = map.layers.find(data["id"])
    layer.destroy
  end

  def mouse(data)
    data[:event] = "mouse"
    if (user = User.find_by(id: data["user_id"]))
      data[:user_name] = user.name
      data[:user_image] = user.image
    end
    ActionCable.server.broadcast("map_channel_#{@public_id}", data) if @public_id
  end

  private

  def feature_atts(data)
    # TODO: validate nested atts
    # ActionController::Parameters.new(data).permit(:type, :id, geometry: [:type, coordinates: []], properties: {})
    atts = data.slice("type", "geometry", "properties")
    # drop the id in properties which is a workaround for https://github.com/mapbox/mapbox-gl-js/issues/2716
    atts["properties"]&.delete("id")
    atts
  end

  def map_atts(data)
    data.slice("name", "description", "base_map", "center", "zoom", "pitch",
      "bearing", "terrain", "hillshade", "globe", "contours", "view_permission", "edit_permission")
  end

  def layer_atts(data)
    data.slice("type", "name", "query", "heatmap", "cluster", "show", "feature_order")
  end

  # load map with write access
  def get_map_rw!(id)
    map = Map.find_by(private_id: id)
    raise "Cannot open map for writing with (public?) id '#{id}'" unless map
    map
  end

  def associate_image(url)
    public_id = url.to_s.sub(%r{^/(icon|image)/}, "")
    if (img = Image.find_by(public_id:))
      @feature.update!(image: img)
    else
      # :nocov:
      Rails.logger.info "Cannot associate image object '#{public_id}' to feature, not hosted on mapforge"
      # :nocov:
    end
  end
end
