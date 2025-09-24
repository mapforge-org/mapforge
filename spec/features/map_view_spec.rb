require 'rails_helper'

describe 'Map public view' do
  let(:map) { create(:map) }
  let(:path) { map.public_map_path }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    visit path
    expect_map_loaded
  end

  context 'with initial map rendering' do
    it 'shows map view buttons' do
      expect(page).to have_css('.maplibregl-ctrl-zoom-in')
      expect(page).to have_css('.maplibregl-ctrl-zoom-out')
      expect(page).to have_css('.maplibregl-ctrl-compass')
      expect(page).to have_css('.maplibregl-ctrl-geolocate')
      expect(page).not_to have_css('.maplibregl-ctrl-edit')
    end
  end

  # features are created before loading the map, to make sure they're loaded via /features
  context 'with existing features' do
    # this polygon is in the middle of nbg (default view)
    let(:polygon) { create(:feature, :polygon_middle, title: 'Poly Title', desc: 'Poly Desc') }
    let(:map) { create(:map, features: [ polygon ]) }

    it 'shows feature details on hover' do
      # coordinates are calculated from the center middle
      hover_coord('.map', 50, 50)
      expect(page).to have_css('#feature-details-modal')
      expect(page).to have_text('Poly Title')
      expect(page).to have_text('Poly Desc')
    end

    it 'feature details are not sticky on hover' do
      hover_coord('.map', 50, 50)
      expect(page).to have_text('Poly Title')
      hover_coord('.map', 400, 0)
      expect(page).not_to have_text('Poly Desc')
    end

    it 'shows feature details on click' do
      click_coord('.map', 50, 50)
      expect(page).to have_css('#feature-details-modal')
      expect(page).to have_text('Poly Title')
      expect(page).to have_text('Poly Desc')
    end

    it 'updates url on feature select' do
      click_coord('.map', 50, 50)
      expect(page).to have_current_path("/m/#{map.public_id}?f=#{polygon.id}")
    end

    it 'feature details are sticky on click' do
      click_coord('.map', 50, 50)
      expect(page).to have_text('Poly Desc')
      hover_coord('.map', 400, 0)
      expect(page).to have_text('Poly Desc')
      click_coord('.map', 400, 0)
      expect(page).not_to have_text('Poly Desc')
    end

    it 'shows layers modal' do
      find('.maplibregl-ctrl-layers').click
      expect(page).to have_css('#layers-modal')
      expect(page).to have_text('Poly Title')
    end
  end

  context 'with feature id in url' do
    # this polygon is in the middle of nbg (default view)
    let!(:polygon) { create(:feature, :polygon_middle, layer: map.layers.first,
      properties: { title: 'F title' })}
    let(:path) { map_path(id: map.private_id, f: polygon.id) }

    it 'shows feature' do
      expect(page).to have_css('#feature-details-modal')
      expect(page).to have_text('F title')
    end
  end

  context 'with features that don\'t have properties' do
    # this polygon is in the middle of nbg (default view)
    before { create(:feature, :polygon_middle, layer: map.layers.first, properties: nil) }

    it 'shows feature details on hover' do
      hover_coord('.map', 50, 50)
      expect(page).to have_css('#feature-details-modal')
    end
  end

  context 'with features added server side' do
    # feature is created after loading the map, to make sure it's loaded via websocket
    it 'receives new features via websocket channel' do
      create(:feature, :polygon_middle, layer: map.layers.first, title: 'New Title')
      click_coord('.map', 50, 50)
      expect(page).to have_css('#feature-details-modal')
      expect(page).to have_text('New Title')
    end
  end

  context 'as map owner / admin' do
    let(:map) { create(:map, user: user) }
    let(:user) { create(:user) }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit path
    end

    it 'has link to switch to edit mode' do
      expect(page).to have_css('.maplibregl-ctrl-edit')
    end
  end

  context 'with server gone' do
    it 'shows connection error icon' do
      ActionCable.server.connections.each(&:close)
      expect(page).to have_css('div:not(.hidden):has(> button.maplibregl-ctrl-connection)')
    end
  end

  context 'with client going offline' do
    it 'shows connection error icon' do
      go_offline
      expect(page).to have_css('div:not(.hidden):has(> button.maplibregl-ctrl-connection)')
    end

    it 'catches up with new features on reconnect' do
      go_offline
      expect(page).to have_css('div:not(.hidden):has(> button.maplibregl-ctrl-connection)')
      create(:feature, :polygon_middle, layer: map.layers.geojson.first, title: 'Poly Title')
      go_online
      expect_map_loaded
      click_coord('#maplibre-map', 50, 50)
      expect(page).to have_text('Poly Title')
    end

    it 'catches up with map property changes on reconnect' do
      go_offline
      expect(page).to have_css('div:not(.hidden):has(> button.maplibregl-ctrl-connection)')
      map.update!(base_map: 'test2')
      go_online
      expect_map_loaded
      base_map = page.driver.evaluate_script("window.gon.map_properties['base_map']")
      expect(base_map).to eq 'test2'
    end
  end

  context 'with other engines' do
    it 'deck.gl' do
      visit deck_path(map.public_id)
    end
  end
end
