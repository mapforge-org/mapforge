class Tag
  include Mongoid::Document

  field :key, type: String
  field :name, type: String, localize: true
  field :description, type: String, localize: true

  index({ key: 1 }, unique: true, background: true)

  scope :named, ->(term) {
    regex = /\A#{Regexp.escape(term)}\z/i
    any_of({ key: regex }, *FastGettext.default_available_locales.map { |locale| { "name.#{locale}" => regex } })
  }

  def self.for(key)
    find_or_create_by!(key: key)
  end

  # An upsert per tag, so a second run updates the tags and creates no duplicates
  def self.seed_standard
    YAML.load_file(Rails.root.join("db/seeds/tags.yml")).each do |key, values|
      collection.update_one({ key: key }, { "$set" => values }, upsert: true)
    end
  end

  # Tag.for creates a tag outside of db/seeds/tags.yml without a name
  def to_s
    name.presence || key
  end
end
