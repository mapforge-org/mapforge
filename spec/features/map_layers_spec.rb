require "rails_helper"

describe "Map layers" do
  include_context "with an editable map and an overpass stub"

  context "with initial map rendering" do
    it "shows map layers button" do
      expect(page).to have_css("#maplibre-map")
      expect(page).to have_css(".maplibregl-ctrl-layers")
    end
  end

  context "feature listing" do
    before do
      feature
      expect(page).to have_text("Point added")
      find(".maplibregl-ctrl-layers").click
    end

    let(:feature) { create(:feature, :point, title: "Feature 1", desc: "F1 desc", layer: map.layers.first) }

    it "lists all features" do
      expect(page).to have_text("Feature 1")
    end

    it "flies to feature on click" do
      find("li[data-feature-id='#{feature.id}']").click
      # flyTo is finished when the feature details are shown
      expect(page).to have_text("F1 desc")
      center = page.evaluate_script("[map.getCenter().lng, map.getCenter().lat]")
      expect(center[0]).to be_within(1e-6).of(feature.coordinates[0])
      expect(center[1]).to be_within(1e-6).of(feature.coordinates[1])
    end
  end

  context "file upload" do
    before do
      find(".maplibregl-ctrl-layers").click
    end

    it "import geojson" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "features.geojson"))
      expect(page).to have_text("(3)")
      expect(page).to have_text("Import1")
      expect(map.reload.features.count).to eq 3
    end

    it "import mapforge json" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "mapforge.json"))
      expect(page).to have_text("(3)")
      expect(map.reload.layers.count).to eq 4 # 1 default + 3 imported
      expect(map.reload.features.count).to eq 6
      expect(map.layers.overpass.count).to eq 1
      expect(map.layers.find_by(name: "TestLayer 2").show).to be false
      # expect(map.reload.center).to eq [ 11.07338990801668, 49.44765470337188 ]
      expect(map.zoom).to eq "14.6"
      expect(map.bearing).to eq "50.4"
      # an existing map name is kept, the imported one is ignored
      expect(map.name).to eq "Layers test"
    end

    context "with kml import" do
      before do
        page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
        attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "madeira.kml"))
        expect(page).to have_text("Unbenannte Ebene(2)")
      end

      it "imports the kml layer and features" do
        expect(map.reload.layers.count).to eq 2 # 1 default + 1 folder
        expect(map.features.count).to eq 2
      end

      it "imports point style and properties" do
        point = map.features.find { |f| f.geometry["type"] == "Point" }
        expect(point.properties["title"]).to eq "Cristiano Ronaldo Statue"
        # the KML color ff589d0f is aabbggrr, and it sits in the "normal" pair of a StyleMap
        expect(point.properties["marker-color"]).to eq "#0f9d58"
        # the style id icon-1599-... names the G**gle icon, the href is a blank pin for all of them
        expect(point.properties["marker-symbol"]).to eq "/icon-sets/pinhead/obelisk_on_plinth.png"
        # a pinhead icon is white, so it needs a white border to stand out from the marker color
        expect(point.properties["stroke"]).to eq "#fff"
        expect(point.properties["marker-size"]).to eq 16
        # <LabelStyle><scale>0</scale> hides the label
        expect(point.properties["label"]).to be_nil
        expect(point.properties["desc"]).to include("Statue am Hafen von Funchal")
        expect(point.properties["Kategorie"]).to eq "Sehenswürdigkeit"
      end

      it "imports line style" do
        line = map.features.find { |f| f.geometry["type"] == "LineString" }
        expect(line.properties["stroke"]).to eq "#000000"
        expect(line.properties["stroke-width"]).to eq 1.2
      end
    end

    it "import kml document data" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "madeira.kml"))
      expect(page).to have_text("Unbenannte Ebene(2)")
      # an existing map name is kept, the imported one is ignored
      expect(map.reload.name).to eq "Layers test"
      expect(map.description).to eq "Reisekarte Madeira\nStand 2024"
      # from <LookAt>
      expect(map.bearing).to eq "20"
      expect(map.pitch).to eq "30"
    end

    it "import kmz" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "madeira.kmz"))
      expect(page).to have_text("Unbenannte Ebene(2)")
      expect(map.reload.layers.count).to eq 2
      expect(map.features.count).to eq 2
      expect(map.features.map { |f| f.properties["title"] })
        .to contain_exactly("Cristiano Ronaldo Statue", "Levada do Caldeirão Verde")
    end

    it "import kml with MultiGeometry placemarks" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "multigeometry.kml"))
      # 2 lines of one placemark merge into one MultiLineString, the mixed placemark splits in two
      expect(page).to have_text("Routen(3)")
      wait_for { map.reload.features.count }.to eq 3
      expect(map.features.map { |f| f.geometry["type"] })
        .to contain_exactly("MultiLineString", "Point", "LineString")
    end

    it "import kml without folder" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "point.kml"))
      wait_for { map.reload.features.count }.to eq 1
      # placemarks outside a folder land in the default layer
      expect(map.layers.count).to eq 1
      expect(map.features.first.properties["title"]).to eq "KML Point"
    end

    it "import gpx" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "track.gpx"))
      wait_for { map.reload.features.count }.to eq 2
      expect(map.layers.count).to eq 1
      expect(map.features.map { |f| f.properties["title"] }).to contain_exactly("Funchal", "Levada walk")
      expect(map.features.find { |f| f.geometry["type"] == "Point" }.properties["desc"])
        .to eq "Start of the track"
    end

    it "import image" do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "image_with_exif.jpg"))
      click_button "Yes"
      wait_for { map.reload.features.count }.to eq 1
      # flyTo is finished when the feature details are shown
      expect(page).to have_text("Details")
      # flyToFeature() after async image upload doesn't complete in headless test env
      # expect(page.evaluate_script("[map.getCenter().lng.toFixed(4), map.getCenter().lat.toFixed(4)].toString()"))
      #   .to eq("9.9749,53.5445")
      expect(map.features.first.image.public_id).to match(/image_with_exif-\d+.webp/)
      expect(map.features.first.geometry["coordinates"]).to eq([ 9.9749, 53.5445 ])
    end
  end

  context "overpass layer" do
    before do
      map.layers << layer
      visit map.private_map_path
      expect_map_loaded
      expect_overpass_loaded
      find(".maplibregl-ctrl-layers").click
    end

    let(:layer) { create(:layer, :overpass, name: "opass") }

    it "Shows overpass layer" do
      expect(page).to have_text("opass(1)")
    end

    it "can add overpass layer" do
      expect(page).to have_text("opass")
      click_button "Add layer"
      within("#query-dropdown") do
        find("button.dropdown-item", text: "🚰 Drinking water").trigger("click")
      end
      wait_for { Layer.find_by(name: "🚰 Drinking water") }.not_to be_nil
    end

    it "can edit overpass layer" do
      expect(page).to have_text("opass")
      find(".layer-edit").click
      expect(page).to have_field("overpass-query", with: layer.query)
      fill_in "overpass-query", with: "nwr[highway=bus];out center 1;"
      click_button "Update Layer"
      wait_for { layer.reload.query }.to eq("nwr[highway=bus];out center 1;")
    end

    it "can delete overpass layer" do
      expect(page).to have_text("opass")
      accept_alert do
        find('.btn-layer-actions.layer-delete').click
      end
      wait_for { Layer.find(layer.id) }.to be_nil
    end
  end
end
