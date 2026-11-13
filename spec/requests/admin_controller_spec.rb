require "rails_helper"

describe AdminController do
  let(:admin) { create(:user, admin: true) }

  describe "#index" do
    before do
      sign_in(admin)
    end

    it "lists the private link of every map" do
      map = create(:map)
      get "/admin", params: { quick: "all" }
      expect(response.body).to include("/m/#{map.private_id}")
    end

    it "searches in map names" do
      create(:map, name: "Map1")
      create(:map, name: "Map2")
      get "/admin", params: { search: "Map1", quick: "all" }
      expect(response.body).to include("Map1")
      expect(response.body).not_to include("Map2")
    end

    context "with a quick filter" do
      before do
        create(:map, name: "Plain")
        create(:map, name: "Starred", tags: [ "featured" ])
        create(:map, name: "Listed", view_permission: "listed")
        create(:feature, :point, layer: create(:map, name: "Filled").layers.first)
      end

      { "featured" => "Starred", "public" => "Listed", "content" => "Filled" }.each do |quick, name|
        it "lists only the #{quick} maps" do
          get "/admin", params: { quick: quick }
          titles = Nokogiri::HTML(response.body).css(".map-card-title").map(&:text)
          expect(titles).to eq [ name ]
        end
      end

      it "keeps the search in the filter links" do
        get "/admin", params: { quick: "public", search: "x" }
        links = Nokogiri::HTML(response.body).css("#quick-filter a").map { |a| a["href"] }
        expect(links.first(2)).to eq [ "/admin?quick=all&search=x", "/admin?quick=featured&search=x" ]
      end

      it "shows the maps with content by default" do
        get "/admin"
        titles = Nokogiri::HTML(response.body).css(".map-card-title").map(&:text)
        expect(titles).to eq [ "Filled" ]
        expect(Nokogiri::HTML(response.body).at_css("#quick-filter .active").text).to include "With content"
      end

      it "counts all maps of every filter, whatever the search" do
        get "/admin", params: { search: "Plain" }
        counts = Nokogiri::HTML(response.body).css("#quick-filter .quick-count").map(&:text)
        expect(counts).to eq %w[4 1 1 1]
      end
    end
  end

  describe "#require_admin_user" do
    it "redirects a visitor to the login page" do
      get "/admin"
      expect(response).to redirect_to(login_path)
    end

    it "redirects a logged in non-admin to the login page" do
      user = create(:user)
      sign_in(user)
      get "/admin"
      expect(response).to redirect_to(login_path)
    end
  end
end
