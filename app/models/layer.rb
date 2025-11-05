class Layer
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps

  belongs_to :map, optional: true, touch: true
  has_many :features, dependent: :destroy

  scope :geojson, -> { where(type: "geojson") }
  scope :overpass, -> { where(type: "overpass") }

  field :type
  field :name
  field :query
  field :features_count, type: Integer, default: 0

  after_save :broadcast_update, if: -> { map.present? }
  after_destroy :broadcast_destroy, if: -> { map.present? }

  def to_summary_json
    json = { id: id, type: type, name: name }
    json[:query] = query if type == "overpass"
    json
  end

  def to_json
    json = to_summary_json
    json[:geojson] = to_geojson
    json
  end

  def to_geojson
    { type: "FeatureCollection",
      features: features.map(&:geojson) }
  end

  def clone_with_features
    clone = self.dup
    clone.update(created_at: DateTime.now, map: nil)
    features.each { |f| clone.features << f.dup }
    clone
  end

  def broadcast_update
    if saved_change_to_name? || saved_change_to_query?
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
