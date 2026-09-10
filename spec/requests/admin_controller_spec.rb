require "rails_helper"

describe AdminController do
  let(:admin) { create(:user, admin: true) }

  describe "#index" do
    before do
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: admin.id })
    end

    it "lists the private link of every map" do
      map = create(:map)
      get "/admin"
      expect(response.body).to include("/m/#{map.private_id}")
    end

    it "searches in map names" do
      create(:map, name: "Map1")
      create(:map, name: "Map2")
      get "/admin", params: { search: "Map1" }
      expect(response.body).to include("Map1")
      expect(response.body).not_to include("Map2")
    end
  end

  describe "#require_admin_user" do
    it "redirects a visitor to the login page" do
      get "/admin"
      expect(response).to redirect_to(login_path)
    end

    it "redirects a logged in non-admin to the login page" do
      user = create(:user)
      allow_any_instance_of(ApplicationController).to receive(:session).and_return({ user_id: user.id })
      get "/admin"
      expect(response).to redirect_to(login_path)
    end
  end
end
