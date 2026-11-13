class SeedStandardTags < Mongoid::Migration
  def self.up
    Tag.seed_standard
  end
end
