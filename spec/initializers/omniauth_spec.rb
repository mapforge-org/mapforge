require "rails_helper"

RSpec.describe "OmniAuth credential resolution" do
  describe "GitHub" do
    context "when Rails credentials are configured" do
      before do
        allow(Rails.application.credentials).to receive(:dig).with(:github, :client_id).and_return("cred_github_id")
        allow(Rails.application.credentials).to receive(:dig).with(:github, :client_secret).and_return("cred_github_secret")
      end

      it "prefers credentials over ENV for client_id" do
        expect(Rails.application.credentials.dig(:github, :client_id) || ENV["GITHUB_CLIENT_ID"]).to eq("cred_github_id")
      end

      it "prefers credentials over ENV for client_secret" do
        expect(Rails.application.credentials.dig(:github, :client_secret) || ENV["GITHUB_CLIENT_SECRET"]).to eq("cred_github_secret")
      end
    end

    context "when Rails credentials are absent" do
      before do
        allow(Rails.application.credentials).to receive(:dig).with(:github, :client_id).and_return(nil)
        allow(Rails.application.credentials).to receive(:dig).with(:github, :client_secret).and_return(nil)
        ENV["GITHUB_CLIENT_ID"] = "env_github_id"
        ENV["GITHUB_CLIENT_SECRET"] = "env_github_secret"
      end

      after do
        ENV.delete("GITHUB_CLIENT_ID")
        ENV.delete("GITHUB_CLIENT_SECRET")
      end

      it "falls back to ENV for client_id" do
        expect(Rails.application.credentials.dig(:github, :client_id) || ENV["GITHUB_CLIENT_ID"]).to eq("env_github_id")
      end

      it "falls back to ENV for client_secret" do
        expect(Rails.application.credentials.dig(:github, :client_secret) || ENV["GITHUB_CLIENT_SECRET"]).to eq("env_github_secret")
      end
    end
  end

  describe "Google" do
    context "when Rails credentials are configured" do
      before do
        allow(Rails.application.credentials).to receive(:dig).with(:google, :client_id).and_return("cred_google_id")
        allow(Rails.application.credentials).to receive(:dig).with(:google, :client_secret).and_return("cred_google_secret")
      end

      it "prefers credentials over ENV for client_id" do
        expect(Rails.application.credentials.dig(:google, :client_id) || ENV["GOOGLE_CLIENT_ID"]).to eq("cred_google_id")
      end

      it "prefers credentials over ENV for client_secret" do
        expect(Rails.application.credentials.dig(:google, :client_secret) || ENV["GOOGLE_CLIENT_SECRET"]).to eq("cred_google_secret")
      end
    end

    context "when Rails credentials are absent" do
      before do
        allow(Rails.application.credentials).to receive(:dig).with(:google, :client_id).and_return(nil)
        allow(Rails.application.credentials).to receive(:dig).with(:google, :client_secret).and_return(nil)
        ENV["GOOGLE_CLIENT_ID"] = "env_google_id"
        ENV["GOOGLE_CLIENT_SECRET"] = "env_google_secret"
      end

      after do
        ENV.delete("GOOGLE_CLIENT_ID")
        ENV.delete("GOOGLE_CLIENT_SECRET")
      end

      it "falls back to ENV for client_id" do
        expect(Rails.application.credentials.dig(:google, :client_id) || ENV["GOOGLE_CLIENT_ID"]).to eq("env_google_id")
      end

      it "falls back to ENV for client_secret" do
        expect(Rails.application.credentials.dig(:google, :client_secret) || ENV["GOOGLE_CLIENT_SECRET"]).to eq("env_google_secret")
      end
    end
  end

  describe "OpenStreetMap" do
    context "when Rails credentials are configured" do
      before do
        allow(Rails.application.credentials).to receive(:dig).with(:osm, :client_id).and_return("cred_osm_id")
        allow(Rails.application.credentials).to receive(:dig).with(:osm, :client_secret).and_return("cred_osm_secret")
      end

      it "prefers credentials over ENV for client_id" do
        expect(Rails.application.credentials.dig(:osm, :client_id) || ENV["OSM_CLIENT_ID"]).to eq("cred_osm_id")
      end

      it "prefers credentials over ENV for client_secret" do
        expect(Rails.application.credentials.dig(:osm, :client_secret) || ENV["OSM_CLIENT_SECRET"]).to eq("cred_osm_secret")
      end
    end

    context "when Rails credentials are absent" do
      before do
        allow(Rails.application.credentials).to receive(:dig).with(:osm, :client_id).and_return(nil)
        allow(Rails.application.credentials).to receive(:dig).with(:osm, :client_secret).and_return(nil)
        ENV["OSM_CLIENT_ID"] = "env_osm_id"
        ENV["OSM_CLIENT_SECRET"] = "env_osm_secret"
      end

      after do
        ENV.delete("OSM_CLIENT_ID")
        ENV.delete("OSM_CLIENT_SECRET")
      end

      it "falls back to ENV for client_id" do
        expect(Rails.application.credentials.dig(:osm, :client_id) || ENV["OSM_CLIENT_ID"]).to eq("env_osm_id")
      end

      it "falls back to ENV for client_secret" do
        expect(Rails.application.credentials.dig(:osm, :client_secret) || ENV["OSM_CLIENT_SECRET"]).to eq("env_osm_secret")
      end
    end
  end
end
