require 'rails_helper'

RSpec.describe TracksController do
  describe '#redirect' do
    context 'redirect with id param' do
      subject { response }

      before { get "/ulogger/?id=#{id}" }


      let(:id) { '1234' }

      it 'returns 404 on invalid id' do
        get "/ulogger/?id=1234"
        expect(subject).to have_http_status(404)
      end

      it 'redirects to public map url' do
        Map.create(id: "000000000000000000001234")
        get "/ulogger/?id=1234"
        expect(subject).to have_http_status(302)
      end

      it 'highlights track' do
        create(:map, id: "000000000000000000001234", features: [create(:feature, :line_string)])

        get "/ulogger/?id=1234"
        expect(subject).to have_http_status(302)
      end
    end
  end
end
