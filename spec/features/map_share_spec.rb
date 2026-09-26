require "rails_helper"

# The share links, the ownership link and the exports are server rendered, see the
# request spec spec/requests/maps_controller_spec.rb. This file keeps the parts that
# need a browser: the native share and the gallery toggle.
describe "Map" do
  subject(:map) { create(:map, name: "Test Map", owners: [ user ]) }

  let(:user) { create(:user, name: "Test User", email: "test@mapforge.org") }

  context "in rw mode" do
    before do
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-share").click
      expect(page).to have_text("Share Map")
    end

    it "native shares the view link when the icon inside it is clicked" do
      page.execute_script("navigator.share = (data) => { window.shared = data; return Promise.resolve() }")
      find("#share-view-link i").click
      expect(page.evaluate_script("window.shared.url")).to end_with("/m/" + subject.public_id)
    end

    it "can add the map to the gallery and remove it again" do
      find("#map-gallery-toggle").click
      wait_for { map.reload.view_permission }.to eq("listed")

      find("#map-gallery-toggle").click
      wait_for { map.reload.view_permission }.to eq("link")
    end
  end
end
