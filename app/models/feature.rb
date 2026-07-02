class Feature
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps

  belongs_to :layer, optional: true, touch: true, counter_cache: true
  belongs_to :image, optional: true
  delegate :map, to: :layer

  field :type, type: String, default: "Feature"
  field :geometry, type: Hash, default: {}
  field :properties, type: Hash, default: {}

  index({ layer_id: 1, created_at: 1 }, background: true)

  # implicit_order_column is not supported by mongoid
  default_scope { order(created_at: :asc) }
  scope :point, -> { where("geometry.type" => "Point") }
  scope :polygon, -> { where("geometry.type" => "Polygon") }
  scope :line_string, -> { where("geometry.type" => "LineString") }
  scope :latest, -> { order_by(created_at: :desc) }

  after_destroy :broadcast_destroy, if: -> { layer.present? && map.present? }
  after_destroy :destroy_image_if_last_feature

  after_save :broadcast_update, if: -> {
    previous_changes.present? && layer.present? && map.present? &&
      (previous_changes["geometry"] || previous_changes["properties"])
  }
  before_save :sanitize_coordinates
  validate :require_coords

  def geojson
    # MapLibre's promoteId:'id' reads the id from properties, so expose it there too,
    # alongside the top-level id used by feature lookups/frontFeature.
    { id: _id.to_s,
     type:,
     geometry:,
     properties: (properties || {}).merge("id" => _id.to_s) }
  end

  def to_geojson
    { type: "FeatureCollection",
     features: [ geojson ] }
  end

  def to_gpx
    # https://github.com/hiroaki/ruby-gpx?tab=readme-ov-file#examples
    GPX::GeoJSON.convert_to_gpx(geojson_data: to_geojson.to_json)
  end

  # input file formats are typically gps format EPSG:4326 (WGS 84) or
  # web_mercator format EPSG:3857
  def self.from_collection(geojson, collection_format: 4326, db_format: 4326)
    db_format = RGeo::Cartesian.factory(srid: db_format)
    collection_format = RGeo::Cartesian.factory(srid: collection_format)
    feature_collection = RGeo::GeoJSON.decode(geojson, geo_factory: collection_format)
    feature_collection.map do |feature|
      next unless feature.geometry
      # transform coords from input to db format
      if collection_format != db_format
        transformed_geometry = RGeo::Feature.cast(feature.geometry, factory: db_format, project: true)
        feature = RGeo::GeoJSON::Feature.new(transformed_geometry, feature.feature_id, feature.properties)
      end
      Feature.create!(RGeo::GeoJSON.encode(feature).except("id"))
    end
  end

  def coordinates(include_height: true)
    include_height ? geometry["coordinates"] : drop_elevation(geometry["coordinates"] || [])
  end

  private

  def sanitize_coordinates
    return unless geometry["coordinates"].is_a?(Array)
    geometry["coordinates"] = compact_coordinates(geometry["coordinates"])
  end

  def compact_coordinates(coords)
    return coords unless coords.is_a?(Array)

    if coords.all? { |c| !c.is_a?(Array) }
      coords.compact
    else
      coords.compact.map { |c| compact_coordinates(c) }
    end
  end

  # reduce all coordinates to 2, dropping elevation
  def drop_elevation(coords)
    return [] if coords.nil?

    if coords.all? { |c| !c.is_a?(Array) }
      coords[0...2].map(&:to_f)
    else
      coords.compact.map { |c| drop_elevation(c) }
    end
  end

  def require_coords
    errors.add(:geometry, "coordinates missing") unless geometry["coordinates"].present?
  end

  def broadcast_update
    ActionCable.server.broadcast("map_channel_#{map.public_id}",
      { event: "update_feature", feature: geojson.as_json })
  end

  def broadcast_destroy
    ActionCable.server.broadcast("map_channel_#{map.public_id}",
      { event: "delete_feature", feature: geojson.slice(:id).as_json })
  end

  def destroy_image_if_last_feature
    image.destroy if image && image.features.size == 1
  end
end
