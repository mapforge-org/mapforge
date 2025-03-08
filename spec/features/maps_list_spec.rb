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

  context 'for user' do
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
