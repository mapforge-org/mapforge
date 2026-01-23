require 'rails_helper'

describe 'Map List' do
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    create(:map, user: user)
    visit my_path
  end

  it 'shows private links to maps' do
      expect(page).to have_selector(:xpath, "//a[@href='/m/#{user.maps.first.private_id}']")
  end

  it 'can delete own map' do
    expect(user.maps_count).to eq 1
    expect(page).to have_css(".map-preview")
    accept_alert do
      find(".map-delete", match: :first).click
    end
    expect(page).not_to have_css(".map-preview")
    expect(user.reload.maps_count).to eq 0
  end

  context 'filter list' do
    before { [ create(:map, user: user, name: 'Map1'),
                    create(:map, user: user, name: 'Map2') ] }

    it 'searches in map names' do
      fill_in "search", with: "Map1"
      find_field("search").send_keys(:enter)

      expect(page).to have_selector('.map-preview', count: 1)
      expect(page).to have_text('Map1')
      expect(page).not_to have_text('Map2')
    end
  end
end
