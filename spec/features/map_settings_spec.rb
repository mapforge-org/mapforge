require 'rails_helper'

describe 'Map' do
  subject(:map) { create(:map, center: nil, zoom: nil) }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    visit map_path(map)
    expect(page).to have_css("#maplibre-map[data-map-loaded='true']")
  end

  context 'with initial map rendering' do
    it 'shows map settings button' do
      expect(page).to have_css('#maplibre-map')
      expect(page).to have_css('.maplibregl-ctrl-map')
    end
  end

  context 'when using map settings modal' do
    before do
      visit map_path(map)
      expect(page).to have_css("#maplibre-map[data-map-loaded='true']")
    end

    it 'basemap update gets saved' do
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('Configure Map')
      find(".layer-preview[data-base-map='test2']").click
      # 'Map view updated' is rendered at 'moveend', undetermined if that's before base map is loaded
      expect(page).to have_text(/Loaded base map test2|Map view updated/, wait: 30)
      expect(map.reload.base_map).to eq 'test2'
    end

    it 'terrain update gets saved' do
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('Configure Map')
      find('#map-terrain').click
      wait_for { map.reload.terrain }.to be(true)
    end

    it 'globe update gets saved' do
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('Configure Map')
      find('#map-globe').click
      wait_for { map.reload.globe }.to be(true)
    end
  end

  context 'when map settings change server side' do
    it 'name update' do
      map.update(name: 'New World')
      expect(page).to have_text('New World')
    end

    it 'basemap update' do
      map.update(base_map: 'test2')
      # 'Map view updated' is rendered at 'moveend', undetermined if that's before base map is loaded
      expect(page).to have_text(/Loaded base map test2|Map view updated/, wait: 30)
      find('.maplibregl-ctrl-map').click
      expect(page).to have_css('.layer-preview[data-base-map="test2"].active')
    end

    it 'terrain update' do
      map.update(terrain: true)
      # 'Map view updated' is rendered at 'moveend', undetermined if that's before base map is loaded
      expect(page).to have_text(/Loaded base map test|Map view updated/)
      find('.maplibregl-ctrl-map').click
      expect(find('#map-terrain')).to be_checked
    end

    it 'map center update' do
      map.update(center: [ 11, 49.5 ])
      expect(page).to have_text('Map view updated')
      expect(page.evaluate_script("[map.getCenter().lng, map.getCenter().lat].toString()")).to eq('11,49.5')
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('center: 11,49.5')
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

    it 'map zoom update' do
      map.update(zoom: 16)
      expect(page).to have_text('Map view updated')
      expect(page.evaluate_script("map.getZoom()")).to eq(16)
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('zoom: 16')
    end

    it 'map pitch update' do
      map.update(pitch: 33)
      expect(page).to have_text('Map view updated')
      expect(page.evaluate_script("map.getPitch()")).to eq(33)
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('pitch: 33')
    end

    it 'map orientation update' do
      map.update(bearing: 33)
      expect(page).to have_text('Map view updated')
      expect(page.evaluate_script("map.getBearing()")).to eq(33)
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('bearing: 33')
    end
  end
end
