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

    context 'file upload' do
      it 'import geojson' do
        attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "features.json"))
        expect(page).to have_text('Import1')
        expect(map.reload.features.count).to eq 4
      end

      it 'import mapforge json' do
        attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "mapforge.json"))
        expect(page).to have_text('f1')
        expect(map.reload.features.count).to eq 4
        expect(map.reload.center).to eq [ 11.07338990801668, 49.44765470337188 ]
        expect(map.reload.zoom).to eq "14.6"
        expect(map.reload.bearing).to eq "50.4"
        expect(page).to have_text('TestMap')
      end
    end
  end
end
