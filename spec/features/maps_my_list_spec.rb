require "rails_helper"

# The list content and the filter are server rendered, see the request spec
# spec/requests/maps_controller_spec.rb. Only the delete confirmation needs a browser.
describe "Map List" do
  let(:user) { create(:user) }

  before do
    allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
    create(:map, owners: [ user ])
    visit my_path
  end

  it "can delete own map" do
    expect(user.owned_maps.count).to eq 1
    expect(page).to have_css(".map-preview")
    accept_alert do
      find(".map-delete", match: :first).click
    end
    expect(page).not_to have_css(".map-preview")
    expect(user.reload.owned_maps.count).to eq 0
  end
end
