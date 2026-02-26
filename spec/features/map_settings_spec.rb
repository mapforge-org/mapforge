require "rails_helper"

describe "Map" do
  subject(:map) { create(:map, name: "Settings Test", center: nil, zoom: nil) }

  context "in rw mode" do
    before do
      stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
      visit map.private_map_path
      expect_map_loaded
    end

    it "shows map settings button" do
      expect(page).to have_css("#maplibre-map")
      expect(page).to have_css(".maplibregl-ctrl-map")
    end

    context "when using map settings modal" do
      it "basemap update gets saved" do
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("Configure Map")
        find(".layer-preview[data-base-map='test2']").click
        expect(page).to have_css('.layer-preview.active[data-base-map="test2"]')
        wait_for { map.reload.base_map }.to eq "test2"
      end

      it "terrain update gets saved" do
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("Configure Map")
        find("#map-terrain").click
        wait_for { map.reload.terrain }.to be(true)
      end

      it "globe update gets saved" do
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("Configure Map")
        find("#map-globe").click
        wait_for { map.reload.globe }.to be(true)
      end

      it "description update gets saved" do
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("Configure Map")
        expect(page).to have_css("#map-description.hidden", visible: :all)
        click_button "Add description"
        expect(page).to have_css("#map-description:not(.hidden)", visible: :all)
        text_area = find(:css, "#map-description .CodeMirror textarea", visible: false)
        text_area.set("Scenic gravel rides")
        wait_for { map.reload.description }.to eq("Scenic gravel rides")
        find(".modal-close-button").click
        find(".maplibregl-ctrl-map").click
        expect(page).to have_css("#map-description:not(.hidden)", visible: :all)
        expect(find(:css, "#map-description .CodeMirror", visible: false).text).to eq("Scenic gravel rides")
      end
    end

    context "when map settings change server side" do
      it "name update" do
        map.update(name: "New World")
        expect(page).to have_text("New World")
      end

      it "basemap update" do
        map.update(base_map: "test2")
        expect(page).to have_text(/Loaded base map test2|Map properties updated|Map view updated/)
        find(".maplibregl-ctrl-map").click
        expect(page).to have_css('.layer-preview[data-base-map="test2"].active')
      end

      it "terrain update" do
        map.update(terrain: true)
        expect(page).to have_text(/Loaded base map test|Map properties updated|Terrain added to map|Map view updated/)
        find(".maplibregl-ctrl-map").click
        expect(find("#map-terrain")).to be_checked
      end

      it "map center update" do
        map.update(center: [ 11, 49.5 ])
        expect(page).to have_text("Map view updated")
        expect(page.evaluate_script("[map.getCenter().lng, map.getCenter().lat].toString()")).to eq("11,49.5")
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("Map default: 11,49.5")
      end

      # TODO: Add with client side centering
      # it 'client follows default center update if map did not move' do
      #   feature = create(:feature, :point, layer: map.layers.first, coordinates: [ 11.543, 49.123 ])
      #   expect(page).to have_text('Map view updated')
      #   # new default center are the feature coordinates
      #   expect(page.evaluate_script("[map.getCenter().lng.toFixed(3), map.getCenter().lat.toFixed(3)].toString()"))
      #     .to eq(feature.coordinates.join(','))
      #   find('.maplibregl-ctrl-map').click
      #   expect(page).to have_text("center: #{feature.coordinates.join(',')} (auto)")
      # end

      it "map zoom update" do
        map.update(zoom: 16)
        wait_for { page.evaluate_script("map.getZoom()") }.to eq(16)
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("16")
      end

      it "map pitch update" do
        map.update(pitch: 33)
        wait_for { page.evaluate_script("map.getPitch()") }.to eq(33)
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("33")
      end

      it "map orientation update" do
        map.update(bearing: 33)
        wait_for { page.evaluate_script("map.getBearing()") }.to eq(33)
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("33")
      end
    end
  end

  context "in ro mode" do
    before do
      stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
      visit map.public_map_path
      expect_map_loaded
    end

    it "shows map settings button" do
      expect(page).to have_css("#maplibre-map")
      expect(page).to have_css(".maplibregl-ctrl-map")
    end

    context "when using map settings modal" do
      it "can change basemap locally" do
        find(".maplibregl-ctrl-map").click
        expect(page).to have_text("Configure Map")
        find(".layer-preview[data-base-map='test2']").click
        expect(page).to have_css('.layer-preview.active[data-base-map="test2"]')
      end
    end
  end
end
