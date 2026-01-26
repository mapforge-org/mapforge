require 'rails_helper'

RSpec.describe Api::UloggerController do
  describe '#auth' do
    subject { response }

    before { post '/ulogger/client/index.php', params: payload }


    let(:payload) { { action: 'auth', pass: 'supers3cr3t', user: 'cwh' } }
    let(:response_body) { JSON.parse(response.body) }

    it { is_expected.to have_http_status(200) }
    it { expect(response_body['error']).to be(false) }
  end

  describe '#addtrack' do
    subject { response }

    before { post '/ulogger/client/index.php', params: payload }


    let(:payload) { { action: 'addtrack', track: 'ulogger track' } }
    let(:response_body) { JSON.parse(response.body) }

    it { is_expected.to have_http_status(200) }
    it { expect(response_body['error']).to be(false) }

    it 'returns a numeric id' do
      expect(response_body['trackid']).to be > 0
      expect(response_body['trackid']).to be < Api::UloggerController::JAVA_MAXINT
    end

    it 'creates map in db with 24 digits' do
      expect(Map.find_by(private_id: "%024d" % [ response_body['trackid'] ])).not_to be_nil
    end

    it 'sets map name' do
      expect(Map.find_by(private_id: "%024d" % [ response_body['trackid'] ]).name).to eq 'ulogger track'
    end
  end

  describe '#addpos' do
    subject { response }

    before do
      map
      post '/ulogger/client/index.php', params: payload
    end


    let(:map) { create(:map, private_id: "%024d" % [ trackid ]) }
    let(:trackid) { 924977797 }
    let(:payload) { { action: 'addpos', altitude: 374.29, speed: 4.3,
      provider: 'network', trackid: trackid, accuracy: 16.113,
      lon: 11.1268342, time: 1717959606, lat: 49.4492029 } }
    let(:response_body) { JSON.parse(response.body) }

    it { is_expected.to have_http_status(200) }
    it { expect(response_body['error']).to be(false) }

    it 'adds point feature at coordinates' do
      expect(map.reload.features.point.count).to eq 1
      expect(map.reload.features.point.first.geometry['coordinates']).
        to eq ([ 11.1268342, 49.4492029, 374.29 ])
    end

    it "writes formatted metadata to the point's description" do
      expect(map.reload.features.point.first.properties['desc']).
        to eq "- Altitude: 374.29 m\n- Speed: 15.5 km/h\n- Accuracy: 16.11 m\n- Provider: network"
    end

    it "sets comment as label" do
      payload = { action: 'addpos', altitude: 374.29, speed: 4.3,
        provider: 'network', trackid: trackid, accuracy: 16.113,
        lon: 11.1268342, time: 1717959606, lat: 49.4492029, comment: 'Hey' }
      post '/ulogger/client/index.php', params: payload

      expect(map.reload.features.point.last.properties['label']).to eq 'Hey'
    end

    it 'adds linestring feature at coordinates' do
      expect(map.reload.features.line_string.count).to eq 1
      expect(map.reload.features.line_string.first.geometry['coordinates']).
        to eq ([ [ 11.1268342, 49.4492029, 374.29 ] ])
    end

    it "hides points other than the last one" do
      post '/ulogger/client/index.php', params: payload

      expect(map.reload.features.point.count).to eq 2
      expect(map.reload.features.point.first.properties["marker-color"]).to eq("#f6f5f4")
    end

    context "with attached image file" do
      before do
        payload[:image] = fixture_file_upload('mapforge-logo-icon.png', 'image/png', :binary)
      end

      it "saves the image to the database" do
        expect { post('/ulogger/client/index.php', params: payload) }.to change(Image, :count)
      end

      it "adds a marker-image-url to the point" do
        post('/ulogger/client/index.php', params: payload)
        expect(map.reload.features.point.last.properties['marker-image-url']).not_to be_empty
      end
    end
  end
end
