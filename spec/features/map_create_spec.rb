require 'rails_helper'

describe 'Create map' do
  before do
    visit maps_path
  end

  it 'shows description' do
    click_link 'Create map'
    expect_map_loaded
  end
end
