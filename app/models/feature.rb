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
  index({ image_id: 1 }, background: true)

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
      (previous_changes["geometry"] || previous_changes["properties"] || previous_changes["layer_id"])
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

  # Body of the Garmin Courses API. Garmin requires distance and elevation totals, and points at
  # most 100m apart, so long segments get interpolated points.
  def to_garmin_course
    coords = geometry["coordinates"]
    points = [ garmin_point(coords.first) ]
    distance = gain = loss = 0.0
    factory = Mapforge::LineIndex::FACTORY
    coords.each_cons(2) do |a, b|
      segment = factory.point(a[0], a[1]).distance(factory.point(b[0], b[1]))
      steps = (segment / 100).ceil
      # Across the antimeridian, interpolate towards the end point shifted by 360 degrees, not the long way round
      b = [ b[0] - 360 * ((b[0] - a[0]) / 360.0).round, *b[1..] ]
      (1..steps).each do |i|
        lon, *rest = a.zip(b).map { |x, y| x && y && x + (y - x) * i.fdiv(steps) }
        points << garmin_point([ (lon + 180) % 360 - 180, *rest ])
      end
      distance += segment
      climb = a[2] && b[2] ? b[2] - a[2] : 0
      climb.positive? ? gain += climb : loss -= climb
    end
    { courseName: properties["title"].presence || "Mapforge track", description: properties["desc"].presence,
      distance:, elevationGain: gain, elevationLoss: loss, geoPoints: points,
      activityType: properties.dig("route", "profile") == "bike" ? "ROAD_CYCLING" : "HIKING",
      coordinateSystem: "WGS84" }.compact
  end

  # expects EPSG:4326 (WGS 84), the GeoJSON default
  def self.from_collection(geojson)
    (geojson["features"] || [ geojson ]).filter_map do |feature|
      Feature.create!(feature.slice("type", "geometry", "properties")) if feature["geometry"]
    end
  end

  def coordinates(include_height: true)
    include_height ? geometry["coordinates"] : drop_elevation(geometry["coordinates"] || [])
  end

  private

  def garmin_point((lon, lat, ele))
    { latitude: lat, longitude: lon, elevation: ele }.compact
  end

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
      { event: "update_feature", feature: geojson.as_json, layer_id: layer_id.to_s,
        map_updated_at: map.updated_at })
  end

  def broadcast_destroy
    ActionCable.server.broadcast("map_channel_#{map.public_id}",
      { event: "delete_feature", feature: geojson.slice(:id).as_json, map_updated_at: map.updated_at })
  end

  def destroy_image_if_last_feature
    image.destroy if image && image.features.size == 1
  end
end
