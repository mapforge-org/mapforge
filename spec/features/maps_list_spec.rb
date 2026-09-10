require "rails_helper"

# The filter results themselves are server rendered, see the request spec
# spec/requests/maps_controller_spec.rb. This file only covers the parts that
# need a browser: the live broadcast and the Stimulus filter controls.
describe "Map List" do
  let(:maps) { create_list(:map, 3, view_permission: "listed") }

  before do
    maps
    visit maps_path
  end

  it "receives broadcasts for map changes" do
    # page is already loaded
    expect(page).to have_selector(:xpath, "//a[@href='/m/#{maps[0].public_id}']")
    sleep(1) # make sure websocket is connected
    new_map = create(:map, name: "broadcast", view_permission: "listed")

    expect(page).to have_selector(:xpath, "//a[@href='/m/#{new_map.public_id}/broadcast']")
  end

  context "filter list" do
    let(:maps) {
      [ create(:map, name: "Map1", view_permission: "listed"),
        create(:map, name: "Map2", view_permission: "listed") ]
    }

    it "searches on enter and clears the filter again" do
      fill_in "search", with: "Map1"
      find_field("search").send_keys(:enter)

      expect(page).to have_selector(".map-preview", count: 1)
      expect(page).to have_text("Map1")
      find("button[aria-label='Clear filter']").click
      expect(page).to have_selector(".map-preview", count: 2)
    end
  end
end
