class AddPrivateMapIds < Mongoid::Migration
  def self.up
    Map.find_each { |m| m.update(private_id: m.id.to_s) }
  end

  def self.down
  end
end
