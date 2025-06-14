class MapChannel < ApplicationCable::Channel
  # Allow to subscribe to changes with public + private id,
  # Check auth on update methods by looking up map with private id
  def subscribed
    Map.find(params[:map_id]) || Map.find_by(public_id: params[:map_id])
    stream_from "map_channel_#{params[:map_id]}"
    Rails.logger.debug { "MapChannel subscribed for '#{params[:map_id]}'" }
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
    # Rails.logger.debug "MapChannel unsubscribed"
  end

  def update_map(data)
    map = get_map_rw!(data["map_id"])
    map.update!(map_atts(data))
  end

  def update_layer(data)
    map = get_map_rw!(data["map_id"])
    layer = map.layers.find(layer_atts(data)["id"])
    layer.update!(layer_atts(data))
  end

  def update_feature(data)
    map = get_map_rw!(data["map_id"])
    feature = map.features.find(feature_atts(data)["id"])
    feature.update!(feature_atts(data))
  end

  def new_feature(data)
    map = get_map_rw!(data["map_id"])
    map.layers.geojson.first.features.create!(feature_atts(data))
  end

  def new_layer(data)
    map = get_map_rw!(data["map_id"])
    map.layers.create!(layer_atts(data))
  end

  def delete_feature(data)
    map = get_map_rw!(data["map_id"])
    feature = map.features.find(feature_atts(data)["id"])
    feature.destroy
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
    map = Map.find(id)
    raise "Cannot open map for writing with (public?) id '#{id}'" unless map
    map
  end
end
