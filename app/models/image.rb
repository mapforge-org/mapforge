# Create image with: Image.create(img: File.new(Rails.root.join(...)), img_uid: '...')
class Image
  include ActiveModel::Model
  include Mongoid::Document
  include Mongoid::Timestamps
  extend Dragonfly::Model

  # access with `img.url` (like /media/123..)
  # round icon: `thumb('150x').crop_quadrant.rounded.url´
  dragonfly_accessor :img

  belongs_to :user, optional: true, counter_cache: true
  # belongs_to :map, optional: true, counter_cache: true
  has_many :features, dependent: :nullify

  field :img_uid, type: String
  field :public_id, type: String

  validates_size_of :img, maximum: 4096.kilobytes
  validate :public_id_must_be_unique_or_nil
  before_create :create_public_id

  # Resize (if larger than 1024px) and re-encode the image at `path` to lossy
  # WebP, in place. Always re-encodes (PNG is lossless, so `quality` alone would
  # not shrink it) so the stored size stays small regardless of the source format.
  # Shared by ImagesController#upload and the migrations:dragonfly_to_webp task.
  def self.compress_to_webp!(path)
    # https://github.com/mtgrosser/rszr
    image = Rszr::Image.load(path)
    image.resize!(1024, 1024, crop: false) if image.width > 1024 || image.height > 1024
    image.save(path, format: "webp", quality: 75)
  end

  def create_public_id
    self.public_id = SecureRandom.hex(4) unless public_id.present?
  end

  def public_id_must_be_unique_or_nil
    if public_id.present? && Image.where(public_id: public_id).where.not(id: id).exists?
      errors.add(:public_id, "has already been taken")
    end
  end
end
