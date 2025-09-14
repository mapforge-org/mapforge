require 'rails_helper'

describe 'Frontpage' do
  context 'when not logged in' do
    before do
      visit root_path
    end

    it 'shows frontpage description' do
      expect(page).to have_text('Create your own maps')
    end
  end

  context 'when logged in' do
    let(:user) { create :user }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit root_path
    end

    it 'redirects to /my path' do
      expect(page).to have_current_path(frontpage_path)
    end

    it 'logo links to frontpage' do
      click_link 'Mapforge'
      expect(page).to have_current_path(frontpage_path)
      expect(page).to have_text('Create your own maps')
    end
  end
end
