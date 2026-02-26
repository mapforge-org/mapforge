require "securerandom"

class AddPublicId < Mongoid::Migration
  def self.up
    Map.where(public_id: nil).each do |map|
      map.update_attribute(:public_id, SecureRandom.hex(8))
      map.update_attribute(:private, true)
    end
  end

  def self.down
  end
end
