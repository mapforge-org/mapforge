require "rails_helper"

# The list content, the filter and the admin check are server rendered, see the
# request spec spec/requests/admin_controller_spec.rb. This file keeps the parts
# that need a browser: the confirm dialogs and the navigation into a map.
describe "Admin List" do
  let(:admin) { create(:user, admin: true) }

  before do
    create_list(:map, 3)
    allow_any_instance_of(ActionController::Base).to receive(:session)
      .and_return({ user_id: admin.id })

    visit admin_path
  end

  it "shows link to destroy map" do
    accept_alert do
      find("i[class='bi bi-trash']", match: :first).click
    end
    expect(page).to have_text("Mapforge")
    wait_for { Map.count }.to eq(2)
  end

  it "shows link to copy map" do
    accept_confirm do
      find("i[class='bi bi-copy']", match: :first).click
    end
    expect_map_loaded
    expect(Map.count).to eq(4)
  end

  # FIXME: Somehow Turbo Stream broadcasts / responses aren't visible to capybara...
  # context 'map change broadcasts' do
  # end

  context "navigating from admin list to map" do
    it "shows map in edit mode without errors" do
      find("img[class='preview-image']", match: :first).click
      expect(page).to have_selector(:xpath, "//button[@aria-label='Map settings']")
    end
  end
end
