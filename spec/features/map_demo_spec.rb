require 'rails_helper'

describe 'Demo' do
  context 'on frontpage' do
    before do
      visit root_path
    end

    it 'links to demo' do
      expect(page).to have_link('demo map', href: demo_path)
    end
  end

  context 'on demo' do
    context 'guest user' do
    before do
      visit root_path
      click_link 'demo map'
      expect_map_loaded
      visit root_path
      click_link 'demo map'
      expect_map_loaded
    end

      it 'creates new demo map for each user' do
        expect(Map.demo.count).to eq 2
      end
    end

    context 'logged in user' do
      let(:user) { create(:user) }

      before do
        allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
        visit root_path
        click_link 'demo map'
        expect_map_loaded
        visit root_path
        click_link 'demo map'
        expect_map_loaded
      end

      it 'creates personal demo map' do
        expect(Map.demo.count).to eq 1
      end
    end
  end
end
