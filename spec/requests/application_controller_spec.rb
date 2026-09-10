require "rails_helper"

describe ApplicationController do
  describe "#sitemap" do
    subject(:res) { response }

    before { get "/sitemap.xml" }

    it "returns success" do
      expect(res).to have_http_status(200)
    end
  end

  describe "#set_gettext_locale" do
    it "translates the page into a requested locale" do
      get root_path(locale: "de")
      expect(response.body).to include('lang="de"')
      expect(response.body).to include("Gestalte deine eigene Karte")
    end

    it "falls back to the default locale on an unknown locale" do
      get root_path(locale: "xx")
      expect(response.body).to include('lang="en"')
      expect(response.body).to include("Create your own map")
    end
  end
end
