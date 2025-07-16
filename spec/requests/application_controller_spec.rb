require 'rails_helper'

describe ApplicationController do
  describe '#sitemap' do
    subject(:res) { response }

    before { get "/sitemap.xml" }


    it 'returns success' do
      expect(res).to have_http_status(200)
    end
  end
end
