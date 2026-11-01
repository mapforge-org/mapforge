require "rails_helper"

describe "Map view as owner" do
  let(:map) { create(:map) }
  let(:path) { map.public_map_path }
  let(:current_user) { nil }

  before do
    stub_const("Map::BASE_MAPS", [ "test", "test2" ] + Map::BASE_MAPS)
    sign_in(current_user) if current_user
    visit path
    expect_map_loaded
  end

  context "as map owner / admin" do
    let(:map) { create(:map, owners: [ user ]) }
    let(:user) { create(:user) }
    let(:current_user) { user }

    # the toggle labels are uppercased by CSS
    it "marks view mode as the active mode" do
      expect(page).to have_css("#map-mode-badge .active", text: /view mode/i)
    end

    it "has no link to switch to edit mode" do
      expect(page).not_to have_css(".maplibregl-ctrl-edit")
    end

    it "switches to edit mode without reloading the page" do
      page.execute_script("window.noReload = true")
      find("#map-mode-badge a", text: /edit mode/i).click

      expect(page).to have_css(".maplibregl-ctrl-select")
      expect(page).to have_current_path("/m/" + map.private_id)
      expect(page).to have_css("#map-mode-badge .active", text: /edit mode/i)
      expect(page.evaluate_script("window.noReload")).to be(true)
    end

    context "with a description" do
      let(:map) { create(:map, owners: [ user ], description: "Map **Desc**") }

      it "renders the description in view mode and edits it in edit mode" do
        find(".maplibregl-ctrl-map").click
        expect(page).to have_css("#map-description-view strong", text: "Desc")

        find(".maplibregl-ctrl-map").click
        find("#map-mode-badge a", text: /edit mode/i).click
        find(".maplibregl-ctrl-map").click

        expect(page).to have_css("#map-description .EasyMDEContainer")
        expect(page).to have_text("Map **Desc**")
      end
    end

    it "drops unsaved view mode changes on a switch to edit mode" do
      original = page.evaluate_script("window.gon.map_properties.base_map")
      find(".maplibregl-ctrl-map").click
      find("#base-map-toggle").click
      find(".base-map-item[data-base-map='test2']").click
      expect(page).to have_css('.base-map-item.active[data-base-map="test2"]', visible: :all)
      expect_map_loaded
      find(".maplibregl-ctrl-map").click

      find("#map-mode-badge a", text: /edit mode/i).click

      expect(page).to have_css(".maplibregl-ctrl-select")
      expect(page.evaluate_script("window.gon.map_properties.base_map")).to eq(original)
    end

    it "closes open modals on a mode switch" do
      find(".maplibregl-ctrl-layers").click
      expect(page).to have_css("#layers-modal.show")

      find("#map-mode-badge a", text: /edit mode/i).click

      expect(page).not_to have_css("#layers-modal.show")
    end

    it "switches back with the browser back button" do
      find("#map-mode-badge a", text: /edit mode/i).click
      expect(page).to have_css(".maplibregl-ctrl-select")
      page.execute_script("window.noReload = true")

      page.go_back

      expect(page).not_to have_css(".maplibregl-ctrl-select")
      expect(page).to have_current_path("/m/" + map.public_id)
      expect(page).to have_css("#map-mode-badge .active", text: /view mode/i)
      expect(page.evaluate_script("window.noReload")).to be(true)
    end

    context "starting in edit mode" do
      # a named map keeps edit mode from opening the settings modal over the toggle
      let(:map) { create(:map, owners: [ user ], name: "Named map") }
      let(:path) { map.private_map_path }

      it "switches to view mode without reloading the page" do
        expect(page).to have_css(".maplibregl-ctrl-select")
        page.execute_script("window.noReload = true")
        find("#map-mode-badge a", text: /view mode/i).click

        expect(page).not_to have_css(".maplibregl-ctrl-select")
        expect(page).to have_current_path("/m/" + map.public_id)
        expect(page).to have_css("#map-mode-badge .active", text: /view mode/i)
        expect(page.evaluate_script("window.noReload")).to be(true)
      end

      # the edit handlers stay registered after the switch, so a click or a
      # control must not reach into the removed edit UI
      it "can still use the map and the controls after the switch" do
        find("#map-mode-badge a", text: /view mode/i).click
        expect(page).not_to have_css(".maplibregl-ctrl-select")

        click_center_of_screen
        find(".maplibregl-ctrl-layers").click
        expect(page).to have_css("#layers-modal")
      end
    end
  end
end
