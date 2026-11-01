require "rails_helper"

describe "Map animated line" do
  let(:map) { create(:map) }
  let(:path) { map.public_map_path }
  let(:current_user) { nil }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    sign_in(current_user) if current_user
    visit path
    expect_map_loaded
  end

  context "with an animated line from the URL" do
    let(:line) { create(:feature, :line_string) }
    let(:map) { create(:map, features: [ line ]) }
    let(:path) { "#{map.public_map_path}?a=#{line.id}" }

    it "stops the animation on Escape" do
      start = page.evaluate_script("map.getCenter().lng")
      wait_for { page.evaluate_script("map.getCenter().lng") }.not_to eq(start)
      page.driver.browser.keyboard.type(:Escape)
      center = page.evaluate_script("map.getCenter().lng")
      sleep 0.5
      expect(page.evaluate_script("map.getCenter().lng")).to eq(center)
    end

    it "lets the user zoom while the camera follows the line" do
      page.execute_script("map.zoomTo(16, { duration: 300 })")
      wait_for { page.evaluate_script("map.getZoom()") }.to be_within(0.01).of(16)
    end

    context "with a view in the URL hash" do
      let(:path) { "#{map.public_map_path}?a=#{line.id}&duration=60#14/49.472/11.049/20/30" }

      it "keeps zoom, pitch and bearing of the hash" do
        start = page.evaluate_script("map.getCenter().lng")
        wait_for { page.evaluate_script("map.getCenter().lng") }.not_to eq(start)
        expect(page.evaluate_script("map.getZoom()")).to be_within(0.01).of(14)
        expect(page.evaluate_script("map.getPitch()")).to be_within(0.01).of(30)
        expect(page.evaluate_script("map.getBearing()")).to be_within(0.01).of(20)
      end
    end

    context "with a line of several points" do
      let(:line) { create(:feature, :line_string_with_elevation) }
      let(:path) { "#{map.public_map_path}?a=#{line.id}&duration=6" }
      let(:chunk_count) do
        "Object.entries(map.getStyle().sources).filter(([, s]) => s.type === 'geojson')" \
          ".flatMap(([id]) => map.querySourceFeatures(id))" \
          ".filter(f => String(f.properties.id).includes('-chunk-')).length"
      end

      it "draws the line in chunks and drops them at the end" do
        # headless Chrome draws few updates per second, so the animation runs slower than planned
        wait(60).for { page.evaluate_script(chunk_count) }.to be > 0
        wait(60).for { page.evaluate_script(chunk_count) }.to eq(0)
      end
    end

    context "with km markers" do
      let(:line) { create(:feature, :line_string, properties: { "show-km-markers" => true }) }
      let(:path) { "#{map.public_map_path}?a=#{line.id}&duration=2" }

      def marker_kms
        page.evaluate_async_script(<<~JS)
          const done = arguments[0]
          map.getSource('km-marker-source-#{map.layers.first.id}').getData()
            .then(data => done(data.features.map(f => f.properties.km)))
        JS
      end

      # The counter rewrites its text on every update, and Cuprite then loses the node between
      # its find and its visibility check, so the spec reads the DOM directly
      it "counts the distance at the tip and hands over to the end marker" do
        counter = "document.querySelector('.km-marker-moving-end')?.textContent"
        wait_for { page.evaluate_script(counter) }.to match(/\d/)
        # headless Chrome draws few updates per second, so the animation runs slower than planned
        wait(60).for { page.evaluate_script(counter) }.to be_nil
        expect(marker_kms).to eq [ 0, 1, 2, 2.3 ]
      end
    end

    context "with the heading parameter" do
      let(:path) { "#{map.public_map_path}?a=#{line.id}&heading=1&duration=60" }

      # the factory line runs south-east, so the camera turns toward ~150°
      it "turns the map bearing toward the line direction" do
        wait_for { page.evaluate_script("map.getBearing()") }.to be > 90
      end

      it "lets the user tilt the map with a right-button drag" do
        mouse = page.driver.browser.mouse
        mouse.move(x: 400, y: 300)
        mouse.down(button: :right)
        10.times { |i| mouse.move(x: 400, y: 290 - (i * 10)) }
        mouse.up(button: :right)
        expect(page.evaluate_script("map.getPitch()")).to be > 10
      end

      it "lets the user zoom with the mouse wheel" do
        zoom = page.evaluate_script("map.getZoom()")
        5.times do
          page.execute_script(<<~JS)
            map.getCanvas().dispatchEvent(new WheelEvent('wheel',
              { deltaY: -100, deltaMode: 0, clientX: 400, clientY: 300, bubbles: true, cancelable: true }))
          JS
          sleep 0.05
        end
        wait_for { page.evaluate_script("map.getZoom()") }.to be > zoom + 0.5
      end
    end
  end
end
