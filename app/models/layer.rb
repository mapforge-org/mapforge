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

  def to_summary_json
    { id: id, type: type, name: name }
  end

  def to_json
    json = { id: id, type: type, name: name }
    json[:query] = query if type == "overpass"
    json[:geojson] = to_geojson if type == "geojson"
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
end
