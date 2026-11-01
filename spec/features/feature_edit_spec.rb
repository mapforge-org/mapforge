require "rails_helper"

describe "Feature edit" do
  include_context "with an editable map and an elevation stub"

  context "with empty map" do
    context "when adding features" do
      it "adding a point to the map" do
        find(".mapbox-gl-draw_point").click
        click_coord("#maplibre-map", 50, 50)
        wait_for { Feature.point.count }.to eq(1)
      end

      it "adding a line to the map" do
        find(".line-menu-btn").click
        find(".ctrl-line-menu .mapbox-gl-draw_line").click
        click_coord("#maplibre-map", 250, 250)
        click_coord("#maplibre-map", 350, 350)
        click_coord("#maplibre-map", 450, 450)
        click_coord("#maplibre-map", 450, 450)

        # need to wait until feature is saved server side
        wait_for { Feature.line_string.count }.to eq(1)
      end

      it "shows the freehand line while it is painted" do
        find(".line-menu-btn").click
        find(".ctrl-line-menu .mapbox-gl-draw_paint").click

        mouse = page.driver.browser.mouse
        mouse.move(x: 250, y: 250)
        mouse.down
        mouse.move(x: 350, y: 300, steps: 5)
        mouse.move(x: 450, y: 400, steps: 5)
        painted = page.evaluate_script(
          "window.map.queryRenderedFeatures({ layers: " \
          "['gl-draw-line-active.hot', 'gl-draw-line-paint.hot'] })" \
          ".map(f => f.layer.id)")
        mouse.up

        expect(painted).to include("gl-draw-line-active.hot", "gl-draw-line-paint.hot")
        wait_for { Feature.line_string.count }.to eq(1)
      end

      it "adding a polygon to the map" do
        find(".mapbox-gl-draw_polygon").click

        click_coord("#maplibre-map", 10, 10)
        click_coord("#maplibre-map", 10, 50)
        click_coord("#maplibre-map", 50, 50)
        click_coord("#maplibre-map", 50, 10)
        click_coord("#maplibre-map", 10, 10)

        # need to wait until feature is saved server side
        wait_for { Feature.polygon.count }.to eq(1)
      end

      # A stored center always comes from the owner, so the first feature must not clear it
      it "keeps the map center when adding the first feature" do
        expect(map.center).to eq(Map::DEFAULT_CENTER)
        find(".mapbox-gl-draw_point").click
        click_coord("#maplibre-map", 50, 50)
        wait_for { Feature.point.count }.to eq(1)
        expect(map.reload.center).to eq(Map::DEFAULT_CENTER)
      end
    end
  end

  context "with existing feature on map" do
    let!(:existing_point) { create(:feature, :point_middle) }
    let(:map) { create(:map, features: [ existing_point ], center: [ 11.0, 49.0 ]) }

    it "preserves the map center when adding subsequent features" do
      find(".mapbox-gl-draw_point").click
      click_coord("#maplibre-map", 80, 80)
      wait_for { Feature.point.count }.to eq(2)
      expect(map.reload.center).to eq([ 11.0, 49.0 ])
    end
  end
end
