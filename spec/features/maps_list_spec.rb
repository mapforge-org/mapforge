require 'rails_helper'

describe 'Map List' do
  let!(:maps) { create_list(:map, 3, view_permission: 'listed') }
  let(:user) { create(:user) }

  before do
    visit maps_path
  end

  it 'shows public links to maps' do
    expect(page).to have_selector(:xpath, "//a[@href='/m/#{maps[0].public_id}']")
  end

  it 'receives broadcasts for map changes' do
    # page is already loaded
    expect(page).to have_selector(:xpath, "//a[@href='/m/#{maps[0].public_id}']")
    sleep(1) # make sure websocket is connected
    new_map = create(:map, name: 'broadcast', view_permission: 'listed')

    expect(page).to have_selector(:xpath, "//a[@href='/m/#{new_map.public_id}/broadcast']")
  end

  context 'for user (/my)' do
    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      user.maps << maps.first
      visit my_path
    end

    it 'shows private links to maps' do
      expect(page).to have_selector(:xpath, "//a[@href='/m/#{maps[0].id}']")
    end
  end
end
