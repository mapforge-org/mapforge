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


  context "with a hovered feature whose label collides" do
    let(:first) { create(:feature, :point, coordinates: [ 11.0557, 49.4732 ], properties: { "label" => "first label" }) }
    let(:second) { create(:feature, :point, coordinates: [ 11.0559, 49.4732 ], properties: { "label" => "second label" }) }
    let(:map) { create(:map, features: [ first, second ], center: [ 11.0558, 49.4732 ], zoom: 16) }

    it "shows the label of the hovered feature" do
      labels = <<~JS
        [...new Set(map.queryRenderedFeatures({
          layers: map.getStyle().layers.map(l => l.id).filter(id => id.startsWith('text-layer'))
        }).map(f => f.properties.label))]
      JS
      wait_for { page.evaluate_script(labels) }.to eq [ "first label" ]
      xy = viewport_xy_for_lat_lng(49.4732, 11.0559)
      page.driver.browser.mouse.move(x: xy[:x], y: xy[:y])
      wait_for { page.evaluate_script(labels) }.to eq [ "second label" ]
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
  end
end
