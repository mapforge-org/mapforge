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
end
