require "rails_helper"

describe "Map List" do
  let(:maps) { create_list(:map, 3, view_permission: "listed") }
  let(:user) { create(:user) }

  before do
    maps
    visit maps_path
  end

  it "shows public links to maps" do
    expect(page).to have_selector(:xpath, "//a[@href='/m/#{maps[0].public_id}']")
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
        create(:map, name: "Map2", user: user, view_permission: "listed") ]
    }

    it "searches in map names" do
      fill_in "search", with: "Map1"
      find_field("search").send_keys(:enter)

      expect(page).to have_selector(".map-preview", count: 1)
      expect(page).to have_text("Map1")
      expect(page).not_to have_text("Map2")
    end

    it "can clear filter" do
      fill_in "search", with: "Map1"
      find_field("search").send_keys(:enter)

      expect(page).to have_selector(".map-preview", count: 1)
      find("button[aria-label='Clear filter']").click
      expect(page).to have_selector(".map-preview", count: 2)
    end

    it "searches for map owners" do
      fill_in "search", with: "user:#{user.id}"
      find_field("search").send_keys(:enter)

      expect(page).to have_selector(".map-preview", count: 1)
      expect(page).to have_text("Map2")
      expect(page).not_to have_text("Map1")
    end
  end
end
