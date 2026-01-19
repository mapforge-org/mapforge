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
      hover_center_of_screen

      expect(page).to have_css('#feature-details-modal')
      expect(page).to have_text('Poly Title')
      expect(page).to have_text('Poly Desc')
    end

    it 'feature details are not sticky on hover' do
      hover_center_of_screen
      expect(page).to have_text('Poly Title')
      center = center_of_screen
      page.driver.browser.mouse.move(x: center[:x] + 400, y: center[:y])

      expect(page).not_to have_text('Poly Desc')
    end

    it 'shows feature details on click' do
      click_center_of_screen
      expect(page).to have_css('#feature-details-modal')
      expect(page).to have_text('Poly Title')
      expect(page).to have_text('Poly Desc')
    end

    it 'updates url on feature select' do
      click_center_of_screen
      expect(page).to have_current_path("/m/#{map.public_id}?f=#{polygon.id}")
    end

    it 'feature details are sticky on click' do
      click_center_of_screen
      expect(page).to have_text('Poly Desc')
      hover_coord(400, 0)
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

  context 'settings modal' do
   let(:map) { create(:map, description: 'Map Description') }

    it 'renders live updates to description' do
      find('.maplibregl-ctrl-map').click
      expect(page).to have_text('Map Description')
      map.update(description: '**New De5cr1pt1on**')
      expect(page).to have_text('New De5cr1pt1on')
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
    let(:polygon) { create(:feature, :polygon_middle, properties: nil) }
    let(:map) { create(:map, features: [ polygon ]) }


    it 'shows feature details on hover' do
      hover_center_of_screen
      expect(page).to have_css('#feature-details-modal')
    end
  end

  context 'with not clickable features' do
    let(:polygon) { create(:feature, :polygon_middle,
      properties: { title: 'Not clickable', onclick: false }) }
    let(:map) { create(:map, features: [ polygon ]) }

    it 'does not show feature details on hover' do
      hover_center_of_screen
      expect(page).not_to have_css('#feature-details-modal')
    end

    it 'does not show feature details on click' do
      click_center_of_screen
      expect(page).not_to have_css('#feature-details-modal')
    end
  end

  context 'with web link features' do
    let(:polygon) { create(:feature, :polygon_middle,
      properties: { title: 'web link', onclick: 'link', 'onclick-target': 'https://digitalflow.de' }) }
    let(:map) { create(:map, features: [ polygon ]) }

    it 'shows link target on hover' do
      hover_center_of_screen
      expect(page).to have_text('https://digitalflow.de')
    end
  end

  context 'with feature link features' do
    let(:point) { create(:feature, :point, title: 'Target point') }
    let(:polygon) { create(:feature, :polygon_middle,
      properties: { title: 'feature link', onclick: 'feature', 'onclick-target': point.id }) }
    let(:map) { create(:map, features: [ polygon, point ]) }

    it 'shows target feature on hover' do
      hover_center_of_screen
      expect(page).to have_text(point.id)
    end

    it 'flies to target feature on click' do
      click_center_of_screen
      # animation is finished when feature details are shown
      expect(page).to have_text('Target point')
      expect(page.evaluate_script("[map.getCenter().lng.toFixed(4), map.getCenter().lat.toFixed(4)].toString()"))
        .to eq("11.0557,49.4732")
      expect(page).to have_current_path("/m/#{map.public_id}?f=#{point.id}")
    end
  end

  context 'with features added server side' do
    # feature is created after loading the map, to make sure it's loaded via websocket
    it 'receives new features via websocket channel' do
      create(:feature, :polygon_middle, layer: map.layers.first, title: 'New Title')
      sleep 1
      click_center_of_screen
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
      expect(page).to have_css("#maplibre-map[data-online='false']")

      create(:feature, :polygon_middle, layer: map.layers.geojson.first, title: 'Poly Title')
      go_online

      expect_map_loaded
      sleep 1 # give some time for the feature to be received
      click_center_of_screen
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
