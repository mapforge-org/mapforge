require "rails_helper"

describe "Keyboard Shortcuts" do
  let(:map) { create(:map, name: "Feature edit test") }
  let(:user) { create(:user) }

  context "Map Edit Mode" do
    let(:point) { create(:feature, :point_middle, title: "Point Title") }
    let(:map) { create(:map, features: [ point ]) }

    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit map.private_map_path
      expect_map_loaded
    end

    context "with selected point feature" do
      before do
        click_center_of_screen
        expect(page).to have_text("Point Title")
      end

      it "can copy & paste point" do
        page.driver.browser.keyboard.type([ :Control, "c" ])

        expect(page).to have_text("Feature copied to clipboard")

        # Clipboard read is disallowed in headless mode
        # find('body').send_keys(:control, 'v')
        # expect(page).to have_text('Added feature')
        # wait_for { Feature.point.count }.to eq(2)
      end

      it "can undo a feature delete with Ctrl+Z" do
        accept_alert do
          find("#edit-button-advanced").click
          find("#edit-button-trash").click
        end
        wait_for { Feature.count }.to eq(0)

        page.execute_script("document.activeElement.blur()")
        page.execute_script("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))")

        wait_for { Feature.count }.to eq(1)
      end

      it "can redo a feature delete with Ctrl+Y" do
        accept_alert do
          find("#edit-button-advanced").click
          find("#edit-button-trash").click
        end
        wait_for { Feature.count }.to eq(0)

        page.execute_script("document.activeElement.blur()")
        page.execute_script("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))")
        wait_for { Feature.count }.to eq(1)

        page.execute_script("document.activeElement.blur()")
        page.execute_script("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))")
        expect(page).to have_text("Redo")

        wait_for { Feature.count }.to eq(0)
      end
    end
  end
end
