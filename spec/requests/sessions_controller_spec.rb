require "rails_helper"

describe SessionsController do
  describe "#new" do
    it "shows the login options" do
      get login_path
      expect(response.body).to include("Developer Login")
    end
  end

  describe "#developer" do
    it "shows the user info form" do
      post "/auth/developer/login"
      expect(response.body).to include("User Info")
    end
  end

  describe "#create" do
    def developer_login(name: "Test User", email: "test@mapforge.org")
      get "/auth/developer/callback", params: { name: name, email: email }
    end

    it "creates the user and redirects to the map list" do
      developer_login
      expect(response).to redirect_to(my_path)
      expect(User.count).to eq 1
      expect(User.first.email).to eq "test@mapforge.org"
    end

    it "makes the first user an admin" do
      developer_login
      expect(User.first).to be_admin
    end

    it "reuses the account on a second login" do
      developer_login
      developer_login
      expect(User.count).to eq 1
    end

    it "starts a session that grants access to the own map list" do
      developer_login
      get my_path
      expect(response).to have_http_status(:ok)
    end
  end

  describe "#logout" do
    it "destroys the session" do
      get "/auth/developer/callback", params: { name: "Test User", email: "test@mapforge.org" }

      get logout_path
      expect(response).to redirect_to(root_path)

      get my_path
      expect(response).to redirect_to(login_path)
    end
  end
end
