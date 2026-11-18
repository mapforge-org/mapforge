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

  # the properties of the features that layers with ids matching the pattern render
  def rendered_properties(layer_pattern)
    page.evaluate_script("map.queryRenderedFeatures({ layers: map.getStyle().layers.map(l => l.id)" \
                         ".filter(id => #{layer_pattern.inspect}.test(id)) }).map(f => f.properties)")
  end

  def hover_state_of(feature)
    page.evaluate_script("map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', id: '#{feature.id}' })")
  end

  context "with a selected feature whose label collides" do
    let(:first) { create(:feature, :point, properties: { "label" => "first" }) }
    let(:second) { create(:feature, :point, properties: { "label" => "second" }) }
    let(:map) { create(:map, features: [ first, second ]) }
    let(:path) { map_path(id: map.public_id, f: second.id) }

    it "shows the label of the selected feature" do
      wait_for { rendered_properties(/^text-layer(-flat)?_/).map { it["label"] }.uniq }.to eq [ "second" ]
    end
  end

  context "with a selected shape point" do
    let(:point) { create(:feature, :point, properties: { "marker-shape" => "pin" }) }
    let(:map) { create(:map, features: [ point ]) }
    let(:path) { map_path(id: map.public_id, f: point.id) }

    it "draws the selection ring and the wider hover ring of the shape" do
      images = "map.listImages().filter(name => name.startsWith('shape-pin|transparent|border||'))" \
               ".map(name => name.split('|').pop()).sort()"
      wait_for { page.evaluate_script(images) }.to eq %w[2 3]
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

  context "with image points" do
    let(:image) { { "marker-image-url" => "/icons/hydrant.png", "marker-size" => 20 } }
    let(:points) do
      { below_icon: point(11.0557, 49.4732, image), icon: point(11.0557, 49.4732, "marker-symbol" => "🚂"),
        below_label: point(11.0545, 49.4732, image), label: point(11.0545, 49.4735, "label" => "Hauptbahnhof"),
        free: point(11.0569, 49.4732, image) }
    end
    let(:map) { create(:map, features: points.values, center: [ 11.0557, 49.4732 ], zoom: 16) }

    def point(lng, lat, properties)
      create(:feature, :point, coordinates: [ lng, lat ], properties:)
    end

    def covered?(name)
      page.evaluate_script("map.getFeatureState({ source: 'geojson-source-#{map.layers.first.id}', " \
        "id: '#{points[name].id}' }).covered === true")
    end

    it "marks the images below an icon or a label as covered, and no other image" do
      wait_for { covered?(:below_icon) }.to be true
      wait_for { covered?(:below_label) }.to be true
      expect(covered?(:free)).to be false
    end
  end

  context "with labeled points that partly cover each other" do
    # the second point sits about 8px to the right of the first, so it does not cover its center
    let(:points) do
      [ point(11.0557, 49.4732, "first"), point(11.05586, 49.4732, "second"), point(11.0575, 49.4732, "free") ]
    end
    let(:map) { create(:map, features: points, center: [ 11.0557, 49.4732 ], zoom: 16) }

    def point(lng, lat, label)
      create(:feature, :point, coordinates: [ lng, lat ], properties: { "label" => label })
    end

    def rendered_labels
      rendered_properties(/^text-layer(-flat)?_/).map { it["label"] }.uniq.sort
    end

    def covered_labels
      ids = page.evaluate_script("map.getGlobalState().coveredLabels").to_s
      points.select { |p| ids.include?("|#{p.id}|") }.map { |p| p.properties["label"] }
    end

    it "hides the label of the point below, and its place goes to the label of the point above" do
      wait_for { covered_labels.size }.to eq 1
      expect(covered_labels).not_to include "free"
      wait_for { rendered_labels }.to eq (%w[first second free] - covered_labels).sort
    end

    context "among more than 200 points in view" do
      let(:points) do
        # below the labeled points, which stay among the 200 top-most
        201.times.map { |i| create(:feature, :point, coordinates: [ 11.0527 + i * 0.00003, 49.4735 ]) } + super()
      end

      it "hides no label" do
        wait_for { rendered_properties(/^points-layer_/).size }.to be > 200
        # a move runs hideCoveredLabels on moveend, this 'idle' handler runs after it
        script = "const done = arguments[arguments.length - 1]; map.once('idle', () => " \
                 "done(map.getGlobalState().coveredLabels ?? '')); map.panBy([ 1, 0 ], { duration: 0 })"
        expect(page.evaluate_async_script(script)).to eq ""
      end
    end
  end

  context "with centered labels on points that cover each other" do
    # an offset of [0, 0] keeps the label on the point
    let(:points) do
      [ { "title" => "One" }, { "label-offset" => [ 0, 0 ] } ].each_with_index.map do |offset, i|
        create(:feature, :point, coordinates: [ 11.0557 + i * 0.00002, 49.4732 ],
                                 properties: { "label" => (i + 1).to_s, "label-anchor" => "center", **offset })
      end
    end
    let(:map) { create(:map, features: points, center: [ 11.0557, 49.4732 ], zoom: 16) }

    it "draws each label into the image of its point, and not in the label layer" do
      # the parts after the 6 of a shape are the label, the halo ring has none
      images = "map.listImages().filter(name => name.startsWith('shape-')).map(name => name.split('|'))" \
               ".filter(parts => parts.length > 6).map(parts => parts.pop()).sort()"
      wait_for { page.evaluate_script(images) }.to eq %w[1 2]
      expect(rendered_properties(/^text-layer(-flat|-front)?_/)).to be_empty
      expect(page.evaluate_script("map.getGlobalState().coveredLabels").to_s).to eq ""

      # the prune keeps the images by these names
      names = page.evaluate_async_script(<<~JS)
        import('maplibre/styles/circle_image')
          .then(m => arguments[0](#{points.map(&:properties).to_json}.map(p => m.shapeImageName(p))))
      JS
      expect(page.evaluate_script("map.listImages()")).to include(*names)
    end

    # the label-* properties style the label in the image, not the title
    it "places a title that differs from the label in a front layer for the default label look" do
      wait_for { rendered_properties(/^text-layer-title-front_/).map { it["title"] } }.to eq [ "One" ]
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
    it "draws the point in a front layer above all points and labels, below its own label, while it is hovered" do
      ids = page.evaluate_script("map.getStyle().layers.map(l => l.id)")
      front = ids.index { |id| id.start_with?("points-layer-front_") }
      expect(front).to be > ids.rindex { |id| id.start_with?("points-layer_") }
      expect(front).to be > ids.rindex { |id| id.start_with?("text-layer_") }
      expect(front).to be < ids.index { |id| id.start_with?("text-layer-front_") }

      xy = viewport_xy_for_lat_lng(49.4732, 11.0557)
      hover_coord(xy[:x], xy[:y])
      wait_for { hover_state_of(point) }.to eq("hover" => true)

      hover_coord(xy[:x] + 300, xy[:y])
      wait_for { hover_state_of(point) }.to eq("hover" => false)
    end
  end

  context "with a hovered point that has a title and no label" do
    let(:point) { create(:feature, :point, coordinates: [ 11.0557, 49.4732 ], properties: { "title" => "Glenn" }) }
    let(:map) { create(:map, features: [ point ], center: [ 11.0557, 49.4732 ], zoom: 16) }

    let(:xy) { viewport_xy_for_lat_lng(49.4732, 11.0557) }

    def hover_state(dy = 0)
      hover_coord(xy[:x], xy[:y] + dy)
      sleep 0.5
      hover_state_of(point)
    end

    # the front copy places the title of every point, feature-state shows the hovered one
    it "places the title as a map label, and shows no card" do
      wait_for { rendered_properties(/^text-layer-front_/).map { it["title"] } }.to eq [ "Glenn" ]
      expect(hover_state).to eq("hover" => true)
      expect(page).to have_no_css(".feature-hover-info")
    end

    it "takes the hover from the shown title only" do
      expect(hover_state(30)).to eq({})
      expect(hover_state).to eq("hover" => true)
      expect(hover_state(30)).to eq("hover" => true)
    end

    context "when the point is selected" do
      let(:path) { map_path(id: map.public_id, f: point.id) }

      # the title shows on hover only, the details modal shows it for the selected point
      it "hides the title and takes no hover from its place" do
        expect(page).to have_css("#feature-details-modal.show")
        expect(hover_state(30)).not_to include("hover" => true)
      end
    end
  end

  context "with a newly drawn point" do
    let(:map) { create(:map, center: [ 11.0557, 49.4732 ], zoom: 16) }
    let(:path) { map.private_map_path }

    it "shows its title on hover" do
      xy = viewport_xy_for_lat_lng(49.4732, 11.0557)
      find(".mapbox-gl-draw_point").click
      click_coord("#maplibre-map", xy[:x], xy[:y])
      wait_for { Feature.point.count }.to eq(1)
      fill_in "feature-title", with: "Glenn"
      wait_for { Feature.point.first.properties["title"] }.to eq("Glenn")
      find("#feature-details-modal .modal-close-button").click

      hover_coord(xy[:x] + 200, xy[:y] + 200)
      hover_coord(xy[:x], xy[:y])
      wait_for { hover_state_of(Feature.point.first) }.to include("hover" => true)
      wait_for { rendered_properties(/^text-layer-front_/).map { it["title"] } }.to eq [ "Glenn" ]
    end
  end

  context "with a point below the label of another point" do
    # at zoom 18 the label sits about 30px below its point, that is 0.00005° of latitude
    let(:labeled) { create(:feature, :point, coordinates: [ 11.0557, 49.4732 ], properties: { "label" => "Above" }) }
    let(:below) { create(:feature, :point, coordinates: [ 11.0557, 49.4732 - 0.00005 ]) }
    let(:map) { create(:map, features: [ labeled, below ], center: [ 11.0557, 49.4732 ], zoom: 18) }

    it "gives the hover to the point and not to the label" do
      xy = viewport_xy_for_lat_lng(49.4732 - 0.00005, 11.0557)
      hover_coord(xy[:x], xy[:y])
      wait_for { hover_state_of(below) }.to eq("hover" => true)
    end
  end

  context "with a scaled shape" do
    # at zoom 16 the square has its 'marker-size' of 20px, the hit box of MapLibre is twice as big
    let(:point) do
      create(:feature, :point, coordinates: [ 11.0557, 49.4732 ],
                               properties: { "marker-shape" => "square", "marker-scaling" => true, "marker-size" => 20 })
    end
    let(:map) { create(:map, features: [ point ], center: [ 11.0557, 49.4732 ], zoom: 16) }

    it "takes the hover only on the drawn shape" do
      xy = viewport_xy_for_lat_lng(49.4732, 11.0557)
      hover_coord(xy[:x], xy[:y] + 40)
      sleep 0.5
      expect(hover_state_of(point)).to eq({})
      hover_coord(xy[:x], xy[:y] + 15)
      wait_for { hover_state_of(point) }.to eq("hover" => true)
    end
  end

  context "with a polygon, a line and a point" do
    let(:map) do
      create(:map, features: [ create(:feature, :polygon_middle), create(:feature, :line_string),
                               create(:feature, :point, properties: { "label" => "x", "title" => "y" }) ])
    end

    it "gives every style layer a place in the layer order" do
      warnings = page.evaluate_async_script(<<~JS)
        const done = arguments[0]
        const warn = console.warn
        const messages = []
        console.warn = message => messages.push(message)
        import('maplibre/map').then(m => { m.sortLayers(); console.warn = warn; done(messages) })
      JS
      expect(warnings).to eq []
    end
  end

  context "with a hovered line" do
    let(:line) {
      create(:feature, :line_string, properties: { "title" => "River walk" },
                                     coordinates: [ [ 11.0416378, 49.4812338, 300 ], [ 11.056744, 49.4631524, 350 ] ])
    }
    let(:map) { create(:map, features: [ line ], center: [ 11.0492, 49.4722 ], zoom: 13) }

    it "shows the name and the length, but no position, for a line with only elevation data" do
      xy = viewport_xy_for_lat_lng(49.4722, 11.0492)
      hover_coord(xy[:x], xy[:y])
      expect(page).to have_css(".feature-hover-info", text: /River walk\s*2\.\d+ km/)
      expect(page).to have_no_css(".feature-hover-info .hover-position")
      expect(page).to have_no_css(".hover-route-dot")
      # without a position on the track, the card follows the mouse
      expect(page).to have_css(".feature-hover-info.maplibregl-popup-track-pointer")
    end
  end

  context "with a hovered track" do
    let(:line) {
      create(:feature, :line_string, properties: { "title" => "River walk", "route" => { "profile" => "foot", "extras" => { "steepness" => { "values" => [ [ 0, 1, 3 ] ] } } } },
                                     coordinates: [ [ 11.0416378, 49.4812338, 300 ], [ 11.056744, 49.4631524, 350 ] ])
    }
    let(:map) { create(:map, features: [ line ], center: [ 11.0492, 49.4722 ], zoom: 13) }

    it "puts the card left of the cursor at the right edge of the map" do
      page.execute_script("window.map.jumpTo({ center: [ 11.02, 49.4722 ] })")
      wait_for { page.evaluate_script("window.map.loaded()") }.to be true
      xy = viewport_xy_for_lat_lng(49.4722, 11.0492)
      hover_coord(xy[:x], xy[:y])
      expect(page).to have_css(".feature-hover-info.maplibregl-popup-anchor-right")
    end

    it "runs the ring on the elevation silhouette" do
      xy = viewport_xy_for_lat_lng(49.4722, 11.0492)
      hover_coord(xy[:x], xy[:y])
      # the elevation from 300 m to 350 m, from the bottom left to the top right
      expect(page).to have_css(".feature-hover-info .hover-elevation .hover-silhouette path[d='M0 100L0.0 100.0L100.0 0.0L100.0 0.0L100 100Z']")
      # the ring runs on the top edge of the silhouette, at the same share of the length and the height
      ring = "(() => { const s = document.querySelector('.hover-elevation .hover-ring').style; return [parseFloat(s.left), parseFloat(s.top)] })()"
      left, top = page.evaluate_script(ring)
      expect(left + top).to be_within(0.5).of(100)
    end

    it "shows the name, the length and the position on the track next to the cursor" do
      xy = viewport_xy_for_lat_lng(49.4722, 11.0492)
      hover_coord(xy[:x], xy[:y])
      expect(page).to have_css(".feature-hover-info", text: /River walk\s*2\.\d+ km/)
      expect(page).to have_css(".feature-hover-info .hover-position", text: /\Akm 1\.\d\s*3\d\d m\s*\+\d\.\d %\z/)
      expect(page).to have_css(".hover-route-dot")

      # the card must let the mouse events through to the map
      under_card = <<~JS
        (() => {
          const r = document.querySelector('.feature-hover-info .maplibregl-popup-content').getBoundingClientRect()
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2).tagName
        })()
      JS
      expect(page.evaluate_script(under_card)).to eq "CANVAS"

      hover_coord(xy[:x] + 300, xy[:y] + 200)
      expect(page).to have_no_css(".feature-hover-info")
      expect(page).to have_no_css(".hover-route-dot")
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

      it "hides a badge behind a point with an icon" do
        wait_for { page.evaluate_script(tunnel_labels) }.to eq 1
        badge = page.evaluate_script("#{tunnel_labels.sub(/\.filter.*/, '')}" \
          ".find(f => f.properties['route-extras-icon'] === 'tunnel').geometry.coordinates")
        route.layer.features.create!(geometry: { "type" => "Point", "coordinates" => badge },
          properties: { "marker-symbol" => "🐍", "marker-size" => 14 })
        wait_for { page.evaluate_script(tunnel_labels) }.to eq 0
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
