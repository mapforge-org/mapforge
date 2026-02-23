require 'rails_helper'

describe 'Feature details' do
  let(:map) { create(:map) }

  before do
    visit map.public_map_path
    expect_map_loaded
  end

  context 'mobile', :mobile do
    before { create(:feature, :polygon_middle, layer: map.layers.first, title: 'Poly Title') }

    context 'with selected feature' do
      before do
        sleep 1
        click_center_of_screen
        expect(page).to have_css('#feature-details-modal')
      end

      it 'can enlarge modal with pull-up button' do
        height = element_offset_height('#feature-details-modal')
        # initial height is half the screen height
        expect(height).to be < 300
        find('.modal-pull-button').click
        sleep(0.3)
        height = element_offset_height('#feature-details-modal')
        expect(height).to be > 300
      end
    end
  end

  context 'export' do
    let(:feature) { create(:feature, :polygon_middle, title: 'Poly Title') }
    let(:map) { create(:map, features: [ feature ]) }

    context 'with selected feature' do
      before do
        click_center_of_screen
        expect(page).to have_css('#feature-details-modal')
      end

      it 'has share geojson link' do
        expect(page).to have_link('GeoJSON', href: '/m/' + map.public_id + '/feature/' + feature.id + '.geojson' + '/Poly_Title.geojson')
      end

      it 'has share gpx link' do
        expect(page).to have_link('GPX', href: '/m/' + map.public_id + '/feature/' + feature.id + '.gpx' + '/Poly_Title')
      end

      it 'can download feature export' do
        find('#feature-export-geo').click
      end
    end
  end
end
