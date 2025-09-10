class User
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps

  has_many :maps

  scope :admin, -> { where(admin: true) }
  scope :github, -> { where(provider: "github") }
  scope :google, -> { where(provider: "google_oauth2") }
  scope :with_maps, -> { where(:maps_count.gt => 0) }
  scope :with_images, -> { where(:images_count.gt => 0) }

  field :uid
  field :provider
  field :name
  field :email
  field :image
  field :admin
  field :maps_count, type: Integer, default: 0
  field :images_count, type: Integer, default: 0
  field :recent_map_ids, type: Array, default: []

  # Track a map view and maintain a limited history of recently viewed maps
  # The list can stotr private as well as public map ids
  # @param map [Map] the map being viewed
  # @param max_history [Integer] the maximum number of maps to keep in history
  def track_map_view(id, max_history: 4)
    # Remove the map if it's already in the list
    # byebug
    self.recent_map_ids.delete(id.to_s)
    # Add the map ID to the beginning of the list
    self.recent_map_ids.unshift(id.to_s)
    # Limit the list size
    self.recent_map_ids = self.recent_map_ids.first(max_history)
    save
  end
end
