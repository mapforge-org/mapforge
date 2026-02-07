require 'rails_helper'

describe 'Map' do
  subject(:map) { create(:map) }

  let(:user) { create(:user) }

  before do
    overpass_file = File.read(Rails.root.join("spec", "fixtures", "files", "overpass.json"))
    CapybaraMock.stub_request(
      :post, 'https://overpass-api.de/api/interpreter'
    ).to_return(
      headers: { 'Access-Control-Allow-Origin' => '*' },
      status: 200,
      body: overpass_file
    )

    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit map.private_map_path
    expect_map_loaded
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
      expect(page).to have_text('Added feature')
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
      expect(map.reload.features.count).to eq 3
      expect(map.layers.overpass.count).to eq 1
      # expect(map.reload.center).to eq [ 11.07338990801668, 49.44765470337188 ]
      expect(map.zoom).to eq "14.6"
      expect(map.bearing).to eq "50.4"
      expect(page).to have_text('TestMap')
    end

    it 'import image' do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "image_with_exif.jpg"))
      click_button 'Yes'
      wait_for { map.reload.features.count }.to eq 1
      # flyTo is finished when the feature details are shown
      expect(page).to have_text('Edit feature')
      # TODO: For some reason the map doesn't flyTo() in test env
      # expect(page.evaluate_script("[map.getCenter().lng.toFixed(4), map.getCenter().lat.toFixed(4)].toString()"))
      #  .to eq("11.0769,49.4475")
      expect(map.features.first.image.public_id).to match (/image_with_exif-\d+.jpeg/)
      expect(map.features.first.geometry['coordinates']).to eq ([ 9.9749, 53.5445 ])
    end
  end

  context 'overpass layer' do
    before do
      map.layers << layer
      visit map.private_map_path
      expect_map_loaded
      expect_overpass_loaded
      find('.maplibregl-ctrl-layers').click
    end

    let(:layer) { create(:layer, :overpass, name: 'opass') }

    it 'Shows overpass layer' do
      expect(page).to have_text('opass(1)')
    end

    it 'can add overpass layer' do
      expect(page).to have_text('opass')
      click_button 'Add layer'
      find('li', text: 'Drinking water').click
      wait_for { Layer.find_by(name: 'Drinking water') }.not_to be_nil
    end

    it 'can edit overpass layer' do
      expect(page).to have_text('opass')
      find(".layer-edit").click
      expect(page).to have_field('overpass-query', with: layer.query)
      fill_in 'overpass-query', with: 'nwr[highway=bus];out center 1;'
      click_button 'Update Layer'
      wait_for { layer.reload.query }.to eq('nwr[highway=bus];out center 1;')
    end

    it 'can delete overpass layer' do
      expect(page).to have_text('opass')
      find(".layer-edit").click
      accept_alert do
        click_button 'Delete Layer'
      end
      wait_for { Layer.find(layer.id) }.to be_nil
    end
  end

  context 'add new layer' do
   before do
      find('.maplibregl-ctrl-layers').click
    end

    it 'can add predefined query layer' do
      click_button 'Add layer'
      within('#query-dropdown') do
        first('li', text: 'Breweries').click
      end
      wait_for { map.layers.find { |m| m.name == 'Breweries' } }.to be_present
    end

    it 'can add custom query layer' do
      click_button 'Add layer'
      within('#query-dropdown') do
        first('li', text: 'Custom query').click
      end
      wait_for { map.layers.find { |m| m.name == 'Custom query' } }.to be_present
    end
  end
end
