FactoryBot.define do
  factory :feature do
    type { "Feature" }
    geometry { {} }
    properties { {} }
    association :layer

    transient do
      coordinates { nil }
      title { nil }
      desc { nil }
    end

    after :build do |feature, evaluator|
      raise "Specify feature type trait" if feature.geometry.empty?
      feature.geometry["coordinates"] = evaluator.coordinates if evaluator.coordinates
      feature.properties["title"] = evaluator.title if evaluator.title
      feature.properties["desc"] = evaluator.desc if evaluator.desc
    end

    # the following traits are visible in the default view of the map (in nbg)
    trait :point do
      geometry do
        { "type" => "Point",
         "coordinates" => [ 11.055713800000035, 49.47319830000001 ] }
      end
    end

    trait :point_middle do
      geometry do
        { "type" => "Point",
         "coordinates" => [ 11.085353409646018, 49.440728444532255 ] }
      end
      properties do
        { "marker-size" => "150" }
      end
    end

    trait :point_with_elevation do
      geometry do
        { "type" => "Point",
         "coordinates" => [ 11.0557138, 49.4731983, 333 ] }
      end
    end

    # this polygon is in the middle of nbg (default view)
    trait :polygon_middle do
      geometry do
        { "type" => "Polygon",
         "coordinates" =>
          [ [ [ 11.0406078, 49.4665013 ],
            [ 11.0402645, 49.4285336 ],
            [ 11.130215, 49.4283102 ],
            [ 11.130215, 49.4669478 ],
            [ 11.0406078, 49.4665013 ] ] ] }
      end
    end

    trait :line_string do
      geometry do
        { "type" => "LineString",
         "coordinates" =>
        [ [ 11.0416378, 49.4812338 ], [ 11.056744, 49.4631524 ] ] }
      end
    end

    trait :line_string_with_elevation do
      geometry do
        { "type" => "LineString",
         "coordinates" =>
        [ [ 11.06, 49.46, 300 ], [ 11.07, 49.455, 320 ], [ 11.08, 49.45, 350 ],
          [ 11.085, 49.445, 340 ], [ 11.09, 49.44, 310 ], [ 11.095, 49.435, 290 ] ] }
      end
      properties do
        { "stroke-width" => 150 }
      end
    end

    trait :line_string_with_route_extras do
      line_string_with_elevation
      properties do
        { "stroke-width" => 150,
          "route" => {
            "extras" => {
              "steepness" => { "values" => [ [ 0, 2, 1 ], [ 2, 4, 3 ], [ 4, 5, -2 ] ] },
              "surface" => { "values" => [ [ 0, 3, 3 ], [ 3, 5, 10 ] ] },
              "green" => { "values" => [ [ 0, 3, 2 ], [ 3, 5, 7 ] ] },
              "noise" => { "values" => [ [ 0, 5, 4 ] ] }
            }
          } }
      end
    end
  end
end
