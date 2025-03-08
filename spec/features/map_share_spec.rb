require 'rails_helper'

describe 'Map' do
  subject(:map) { create(:map) }

  context 'share links' do
    before do
      visit map_path(map)
      find('.maplibregl-ctrl-share').click
      expect(page).to have_text('Share Map')
    end

    it 'has share public link' do
      expect(page).to have_link('View link', href: '/m/' + subject.public_id)
    end

    it 'has share private link' do
      expect(page).to have_link('Edit link', href: '/m/' + subject.id)
    end

    it 'has share geojson link' do
      expect(page).to have_link('GeoJSON', href: '/m/' + subject.public_id + '.geojson')
    end

    it 'has share gpx link' do
      expect(page).to have_link('GPX', href: '/m/' + subject.public_id + '.gpx')
    end

    it 'has share map export link' do
      expect(page).to have_link('Map export', href: '/m/' + subject.public_id + '.json')
    end
  end

  context 'export' do
    it 'can download geojson export' do
      visit '/m/' + subject.public_id + '.geojson'
      expect(page).to have_text(map.to_geojson.to_json)
    end

    it 'can download map export' do
      visit '/m/' + subject.public_id + '.json'
      expect(page).to have_text(map.to_json)
    end

    it 'can download gpx export' do
      visit '/m/' + subject.public_id + '.gpx'
    end
  end

  context 'permissions' do
    before do
      visit map_path(map)
      expect(page).to have_css("#maplibre-map[map-loaded='true']")
      find('.maplibregl-ctrl-share').click
      expect(page).to have_text('Share Map')
    end

    it 'can update view permission' do
      select('Only you', from: 'map-view-permissions')
      wait_for { map.reload.view_permission }.to eq('private')
    end

    it 'can update edit permission' do
      select('Only you', from: 'map-edit-permissions')
      wait_for { map.reload.edit_permission }.to eq('private')
    end
  end
end
