require 'rails_helper'

describe 'Admin List' do
  let!(:maps) { create_list(:map, 3) }
  let!(:admin) { create(:user, admin: true) }

  context 'as logged in admin' do
    before do
      allow_any_instance_of(ActionController::Base).to receive(:session)
        .and_return({ user_id: admin.id })

      visit admin_path
    end

    it 'shows private links to maps' do
      expect(page).to have_selector(:xpath, "//a[@href='/m/#{maps[0].private_id}']")
    end

    it 'shows link to destroy map' do
      accept_alert do
        find("i[class='bi bi-trash']", match: :first).click
      end
      expect(page).to have_text('Mapforge')
      expect(Map.count).to eq(2)
    end

    # FIXME: Somehow Turbo Stream broadcasts / responses aren't visible to capybara...
    # context 'map change broadcasts' do
    # end

    context 'navigating from admin list to map' do
      it 'shows map in edit mode without errors' do
        find("img[class='preview-image']", match: :first).click
        expect(page).to have_selector(:xpath, "//button[@aria-label='Map settings']")
      end
    end
  end

  context 'as not logged in admin' do
    before do
      visit admin_path
    end

    it 'shows login page' do
      expect(page).to have_text 'Log in here'
    end
  end
end
