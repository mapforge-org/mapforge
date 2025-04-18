class Map
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps
  include Turbo::Broadcastable

  has_many :layers
  belongs_to :user, optional: true, counter_cache: true

  scope :listed, -> { where(view_permission: "listed") }

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
  field :public_id, type: String
  field :edit_permission, type: String, default: "link" # 'private', 'link'
  field :view_permission, type: String, default: "link" # 'private', 'link', 'listed'
  field :images_count, type: Integer, default: 0

  BASE_MAPS = [ "versatilesColorful", "maptilerHybrid", "openTopoTiles", "openfreemapLiberty",
    "versatilesGraybeard"  ]
  STADIA_MAPS = [ "stamenTonerTiles", "stamenWatercolorTiles" ]
  OPENFREE_MAPS = [ "openfreemapPositron", "openfreemapBright", "openfreemapLiberty" ]
  VERSATILES_MAPS = [ "versatilesColorful", "versatilesGraybeard" ]
  MAPTILER_MAPS = [ "maptilerBuildings", "maptilerHybrid", "maptilerDataviz",
                    "maptilerStreets", "maptilerNoStreets", "maptilerWinter",
                    "maptilerBike", "maptilerBasic" ]

  DEFAULT_CENTER = [ 11.077, 49.447 ].freeze
  DEFAULT_ZOOM = 12
  DEFAULT_PITCH = 30
  DEFAULT_BEARING = 0
  DEFAULT_TERRAIN = false
  DEFAULT_HILLSHADE = false
  DEFAULT_GLOBE = false
  DEFAULT_CONTOURS = false

  # mongoid callbacks: https://www.mongodb.com/docs/mongoid/current/data-modeling/callbacks/
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

  after_destroy do
    broadcast_refresh_to("admin_maps_list")
    broadcast_refresh_to("public_maps_list") if view_permission == "listed"
  end

  after_save :broadcast_update
  after_destroy :delete_screenshot
  # broadcast updates when the layer changed because of default_center + default_zoom
  after_touch :broadcast_update, unless: proc { |record| record.center && record.zoom }
  before_create :create_public_id, :create_layer
  validate :public_id_must_be_unique

  def properties
    { name: name,
      description: description,
      public_id: public_id,
      base_map: get_base_map,
      center: center,
      default_center: default_center,
      zoom: zoom,
      default_zoom: default_zoom,
      pitch: pitch || DEFAULT_PITCH,
      bearing: bearing || DEFAULT_BEARING,
      terrain: terrain || DEFAULT_TERRAIN,
      hillshade: hillshade || DEFAULT_HILLSHADE,
      contours: contours || DEFAULT_CONTOURS,
      globe: globe || DEFAULT_GLOBE,
      view_permission: view_permission,
      edit_permission: edit_permission
    }
  end

  def self.provider_keys
    { mapbox: ENV["MAPBOX_KEY"],
      maptiler: ENV["MAPTILER_KEY"],
      openrouteservice: ENV["OPENROUTESERVICE_KEY"] }
  end

  def create_public_id
    self.public_id = SecureRandom.hex(4).tap { |i| i[0..1] = "11" } unless public_id.present?
  end

  def create_layer
    self.layers << Layer.create!(map: self) unless layers.present?
  end

  def to_json
    { properties: properties, layers: [ to_geojson ] }.to_json
  end

  def to_geojson
    { type: "FeatureCollection",
      features: features.map(&:geojson) }
  end

  def to_gpx
    # https://github.com/hiroaki/ruby-gpx?tab=readme-ov-file#examples
    GPX::GeoJSON.convert_to_gpx(geojson_data: to_geojson.to_json)
  end

  def features
    Feature.in(layer: layers.pluck(:id))
  end

  def features_count
    layers.sum(:features_count)
  end

  def public_id_must_be_unique
    # public id must not contain '/'
    errors.add(:public_id, "invalid public id") if public_id =~ /\//
    if Map.where(public_id: public_id).where.not(id: id).exists?
      errors.add(:public_id, "has already been taken")
    end
  end

  def self.create_from_file(path, collection_format: 4326)
    file = File.read(path)
    map_hash = JSON.parse(file)

    map = Map.find_or_create_by(public_id: map_hash["properties"]["public_id"])
    map.update(map_hash["properties"].except("default_center", "default_zoom"))
    map.layers.delete_all
    map.create_layer
    map.layers.first.update!(features: Feature.from_collection(map_hash["layers"][0],
collection_format: collection_format))

    Rails.logger.info "Created map with #{map.features.size} features from #{path}"
    Rails.logger.info "Public id: #{map.public_id}, private id: #{map.id}"
    map
  end

  def screenshot
    "/previews/#{safe_public_id}.jpg?#{updated_at.to_i}" if File.exist?(screenshot_file)
  end

  def screenshot_file
    Rails.root.join("public/previews/#{safe_public_id}.jpg").to_s
  end

  private

  def all_points
    coordinates = features.map { |feature| feature.coordinates(include_height: false) }
    coordinates.flatten.each_slice(2).to_a
  end

  def default_center
    if features.present?
      # setting center to average of all coordinates
      coordinates = all_points
      average_latitude = coordinates.map(&:first).reduce(:+) / coordinates.size.to_f
      average_longitude = coordinates.map(&:last).reduce(:+) / coordinates.size.to_f
      [ average_latitude, average_longitude ]
    else
     DEFAULT_CENTER
    end
  end

  def default_zoom
    if features.present?
      point1 = RGeo::Geographic.spherical_factory.point(all_points.map(&:first).max, all_points.map(&:last).max)
      point2 = RGeo::Geographic.spherical_factory.point(all_points.map(&:first).min, all_points.map(&:last).min)
      distance_km = point1.distance(point2) / 1000
      Rails.logger.info("Map feature distance: #{distance_km} km")
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
    elsif (BASE_MAPS + OPENFREE_MAPS + VERSATILES_MAPS).include?(base_map) || base_map == "test"
      return base_map
    end
    logger.warn("Map '#{base_map}' not found, falling back to #{default_base_map}")
    default_base_map
  end

  def default_base_map
    ENV["DEFAULT_MAP"] || "osmRasterTiles"
  end

  def broadcast_update
    # broadcast to private + public channel
    [ id, public_id ].each do |id|
      ActionCable.server.broadcast("map_channel_#{id}",
                                   { event: "update_map", map: properties.as_json })
    end
  end

  def delete_screenshot
    File.delete(screenshot_file) if File.exist?(screenshot_file)
  end

  def safe_public_id
    public_id.gsub(/\/|\.\./, "_")
  end
end
