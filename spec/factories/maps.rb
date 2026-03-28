FactoryBot.define do
  factory :map do
    base_map { "test" }
    center { Map::DEFAULT_CENTER }
    zoom { 12 }
    pitch { 0 }

    transient do
      features { nil }
      owner { nil }
    end

    after :create do |map, evaluator|
      map.layers.first.update(features: evaluator.features)

      # Add owner if provided
      if evaluator.owner
        map.add_owner(evaluator.owner)
      end
    end
  end
end
