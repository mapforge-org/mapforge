require 'rails_helper'

describe HealthController do
  describe '#show' do
    subject(:res) { response }

    before { get "/up" }


    it 'returns success' do
      expect(res).to have_http_status(200)
    end
  end
end
