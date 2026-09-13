require "rails_helper"

describe "Map import" do
  include_context "with an editable map and an overpass stub"

  before do
    find(".maplibregl-ctrl-layers").click
  end

  it "narrows the file picker per import entry" do
    click_button "Import"
    within("#import-dropdown") do
      find("button.dropdown-item", text: "Images and photos").trigger("click")
    end
    expect(page.evaluate_script("document.querySelector('#fileInput').accept")).to eq "image/*"

    click_button "Import"
    within("#import-dropdown") do
      find("button.dropdown-item", text: "Map data").trigger("click")
    end
    expect(page.evaluate_script("document.querySelector('#fileInput').accept"))
      .to eq ".gpx,.kml,.kmz,.geojson,.json"
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
      expect(point.properties["stroke"]).to eq "#ffffff"
      expect(point.properties["marker-size"]).to eq 13
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

  context "with kmz import" do
    before do
      page.driver.execute_script("document.querySelector('#fileInput').classList.remove('hidden')")
      attach_file("fileInput", Rails.root.join("spec", "fixtures", "files", "madeira.kmz"))
      expect(page).to have_text("Unbenannte Ebene(5)")
    end

    it "imports the layer and features" do
      expect(map.reload.layers.count).to eq 2
      expect(map.features.map { |f| f.properties["title"] })
        .to contain_exactly("Cristiano Ronaldo Statue", "Miradouro do Cabo Girão", "Pico Ruivo", "Porto Moniz",
                            "Levada do Caldeirão Verde")
    end

    it "keeps the pinhead symbol of a known icon id" do
      statue = map.reload.features.find { |f| f.properties["title"] == "Cristiano Ronaldo Statue" }
      expect(statue.properties["marker-symbol"]).to eq "/icon-sets/pinhead/camera.png"
      # the packed image is not uploaded
      expect(statue.properties["marker-image-url"]).to be_nil
    end

    it "imports the plain pin as pin shape" do
      pin = map.reload.features.find { |f| f.properties["title"] == "Miradouro do Cabo Girão" }
      expect(pin.properties["marker-shape"]).to eq "pin"
      expect(pin.properties["marker-symbol"]).to be_nil
      expect(pin.properties["marker-image-url"]).to be_nil
      # a KMZ export leaves <IconStyle><color> out, the color comes from the style id
      expect(pin.properties["marker-color"]).to eq "#0288d1"
      expect(pin.properties["stroke"]).to eq "#ffffff"
      expect(pin.properties["marker-size"]).to eq 13
    end

    it "draws a packed icon with <IconStyle><color> on a circle in that color" do
      tinted = map.reload.features.find { |f| f.properties["title"] == "Pico Ruivo" }
      expect(tinted.properties["marker-symbol"]).to start_with "/image/"
      expect(tinted.properties["marker-image-url"]).to be_nil
      expect(tinted.properties["marker-color"]).to eq "#0f9d58"
      expect(tinted.properties["stroke"]).to eq "#ffffff"
      expect(tinted.properties["marker-size"]).to eq 13
    end

    it "imports a packed icon without a color as image" do
      photo = map.reload.features.find { |f| f.properties["title"] == "Porto Moniz" }
      expect(photo.properties["marker-symbol"]).to be_nil
      expect(photo.properties["marker-image-url"]).to start_with "/icon/"
      expect(photo.properties["marker-color"]).to eq "transparent"
      # the mapforge default size for an icon
      expect(photo.properties["marker-size"]).to eq 20
    end
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
