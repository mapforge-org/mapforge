require "rails_helper"

describe "Map selection" do
  let(:map) { create(:map) }
  let(:path) { map.public_map_path }
  let(:current_user) { nil }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    sign_in(current_user) if current_user
    visit path
    expect_map_loaded
  end

  context "with a selected feature whose label collides" do
    let(:first) { create(:feature, :point, properties: { "label" => "first" }) }
    let(:second) { create(:feature, :point, properties: { "label" => "second" }) }
    let(:map) { create(:map, features: [ first, second ]) }
    let(:path) { map_path(id: map.public_id, f: second.id) }

    it "shows the label of the selected feature" do
      labels = <<~JS
        [...new Set(map.queryRenderedFeatures({
          layers: map.getStyle().layers.map(l => l.id).filter(id => id.startsWith('text-layer'))
        }).map(f => f.properties.label))]
      JS
      wait_for { page.evaluate_script(labels) }.to eq [ "second" ]
    end
  end

  context "with a selected shape point" do
    let(:point) { create(:feature, :point, properties: { "marker-shape" => "pin" }) }
    let(:map) { create(:map, features: [ point ]) }
    let(:path) { map_path(id: map.public_id, f: point.id) }

    it "draws the halo ring of the shape" do
      images = "map.listImages().filter(name => name.startsWith('shape-pin|transparent|transparent||'))"
      wait_for { page.evaluate_script(images).any? { |name| name.end_with?("|1") } }.to be true
    end
  end

  context "with a selected image point" do
    let(:point) { create(:feature, :point, properties: { "marker-image-url" => "/icons/hydrant.png" }) }
    let(:map) { create(:map, features: [ point ]) }
    let(:path) { map_path(id: map.public_id, f: point.id) }

    it "draws the image with a halo around its outline" do
      halo = <<~JS
        (() => {
          const image = map.getImage(map.listImages().find(name => name.startsWith('halo|')))
          return image ? [image.data.width, map.getImage('/icons/hydrant.png')?.data.width] : null
        })()
      JS
      # the halo adds its width on both sides
      wait_for { page.evaluate_script(halo)&.then { |halo_width, width| width && halo_width > width } }.to be true
    end
  end

  context "with a selected feature outside its zoom range" do
    let(:point) { create(:feature, :point, properties: { "label" => "close up", "min-zoom" => 22 }) }
    let(:map) { create(:map, features: [ point ]) }
    let(:path) { map_path(id: map.public_id, f: point.id) }

    it "shows the feature" do
      ids = "[...new Set(map.queryRenderedFeatures().map(f => f.properties.id))]"
      wait_for { page.evaluate_script(ids) }.to include(point.id.to_s)
    end
  end


  context "with a hovered point" do
    let(:point) { create(:feature, :point, coordinates: [ 11.0557, 49.4732 ]) }
    let(:map) { create(:map, features: [ point ], center: [ 11.0557, 49.4732 ], zoom: 16) }

    # the front copy shows the point through feature-state, which queryRenderedFeatures does not see
    it "draws the point in a front layer on top of all labels while it is hovered" do
      ids = page.evaluate_script("map.getStyle().layers.map(l => l.id)")
      expect(ids.index { |id| id.start_with?("points-layer-front_") })
        .to be > ids.rindex { |id| id.start_with?("text-layer") }

      state = "map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id: '#{point.id}' })"
      xy = viewport_xy_for_lat_lng(49.4732, 11.0557)
      page.driver.browser.mouse.move(x: xy[:x], y: xy[:y])
      wait_for { page.evaluate_script(state) }.to eq("hover" => true)

      page.driver.browser.mouse.move(x: xy[:x] + 300, y: xy[:y])
      wait_for { page.evaluate_script(state) }.to eq("hover" => false)
    end
  end

  context "with a hovered point that overlaps a point above it" do
    let(:below) { create(:feature, :point, coordinates: [ 11.0557, 49.4732 ], properties: { "marker-size" => 40 }) }
    let(:above) { create(:feature, :point, coordinates: [ 11.0563, 49.4732 ], properties: { "marker-size" => 40 }) }
    let(:map) { create(:map, features: [ below, above ], center: [ 11.056, 49.4732 ], zoom: 16) }

    # the hovered point is drawn in front, so it stays hovered until the pointer leaves it
    it "keeps the hover on the point until the pointer leaves it" do
      hovered = <<~JS
        [#{below.id.to_s.to_json}, #{above.id.to_s.to_json}].filter(id =>
          map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id }).hover)
      JS
      below_xy = viewport_xy_for_lat_lng(49.4732, 11.0557)
      above_xy = viewport_xy_for_lat_lng(49.4732, 11.0563)
      mouse = page.driver.browser.mouse

      mouse.move(x: below_xy[:x] - 20, y: below_xy[:y])
      wait_for { page.evaluate_script(hovered) }.to eq [ below.id.to_s ]
      mouse.move(x: (below_xy[:x] + above_xy[:x]) / 2, y: below_xy[:y])
      sleep 0.3
      expect(page.evaluate_script(hovered)).to eq [ below.id.to_s ]
      mouse.move(x: above_xy[:x] + 20, y: above_xy[:y])
      wait_for { page.evaluate_script(hovered) }.to eq [ above.id.to_s ]
    end
  end

  context "with route extras" do
    let(:route) {
      create(:feature, :line_string_with_route_extras).tap { |feature|
        feature.update!(properties: feature.properties.merge("show-route-extras" => "steepness", "min-zoom" => min_zoom))
      }
    }
    let(:map) { create(:map, features: [ route ]) }

    def segments
      "map.queryRenderedFeatures({ layers: map.getStyle().layers.map(l => l.id)" \
        ".filter(id => id.startsWith('line-layer_route-extras-source')) }).length"
    end

    def source_count(filter)
      page.evaluate_async_script(<<~JS)
        const done = arguments[0]
        map.getSource('route-extras-source-#{map.layers.first.id}').getData()
          .then(data => done(data.features.filter(#{filter}).length))
      JS
    end

    context "inside their zoom range" do
      let(:min_zoom) { 0 }

      it "renders them" do
        wait_for { page.evaluate_script(segments) }.to be > 0
      end
    end

    context "outside their zoom range" do
      let(:min_zoom) { 22 }

      # the segments have no id, which must not count as the empty selection
      it "does not render them" do
        wait_for_map_rendered
        expect(page.evaluate_script(segments)).to eq 0
      end
    end

    context "with a tunnel" do
      let(:min_zoom) { 0 }
      let(:route) {
        create(:feature, :line_string_with_route_extras).tap { |feature|
          route = feature.properties["route"]
          route["extras"]["off_terrain"] = { "values" => [ [ 2, 4, -1 ] ] }
          feature.update!(properties: feature.properties.merge("route" => route, "show-route-extras" => "steepness",
            "fill-extrusion-height" => 20))
        }
      }

      def wall_count
        source_count("f => f.geometry.type === 'MultiPolygon'")
      end

      def tunnel_labels
        "map.queryRenderedFeatures({ layers: ['route-extras-labels_route-extras-source-#{map.layers.first.id}'] })" \
          ".filter(f => f.properties['route-extras-icon'] === 'tunnel').length"
      end

      def tunnel_icon_width
        "map.getImage('inline-icon|/icon-sets/pinhead/tunnel.png')?.data.width"
      end

      it "draws no wall for the tunnel segment" do
        wait_for { wall_count }.to eq 2
      end

      it "dashes the line of the tunnel segment black" do
        dashed = "f => f.geometry.type === 'LineString' && f.properties['stroke-dasharray'] === true " \
          "&& f.properties.stroke === '#000000'"
        wait_for { source_count(dashed) }.to eq 1
      end

      it "labels the tunnel with its icon" do
        wait_for { page.evaluate_script(tunnel_labels) }.to eq 1
        wait_for { page.evaluate_script(tunnel_icon_width) }.to be > 1
      end
    end

    context "with a tunnel on a dashed route without route extras coloring" do
      let(:route) {
        create(:feature, :line_string_with_route_extras).tap { |feature|
          route = feature.properties["route"]
          route["extras"]["off_terrain"] = { "values" => [ [ 2, 4, -1 ] ] }
          feature.update!(properties: feature.properties.except("show-route-extras")
            .merge("route" => route, "stroke" => "#ff0000", "stroke-dasharray" => true))
        }
      }

      it "puts black dashes on the route color in the tunnel" do
        wait_for { source_count("f => f.properties.stroke === '#000000'") }.to eq 1
        expect(source_count("f => f.properties.stroke === '#ff0000' && !f.properties['stroke-dasharray']")).to eq 1
      end
    end
  end
end
