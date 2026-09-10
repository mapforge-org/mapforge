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

    it "links to your maps and create for a logged in user" do
      user = create(:user)
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      get "/"
      expect(response.body).to include(">your maps</a>")
      expect(response.body).to include(">create</a>")
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
