require "rails_helper"

# The login and logout flow itself is server side, see the request spec
# spec/requests/sessions_controller_spec.rb. Only the profile dropdown needs a browser.
describe "Login" do
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    visit maps_path
  end

  it "offers logout in the profile menu" do
    find(".profile-image").click
    click_link("Logout")
    expect(page).to have_current_path(root_path)
  end
end
