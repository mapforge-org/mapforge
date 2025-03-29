require 'rails_helper'

describe HealthController do
  describe '#show' do
    subject(:response) { response }

    before { get "/up" }


    it 'returns success' do
      expect(response).to have_http_status(200)
    end
  end
end
