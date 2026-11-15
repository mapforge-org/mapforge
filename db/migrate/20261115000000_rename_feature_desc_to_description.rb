class RenameFeatureDescToDescription < Mongoid::Migration
  def self.up
    # A feature with both keys keeps both, like the alias in Feature#apply_simplestyle.
    Feature.collection.update_many({ "properties.desc" => { "$exists" => true },
                                     "properties.description" => { "$exists" => false } },
                                   { "$rename" => { "properties.desc" => "properties.description" } })
  end
end
