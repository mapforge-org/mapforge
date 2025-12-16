require 'rails_helper'

describe 'Feature details' do
  let(:map) { create(:map) }

  before do
    visit map.public_map_path
    expect_map_loaded
  end

  context 'with polygon on map' do
    before { create(:feature, :polygon_middle, layer: map.layers.first, title: 'Poly Title') }

    context 'with selected feature' do
      before do
        click_coord('#maplibre-map', 50, 50)
        expect(page).to have_css('#feature-details-modal')
      end

      it 'can enlarge modal with pull-up button', :mobile do
        height = find('#feature-details-modal').native.style('height').sub('px', '').to_i
        expect(height).to be < 200
        find('.modal-pull-button').click
        sleep(0.3)
        height = find('#feature-details-modal').native.style('height').sub('px', '').to_i
        expect(height).to be > 150
      end

      it 'can download feature export' do
        find('#feature-export-geo').click
      end
    end
  end
end
