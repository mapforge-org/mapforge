require 'rails_helper'

describe 'Map' do
  subject(:map) { create(:map, user: create(:user)) }

  context 'share links' do
    before do
      visit map.private_map_path
      expect_map_loaded
      find('.maplibregl-ctrl-share').click
      expect(page).to have_text('Share Map')
    end

    it 'has share public link' do
      expect(page).to have_link('View link', href: '/m/' + subject.public_id)
    end

    it 'has share private link' do
      expect(page).to have_link('Edit link', href: '/m/' + subject.private_id)
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
    subject(:map) { create(:map, user: create(:user), features: features) }

    let(:features) { create_list(:feature, 2, :line_string) }

    it 'can download geojson export' do
      visit '/m/' + subject.public_id + '.geojson'
      expect(page).to have_text(map.to_geojson.to_json)
    end

    it 'can download map export' do
      visit '/m/' + subject.public_id + '.json'
      expect(page).to have_text(map.to_json)
    end
  end

  context 'export gpx' do
    subject(:map) { create(:map, user: create(:user), features: features) }

    let(:features) { create_list(:feature, 2, :polygon) }

    before do
      visit map.private_map_path
      expect_map_loaded
      find('.maplibregl-ctrl-share').click
      expect(page).to have_text('Share Map')
    end

    it 'exports gpx with one track per linestring' do
      click_link("GPX")
      file = wait_for_download(subject.public_id + '.gpx', timeout: 10)
      expect(File.read(file).scan(/<trk>/i).size).to eq(2)
    end
  end

  context 'permissions' do
    before do
      visit map.private_map_path
      expect_map_loaded
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
