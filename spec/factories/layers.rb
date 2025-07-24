FactoryBot.define do
  factory :layer do
    type { 'geojson' }

    trait :with_features do
      features { [ FactoryBot.create(:feature, :line_string),
        FactoryBot.create(:feature, :point) ] }
    end

    trait :overpass do
      type { 'overpass' }
      query { 'nwr[highway=bus_stop];out skel;' }
    end
  end
end
