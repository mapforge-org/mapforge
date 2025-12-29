require 'rails_helper'

describe 'Feature directions' do
  let(:map) { create(:map, name: 'Feature directions test') }

  before do
    visit map.private_map_path
    expect_map_loaded
  end

  context 'with empty map' do
    it 'can create foot track' do
      find('.mapbox-gl-draw_line').click
      find('.mapbox-gl-draw_foot').click
      click_coord('#maplibre-map', 250, 250)
      click_coord('#maplibre-map', 450, 450)
      wait_for { Feature.line_string.count }.to eq(1)
    end
  end
end
