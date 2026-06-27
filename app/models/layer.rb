class Layer
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps

  belongs_to :map, optional: true, touch: true
  has_many :features, dependent: :destroy

  default_scope { reorder(created_at: :asc) }
  scope :geojson, -> { where(type: "geojson") }
  scope :overpass, -> { where(type: "overpass") }
  scope :raster, -> { where(type: "raster") }

  field :type, default: "geojson"
  field :name
  field :query
  field :heatmap, type: Boolean
  field :cluster, type: Boolean
  field :show, type: Boolean, default: true
  field :features_count, type: Integer, default: 0
  field :feature_order, type: Array, default: []

  index({ map_id: 1 }, background: true)

  after_save :broadcast_update, if: -> { map.present? }
  after_destroy :broadcast_destroy, if: -> { map.present? }

  def to_summary_json
    json = { id: id, type: type, name: name, heatmap: !!heatmap, cluster: !!cluster, show: show != false }
    json[:query] = query if %w[overpass raster].include?(type)
    json[:feature_order] = feature_order
    json
  end

  def to_json
    json = to_summary_json
    json[:geojson] = to_geojson
    json
  end

  def to_geojson
    { type: "FeatureCollection",
     features: order_features(features.to_a).map(&:geojson) }
  end

  # Sort a feature list by feature_order; features missing from it keep their
  # relative order and sort after the listed ones.
  def order_features(list)
    return list if feature_order.blank?
    rank = feature_order.each_with_index.to_h
    list.sort_by { |f| [ rank[f.id.to_s] || Float::INFINITY, f.created_at ] }
  end

  def clone_with_features
    clone = dup
    clone.update(created_at: DateTime.now, map: nil)
    features.each { |f| clone.features << f.dup }
    clone
  end

  def broadcast_update
    if (%w[name query heatmap cluster show feature_order] & previous_changes.keys).any?
      # broadcast to private + public channel
      [ map.private_id, map.public_id ].each do |map_id|
        ActionCable.server.broadcast("map_channel_#{map_id}",
          { event: "update_layer", layer: to_summary_json.as_json })
      end
    end
  end

  def broadcast_destroy
    [ map.private_id, map.public_id ].each do |map_id|
      ActionCable.server.broadcast("map_channel_#{map_id}",
        { event: "delete_layer", layer: { id: id } })
    end
  end
end
