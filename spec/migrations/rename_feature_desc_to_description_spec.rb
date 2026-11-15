require "rails_helper"
require Rails.root.join("db/migrate/20261115000000_rename_feature_desc_to_description")

describe RenameFeatureDescToDescription do
  let(:point) { { "type" => "Point", "coordinates" => [ 11.0, 49.0 ] } }

  def raw_feature(properties)
    id = Feature.collection.insert_one(geometry: point, properties: properties).inserted_id
    -> { Feature.collection.find(_id: id).first["properties"] }
  end

  it "renames 'desc' and keeps a feature with both keys as it is" do
    only_desc = raw_feature("desc" => "a")
    both = raw_feature("desc" => "a", "description" => "b")
    described_class.up
    expect(only_desc.call).to eq("description" => "a")
    expect(both.call).to eq("desc" => "a", "description" => "b")
  end
end
