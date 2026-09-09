require "rails_helper"

describe "Map settings use cases" do
  subject(:map) { create(:map) }

  context "with an empty map in rw mode" do
    before do
      visit map.private_map_path
      expect_map_loaded
    end

    it "opens the settings modal" do
      expect(page).to have_css("#settings-modal.show")
      expect(page).to have_text("What do you want to do?")
    end

    it "closes the modal on 'empty map'" do
      click_button "Empty map"
      expect(page).to have_no_css("#settings-modal.show")
    end

    it "asks to log in before an import" do
      expect(page).to have_text("Please log in to import files")
      expect(page).to have_button("Import an image", disabled: true)
    end

    it "starts the bike route mode" do
      click_button "Bike route"
      expect(page).to have_no_css("#settings-modal.show")
      expect(page).to have_css(".ctrl-line-menu:not(.hidden) .mapbox-gl-draw_bicycle.active")
      expect(page.evaluate_script("draw.getMode()")).to eq("directions_bike")
    end

    it "opens the layers modal on 'OpenStreetMap data'" do
      click_button "Add OpenStreetMap data"
      expect(page).to have_no_css("#settings-modal.show")
      expect(page).to have_css("#layers-modal.show")
    end
  end

  context "with a named map in rw mode" do
    subject(:map) { create(:map, name: "Use case test") }

    it "collapses the use cases" do
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-map").click
      expect(page).to have_css("details.feature-section-card:not([open])")
      find("summary", text: "What do you want to do?").click
      expect(page).to have_css("details.feature-section-card[open]")
    end
  end

  context "with a logged in user" do
    let(:user) { create :user }

    it "offers the import options" do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit map.private_map_path
      expect_map_loaded
      expect(page).to have_button("Import an image", disabled: false)
      expect(page).to have_button("Import a file", disabled: false)
    end
  end

  context "in ro mode" do
    it "does not render the use cases" do
      visit map.public_map_path
      expect_map_loaded
      expect(page).to have_no_css(".welcome-tiles", visible: :all)
    end
  end
end
