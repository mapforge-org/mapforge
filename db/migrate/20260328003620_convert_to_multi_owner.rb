class ConvertToMultiOwner < Mongoid::Migration
  def self.up
    # Maps with users: convert user_id to owner_ids array
    Map.collection.update_many(
      { user_id: { '$ne' => nil }, owner_ids: { '$exists' => false } },
      [ { '$set' => { owner_ids: [ '$user_id' ] } } ]
    )

    # Anonymous maps: set empty owner_ids array
    Map.collection.update_many(
      { user_id: nil, owner_ids: { '$exists' => false } },
      { '$set' => { owner_ids: [] } }
    )

    # Remove user_id field
    # Map.collection.update_many({}, { '$unset' => { user_id: '' } })
  end

  def self.down
    # Restore user_id from first owner
    Map.collection.update_many(
      { owner_ids: { '$ne' => [] }, user_id: { '$exists' => false } },
      [ { '$set' => { user_id: { '$first' => '$owner_ids' } } } ]
    )

    # Remove owner_ids field
    # Map.collection.update_many({}, { '$unset' => { owner_ids: '' } })
  end
end
