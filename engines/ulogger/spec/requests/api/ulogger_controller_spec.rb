require "rails_helper"

RSpec.describe Api::UloggerController do
  describe "#auth" do
    subject { response }

    before { post "/ulogger/client/index.php", params: payload }

    let(:payload) { { action: "auth", pass: "supers3cr3t", user: "cwh" } }
    let(:response_body) { JSON.parse(response.body) }

    it { is_expected.to have_http_status(200) }
    it { expect(response_body["error"]).to be(false) }
  end

  describe "#addtrack" do
    subject { response }

    let(:response_body) { JSON.parse(response.body) }

    context "creating a new track" do
      before { post "/ulogger/client/index.php", params: payload }

      let(:payload) { { action: "addtrack", track: "ulogger track" } }

      it { is_expected.to have_http_status(200) }
      it { expect(response_body["error"]).to be(false) }

      it "returns a numeric id" do
        expect(response_body["trackid"]).to be > 0
        expect(response_body["trackid"]).to be < Api::UloggerController::JAVA_MAXINT
      end

      it "creates map in db with trackid" do
        expect(Map.find_by(private_id: response_body["trackid"])).not_to be_nil
      end

      it "sets map name" do
        expect(Map.find_by(private_id: response_body["trackid"]).name).to eq "ulogger track"
      end
    end

    context "using existing map" do
      before do
         post "/ulogger/client/index.php", params: payload
      end

      let(:map) { create(:map, private_id: 12345) }
      let(:payload) { { action: "addtrack", track: "#{map.private_id}#ulogger track2" } }

      it { is_expected.to have_http_status(200) }
      it { expect(response_body["error"]).to be(false) }

      it "uses existing map" do
        expect(response_body["trackid"]).to eq map.private_id.to_i
      end
    end

    context "using non-existing map id" do
      before do
         post "/ulogger/client/index.php", params: payload
      end

      let(:map) { create(:map, private_id: 12345) }
      let(:payload) { { action: "addtrack", track: "111#ulogger track2" } }


      it "errors on non-existing track id" do
        expect(response_body["message"]).to eq "Invalid trackid"
      end
    end
  end

  describe "#addpos" do
    subject { response }

    before do
      map
      post "/ulogger/client/index.php", params: payload
    end

    let(:map) { create(:map, private_id: trackid, name: 'ulogger') }
    let(:trackid) { 924977797 }
    let(:payload) {
      { action: "addpos", altitude: 374.29, speed: 4.3,
       provider: "network", trackid: trackid, accuracy: 16.113,
       lon: 11.1268342, time: 1717959606, lat: 49.4492029 }
    }
    let(:response_body) { JSON.parse(response.body) }

    it { is_expected.to have_http_status(200) }
    it { expect(response_body["error"]).to be(false) }

    it "creates new layer for track" do
      expect(map.reload.layers.count).to eq 2
      # no session["track_name"] is set, track layer will inherit map name
      expect(map.layers.geojson.select { |l| l.name == "ulogger" }.count).to eq 1
    end

    it "adds points into the new layer" do
      layer = map.reload.layers.geojson.find { |l| l.name == "ulogger" }
      expect(layer.features.point.count).to eq 1
    end

    it "adds point feature at coordinates" do
      expect(map.reload.features.point.count).to eq 1
      expect(map.reload.features.point.first.geometry["coordinates"])
        .to eq([ 11.1268342, 49.4492029, 374.29 ])
    end

    it "writes formatted metadata to the point's description" do
      expect(map.reload.features.point.first.properties["desc"])
        .to eq "- Altitude: 374.29 m\n- Speed: 15.5 km/h\n- Accuracy: 16.11 m\n- Provider: network"
    end

    it "sets comment as label" do
      payload = { action: "addpos", altitude: 374.29, speed: 4.3,
                 provider: "network", trackid: trackid, accuracy: 16.113,
                 lon: 11.1268342, time: 1717959606, lat: 49.4492029, comment: "Hey" }
      post "/ulogger/client/index.php", params: payload

      expect(map.reload.features.point.last.properties["label"]).to eq "Hey"
    end

    it "adds linestring feature at coordinates" do
      expect(map.reload.features.line_string.count).to eq 1
      expect(map.reload.features.line_string.first.geometry["coordinates"])
        .to eq([ [ 11.1268342, 49.4492029, 374.29 ] ])
    end

    it "hides points other than the last one" do
      post "/ulogger/client/index.php", params: payload

      expect(map.reload.features.point.count).to eq 2
      expect(map.reload.features.point.first.properties["marker-color"]).to eq("#f6f5f4")
    end

    context "with attached image file" do
      before do
        payload[:image] = fixture_file_upload("mapforge-logo-icon.png", "image/png", :binary)
      end

      it "saves the image to the database" do
        expect { post("/ulogger/client/index.php", params: payload) }.to change(Image, :count)
      end

      it "adds a marker-image-url to the point" do
        post("/ulogger/client/index.php", params: payload)
        expect(map.reload.features.point.last.properties["marker-image-url"]).not_to be_empty
      end
    end
  end
end
