require 'rails_helper'

describe 'Keyboard Shortcuts' do
  let(:map) { create(:map, name: 'Feature edit test') }
  let(:user) { create(:user) }

  context 'Map Edit Mode' do
    let(:point) { create(:feature, :point_middle, title: 'Point Title') }
    let(:map) { create(:map, features: [ point ]) }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit map.private_map_path
      expect_map_loaded
    end

    context 'with selected point feature' do
      before do
        click_center_of_screen
        expect(page).to have_text('Point Title')
      end

      it 'can copy & paste point' do
        page.driver.browser.keyboard.type([ :Control, "c" ])

        expect(page).to have_text('Feature copied to clipboard')

        # Clipboard read is disallowed in headless mode
        # find('body').send_keys(:control, 'v')
        # expect(page).to have_text('Added feature')
        # wait_for { Feature.point.count }.to eq(2)
      end
    end
  end
end
