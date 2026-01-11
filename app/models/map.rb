class Map
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps
  include Turbo::Broadcastable

  has_many :layers, dependent: :destroy
  belongs_to :user, optional: true, counter_cache: true

  # implicit_order_column is not supported by mongoid
  default_scope { order(created_at: :asc) }
  scope :listed, -> { where(view_permission: "listed") }
  scope :ulogger, -> { where(:_id.lt => BSON::ObjectId("000000000000002147483647")) }
  scope :demo, -> { where(demo: true) }
  scope :tutorial, -> { where(type: "tutorial") }
  scope :search, ->(term) {
    regex = /#{Regexp.escape(term)}/i
    where(:$or => [ { name: regex }, { description: regex } ])
  }
  scope :sorted, ->(col, dir) {
    col = "created_at" unless col.present?
    dir = %w[asc desc].include?(dir) ? dir : "asc"
    order(col.to_sym => dir.to_sym)
  }

  field :base_map, type: String, default: -> { default_base_map }
  field :center, type: Array
  field :zoom, type: String
  field :terrain, type: Boolean
  field :hillshade, type: Boolean
  field :contours, type: Boolean
  field :globe, type: Boolean
  field :pitch, type: String
  field :bearing, type: String
  field :name, type: String
  field :description, type: String
  field :private_id, type: String, default: -> { SecureRandom.hex(6).tap { |i| i[0..1] = "11" } }
  field :public_id, type: String, default: -> { SecureRandom.hex(4).tap { |i| i[0..1] = "11" } }
  field :viewed_at, type: DateTime
  field :view_count, type: Integer, default: 0
  field :type, type: String
  field :share_cursor, type: Boolean
  field :edit_permission, type: String, default: "link" # 'private', 'link'
  field :view_permission, type: String, default: "link" # 'private', 'link', 'listed'

  # Only BASE_MAPS are available in the UI
  BASE_MAPS = [ "versatilesColorful", "satelliteStreets", "openTopoTiles",
    "openfreemapLiberty", "versatilesGraybeard", "versatilesEclipse",
    "stamenWatercolorTiles", "cyclosmTiles" ]
  STADIA_MAPS = [ "stamenTonerTiles", "stamenWatercolorTiles" ]
  OPENFREE_MAPS = [ "openfreemapPositron", "openfreemapBright", "openfreemapLiberty" ]
  VERSATILES_MAPS = [ "versatilesColorful", "versatilesGraybeard" ]
  MAPTILER_MAPS = [ "maptilerBuildings", "maptilerHybrid", "maptilerDataviz",
                    "maptilerStreets", "maptilerNoStreets", "maptilerWinter",
                    "maptilerBike", "maptilerBasic" ]
  OTHER_MAPS = [ "cyclosmTiles", "satelliteStreets", "osmRasterTiles" ]

  DEFAULT_CENTER = [ 11.077, 49.447 ].freeze
  DEFAULT_ZOOM = 10
  DEFAULT_PITCH = 30
  DEFAULT_BEARING = 0
  DEFAULT_TERRAIN = false
  DEFAULT_HILLSHADE = false
  DEFAULT_GLOBE = false
  DEFAULT_CONTOURS = false

  # mongoid callbacks: https://www.mongodb.com/docs/mongoid/current/data-modeling/callbacks/
  before_create :create_default_layer
  # broadcasts: https://www.rubydoc.info/github/hotwired/turbo-rails/Turbo/Streams/Broadcasts
  after_create do
    # using refresh to make sure map access is authorized
    broadcast_refresh_to("admin_maps_list")
    broadcast_refresh_to("public_maps_list") if view_permission == "listed"
    # broadcast_prepend_to("admin_maps_list", target: "maps", partial: "maps/map",
    #  locals: { rw: true, avatar: true, delete: true, last_change: true })
  end
  after_update(
    if: Proc.new { |record|
      record.saved_change_to_attribute?(:name) ||
      record.saved_change_to_attribute?(:view_permission)
    }) do
    broadcast_refresh_to("admin_maps_list")
    broadcast_refresh_to("public_maps_list") if view_permission == "listed"
  end
  after_save :broadcast_update

  after_destroy do
    delete_screenshot
    # Note: cannot broadcast well to my_maps_list because the stream is not user-specific
    broadcast_refresh_to("admin_maps_list")
    broadcast_refresh_to("public_maps_list") if view_permission == "listed"
  end

  validates :public_id, uniqueness: { message: "public_id already taken" },
    format: { without: /\//, message: "public_id cannot contain a '/'" },
    if: :will_save_change_to_public_id?
  validates :private_id, uniqueness: { message: "private_id already taken" },
    format: { without: /\//, message: "private_id cannot contain a '/'" },
    if: :will_save_change_to_private_id?

  def properties
    { name: name,
      description: description,
      public_id: public_id,
      base_map: get_base_map,
      type: type,
      center: center,
      default_center: center ? nil : calculated_center, # only set when no center defined
      zoom: zoom,
      default_zoom: zoom ? nil : calculated_zoom, # only set when no zoom defined
      pitch: pitch || DEFAULT_PITCH,
      bearing: bearing || DEFAULT_BEARING,
      terrain: terrain || DEFAULT_TERRAIN,
      hillshade: hillshade || DEFAULT_HILLSHADE,
      contours: contours || DEFAULT_CONTOURS,
      globe: globe || DEFAULT_GLOBE,
      share_cursor: share_cursor || false,
      view_permission: view_permission,
      edit_permission: edit_permission
    }
  end

  def self.provider_keys
    { mapbox: ENV["MAPBOX_KEY"],
      maptiler: ENV["MAPTILER_KEY"],
      openrouteservice: ENV["OPENROUTESERVICE_KEY"] }
  end

  def to_json
    { properties: properties, layers: layers.map(&:to_json) }.to_json
  end

  # flattened geojson collection of all layers
  def to_geojson
      { type: "FeatureCollection",
        features: layers.geojson.map(&:features).flatten.map(&:geojson) }
  end

  def to_gpx
    # https://github.com/hiroaki/ruby-gpx?tab=readme-ov-file#examples
    GPX::GeoJSON.convert_to_gpx(
      name:,
      description:,
      geojson_data: to_geojson.to_json,
      line_string_feature_to_track: ->(pt, wpt) { wpt.name = pt["properties"]["title"] || pt["properties"]["name"] })
  end

  def features
    @features ||= Feature.in(layer: layers.geojson.pluck(:id))
  end

  def features_count
    # Use to_a here to avoid additional db query. Mongoid always runs a query to sum()
    layers.to_a.sum(&:features_count)
  end

  def self.create_from_file(path, collection_format: 4326)
    file = File.read(path)
    map_hash = JSON.parse(file)

    map = Map.create!(map_hash["properties"].except("default_center", "default_zoom", "public_id"))
    map.layers.delete_all
    map_hash["layers"].each do |layer|
      features = Feature.from_collection(layer["geojson"], collection_format: collection_format)
      layer = Layer.create!(name: layer["name"], type: layer["type"], query: layer["query"],
        features: features)
      map.layers << layer
    end

    Rails.logger.info "Created map with #{map.features.size} features from #{path}"
    Rails.logger.info "Public id: #{map.public_id}, private id: #{map.private_id}"
    map
  end

  def clone_with_layers
    clone = self.dup
    clone.update(created_at: Time.zone.now, updated_at: Time.zone.now,
      private_id: fields["private_id"].default_val.call,
      public_id: fields["public_id"].default_val.call,
      view_count: 0, viewed_at: nil)
    clone.layers = layers.map { |l| l.clone_with_features }
    clone
  end

  def screenshot
    "/previews/#{safe_public_id}.jpg?#{updated_at.to_i}" if File.exist?(screenshot_file)
  end

  def screenshot_file
    Rails.root.join("public/previews/#{safe_public_id}.jpg").to_s
  end

  def private_map_path
    Rails.application.routes.url_helpers.map_path(id: private_id, name: name)
  end

  def public_map_path
    Rails.application.routes.url_helpers.map_path(id: public_id, name: name)
  end

  private

  def create_default_layer
    self.layers << Layer.create!(map: self, type: "geojson") unless layers.present?
  end

  def all_points
    coordinates = features.map { |feature| feature.coordinates(include_height: false) }
    coordinates.flatten.each_slice(2).to_a
  end

  # setting center to average of all coordinates
  def calculated_center
    coordinates = all_points
    if coordinates.present?
      average_latitude = coordinates.map(&:first).reduce(:+) / coordinates.size.to_f
      average_longitude = coordinates.map(&:last).reduce(:+) / coordinates.size.to_f
      Rails.logger.info("Calculated map (#{id}) center: #{[ average_latitude, average_longitude ]}")
      [ average_latitude, average_longitude ]
    else
     DEFAULT_CENTER
    end
  end

  def calculated_zoom
    coordinates = all_points
    if coordinates.present?
      point1 = RGeo::Geographic.spherical_factory.point(coordinates.map(&:first).max, coordinates.map(&:last).max)
      point2 = RGeo::Geographic.spherical_factory.point(coordinates.map(&:first).min, coordinates.map(&:last).min)
      distance_km = point1.distance(point2) / 1000
      Rails.logger.info("Calculated map (#{id}) feature distance: #{distance_km} km")
      case distance_km
      when 0 then DEFAULT_ZOOM
      when 0..1 then 16
      when 1..4 then 14
      when 4..10 then 12
      when 10..50 then 10
      when 50..100 then 9
      when 100..200 then 8
      when 200..1000 then 6
      when 1000..2000 then 4
      else 2
      end
    else
     DEFAULT_ZOOM
    end
  end

  def get_base_map
    if MAPTILER_MAPS.include?(base_map)
      return base_map if ENV["MAPTILER_KEY"].present?
      logger.warn("Cannot use maptiler map #{base_map} without MAPTILER_KEY. Falling back to: #{default_base_map}")
      return default_base_map
    elsif (BASE_MAPS + OPENFREE_MAPS + VERSATILES_MAPS + OTHER_MAPS).include?(base_map) || base_map == "test"
      return base_map
    end
    logger.warn("Map '#{base_map}' not found, falling back to #{default_base_map}")
    default_base_map
  end

  def default_base_map
    ENV["DEFAULT_MAP"] || "versatilesColorful"
  end

  def broadcast_update
    # calculate properties only once
    map_properties = properties
    # broadcast to private + public channel
    [ private_id, public_id ].each do |id|
      ActionCable.server.broadcast("map_channel_#{id}",
        { event: "update_map", map: map_properties.as_json })
    end
  end

  def delete_screenshot
    File.delete(screenshot_file) if File.exist?(screenshot_file)
  end

  def safe_public_id
    separator = "_"
    public_id.strip
        .gsub(/[^\w\.\-]+/, separator)
        .gsub(/#{separator}+/, separator)
        .gsub(/\A#{separator}+|#{separator}+\z/, "")
  end

  def self.tutorial_map(user)
    tutorial_file = Rails.root.join("db/seeds/demo.json")

    if user&.name
      unless map = Map.tutorial.where(user: user).first
        map = Map.create_from_file(tutorial_file)
        name = user.name.split.first
        map.update(user: user, type: "tutorial")
        map.features.where("properties.label" => "Welcome to the Mapforge Tutorial map")
           .update_all("properties.label" => "Welcome #{name} to the Mapforge Tutorial map")
      end
    else
      map = Map.create_from_file(tutorial_file)
      map.update(type: "tutorial")
    end
    map
  end
end
