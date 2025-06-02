require 'rails_helper'

describe 'Map' do
  subject(:map) { create(:map) }

  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit map_path(map)
    expect(page).to have_css("#maplibre-map[map-loaded='true']")
  end

  context 'with initial map rendering' do
    it 'shows map layers button' do
      expect(page).to have_css('#maplibre-map')
      expect(page).to have_css('.maplibregl-ctrl-layers')
    end
  end

  context 'feature listing' do
    before do
      feature
      expect(page).to have_text('Map view updated')
      find('.maplibregl-ctrl-layers').click
    end

    let(:feature) { create(:feature, :point, title: 'Feature 1', desc: 'F1 desc', layer: map.layers.first) }

    it 'lists all features' do
      expect(page).to have_text('Feature 1')
    end

    it 'flies to feature on click' do
      find("li[data-feature-id='#{feature.id}']").click
      # flyTo is finished when the feature details are shown
      expect(page).to have_text('F1 desc')
      expect(page.evaluate_script("[map.getCenter().lng, map.getCenter().lat].toString()"))
        .to eq(feature.coordinates.join(','))
    end
  end

  context 'file upload' do
    before do
      find('.maplibregl-ctrl-layers').click
    end

    it 'import geojson' do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "features.geojson"))
      expect(page).to have_text('(3)')
      expect(page).to have_text('Import1')
      expect(map.reload.features.count).to eq 3
    end

    it 'import mapforge json' do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "mapforge.json"))
      expect(page).to have_text('(3)')
      expect(page).to have_text('f1')
      expect(map.reload.features.count).to eq 3
      expect(map.reload.center).to eq [11.077, 49.447]
      expect(map.reload.zoom).to eq "14.6"
      expect(map.reload.bearing).to eq "50.4"
      expect(page).to have_text('TestMap')
    end
  end

  context 'overpass layer' do
    before do
      map.layers << layer
      visit map_path(map)
      expect(page).to have_css("#maplibre-map[map-loaded='true']")
      find('.maplibregl-ctrl-layers').click
    end

    let(:layer) { create(:layer, :overpass, name: 'opass') }

    it 'Shows overpass layer' do
      expect(page).to have_text('opass')
    end

    it 'can edit overpass layer' do
      expect(page).to have_text('opass')
      find('img.layer-osm-icon').click
      expect(page).to have_text('Openstreetmap live query')
      find(".edit-overpass").click
      expect(page).to have_field('overpass-query', with: layer.query)
      fill_in 'overpass-query', with: 'nwr[highway=bus];out center;'
      click_button 'Update'
      wait_for { layer.reload.query }.to eq('nwr[highway=bus];out center;')
    end
  end
end
