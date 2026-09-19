require "rails_helper"

describe FrontpageController do
  describe "#index" do
    it "renders the frontpage" do
      expect(get("/")).to eq(200)
    end

    it "shows the frontpage description" do
      get "/"
      expect(response.body).to include("Create your own map")
    end

    it "offers the demo map, start a map and the gallery to a visitor" do
      get "/"
      expect(response.body).to include(">Demo map</button>")
      expect(response.body).to include(">Start a map</a>")
      expect(response.body).to include(">Browse the gallery</a>")
    end

    it "offers start a map and your maps to a logged in user" do
      user = create(:user)
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      get "/"
      expect(response.body).to include(">Start a map</button>")
      expect(response.body).to include(">Your maps</a>")
      expect(response.body).not_to include(">Browse the gallery</a>")
    end

    it "shows the three most viewed listed maps that have a screenshot" do
      create(:map, name: "Unlisted", view_permission: "link", view_count: 9)
      create(:map, name: "No screenshot", view_permission: "listed", view_count: 8)
      4.times { |i| create(:map, name: "Featured #{i}", view_permission: "listed", view_count: 7 - i) }
      allow_any_instance_of(Map).to receive(:screenshot) { |map| "/previews/1/#{map.public_id}.jpg" if map.name.start_with?("Featured") }
      get "/"
      expect(response.body).to include("Featured 0", "Featured 1", "Featured 2")
      expect(response.body).not_to include("Featured 3", "Unlisted", "No screenshot")
    end

    it "sends a default open graph image" do
      get "/"
      expect(response.body).to include('<meta content="http://www.example.com/images/map_list_preview.png" property="og:image">')
    end

    it "redirects a shared map url to the map" do
      get "/", params: { url: "https://www.example.com/m/abc" }
      expect(response).to redirect_to("/m/abc")
    end

    it "redirects a map url shared as text" do
      get "/", params: { text: "Look at this https://www.example.com/m/abc" }
      expect(response).to redirect_to("/m/abc")
    end

    it "keeps the query of a shared map url" do
      get "/", params: { url: "https://www.example.com/m/abc?nomenu=true" }
      expect(response).to redirect_to("/m/abc?nomenu=true")
    end

    it "ignores a shared url of another host" do
      expect(get("/", params: { url: "https://evil.example/x" })).to eq(200)
    end

    it "ignores a shared url without a path" do
      expect(get("/", params: { url: "https://www.example.com/" })).to eq(200)
    end

    it "ignores a shared url with a protocol relative path" do
      expect(get("/", params: { url: "https://www.example.com//evil.example/x" })).to eq(200)
    end

    it "ignores an unparsable shared url" do
      expect(get("/", params: { url: "https://www.example.com/[x" })).to eq(200)
    end
  end
end
