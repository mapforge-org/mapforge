require "rails_helper"

describe "Map" do
  subject(:map) { create(:map, name: "Test Map", owners: [ user ]) }

  let(:user) { create(:user, name: "Test User", email: "test@mapforge.org") }


  context "share links" do
    before do
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-share").click
      expect(page).to have_text("Share Map")
    end

    it "has share public link" do
      expect(page).to have_link("Share view link", href: "/m/" + subject.public_id)
    end

    it "has share private link" do
      expect(page).to have_link("Share edit link", href: "/m/" + subject.private_id)
    end

    it "has share geojson link" do
      expect(page).to have_link("GeoJSON", href: "/m/" + subject.public_id + ".geojson")
    end

    it "has share gpx link" do
      expect(page).to have_link("GPX", href: "/m/" + subject.public_id + ".gpx")
    end

    it "has share map export link" do
      expect(page).to have_link("Map export", href: "/m/" + subject.public_id + ".json")
    end
  end

  context "export" do
    subject(:map) { create(:map, owners: [ create(:user) ], features: features) }

    let(:features) { create_list(:feature, 2, :line_string) }

    it "can download geojson export" do
      visit "/m/" + subject.public_id + ".geojson"
      expect(page).to have_text(map.to_geojson.to_json)
    end

    it "can download map export" do
      visit "/m/" + subject.public_id + ".json"
      expect(page).to have_text(map.to_json)
    end
  end

  context "export gpx" do
    subject(:map) { create(:map, owners: [ create(:user) ], features: features) }

    let(:features) {
      [ create(:feature, :line_string, coordinates: [ [ 11.041, 49.481 ], [ 11.056, 49.463 ] ]),
        create(:feature, :line_string, coordinates: [ [ 11.056, 49.463 ], [ 11.061, 49.450 ] ]) ]
    }

    before do
      visit "/m/" + subject.public_id + ".gpx"
    end

    it "exports gpx with one track per linestring" do
      file = wait_for_download(subject.public_id + ".gpx", timeout: 10)
      expect(File.read(file).scan(/<trk>/i).size).to eq(2)
    end
  end

  context "permissions in rw mode" do
    before do
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-share").click
      expect(page).to have_text("Share Map")
    end

    it "has no share ownership link" do
      expect(page).not_to have_link("Share ownership link", href: "/m/" + map.private_id + "?join=true")
    end

    it "can share map in gallery" do
      find("#map-gallery-toggle").click
      wait_for { map.reload.view_permission }.to eq("listed")
    end

    it "can remove map from gallery" do
      find("#map-gallery-toggle").click
      wait_for { map.reload.view_permission }.to eq("listed")

      find("#map-gallery-toggle").click
      wait_for { map.reload.view_permission }.to eq("link")
    end
  end

  context "permissions in owner mode" do
    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      visit map.private_map_path
      expect_map_loaded
      find(".maplibregl-ctrl-share").click
      expect(page).to have_text("Share Map")
    end

    it "has share ownership link" do
      expect(page).to have_link("Share ownership link", href: "/m/" + map.private_id + "?join=true")
    end
  end
end
