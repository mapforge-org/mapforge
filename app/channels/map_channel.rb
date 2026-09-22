class MapChannel < ApplicationCable::Channel
  # Accept subscriptions with either private_id or public_id; write operations
  # are authorized by requiring the private_id in the message payload.
  def subscribed
    super
    map = Map.by_any_id(params[:map_id])
    unless map
      Rails.logger.warn "Invalid map id #{params[:map_id]} for subscribing to channel"
      reject
      return
    end

    @public_id = map.public_id
    @share_cursor = map.share_cursor
    stream_from "map_channel_#{@public_id}"
    transmit({ event: "connection", uuid: uuid })
    Rails.logger.info { "MapChannel subscribed '#{uuid}' for '#{params[:map_id]}'" }
  end

  def unsubscribed
    super
    payload = { event: "mouse_disconnect", uuid: uuid }
    ActionCable.server.broadcast("map_channel_#{@public_id}", payload) if @public_id && @share_cursor
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
    associate_image(data["properties"])
  end

  # new_feature uses the feature id set by the client
  def new_feature(data)
    Yabeda.websocket.messages_received.increment({ action: "new_feature", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    @feature = map.layers.geojson.first.features.create!(feature_atts(data).merge({ id: data["id"] }))
    associate_image(data["properties"])
  end

  # new_layer uses the layer + feature ids set by the client
  def new_layer(data)
    Yabeda.websocket.messages_received.increment({ action: "new_layer", channel: "MapChannel" })
    map = get_map_rw!(data["map_id"])
    layer = map.layers.new(layer_atts(data).merge({ id: data["id"] }))
    documents = import_documents(layer, data.dig("geojson", "features") || [])
    Feature.collection.insert_many(documents) if documents.any?
    layer.features_count = documents.size
    # Saved after the features, so that its one update_layer broadcast makes other
    # clients fetch the complete layer, instead of one update_feature per feature
    layer.save!
    Yabeda.layers_created.increment(type: layer.type)
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
    map = Map.by_private_id(id)
    raise "Cannot open map for writing with (public?) id '#{id}'" unless map
    map
  end

  # Properties that can carry a mapforge hosted image, in the order they win the relation.
  # A KMZ import puts the uploaded image into 'marker-symbol' (see import/kml.js).
  IMAGE_PROPERTIES = %w[marker-image-url fill-image-url marker-symbol].freeze
  IMAGE_URL = %r{\A/(?:icon|image)/(.+)\z}

  # Follows the properties in both directions: an image that is dropped from the properties
  # also drops the relation, so a feature never keeps an image it no longer shows.
  def associate_image(properties)
    image = image_for(properties)
    @feature.update!(image:) unless @feature.image_id == image&.id
  end

  def image_for(properties)
    properties = {} unless properties.is_a?(Hash)
    IMAGE_PROPERTIES.lazy.filter_map do |key|
      public_id = properties[key].to_s[IMAGE_URL, 1]
      Image.find_by(public_id:) if public_id
    end.first
  end

  # insert_many skips validations, callbacks and timestamps, so they are applied here
  def import_documents(layer, features)
    now = Time.now
    features.each_with_index.filter_map do |feature, index|
      doc = Feature.new(feature_atts(feature).merge({ id: feature["id"], layer_id: layer.id }.compact))
      # An import sends the whole folder in one message. Without this, the first invalid
      # feature would abort the import and silently drop every feature behind it.
      unless doc.valid?
        Rails.logger.warn "new_layer: skipping invalid feature #{feature["id"]}: #{doc.errors.full_messages}"
        next
      end
      doc.send(:sanitize_coordinates)
      doc.image = image_for(feature["properties"])
      # BSON dates keep milliseconds. Distinct timestamps keep the import order for the default scope.
      doc.created_at = doc.updated_at = now + (index / 1000.0)
      doc.as_document
    end
  end
end
