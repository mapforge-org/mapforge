# Garmin Connect Developer Program, OAuth 2.0 PKCE. Garmin expects the client secret in the
# request body, not as basic auth.
GARMIN_CLIENT_OPTIONS = {
  site: "https://apis.garmin.com",
  authorize_url: "https://connect.garmin.com/oauth2Confirm",
  token_url: "https://diauth.garmin.com/di-oauth2-service/oauth/token",
  auth_scheme: :request_body
}.freeze

module OmniAuth
  module Strategies
    # Not a login provider: it links a Garmin account to the logged-in user, see SessionsController
    class Garmin < OmniAuth::Strategies::OAuth2
      option :name, "garmin"
      option :pkce, true
      option :client_options, GARMIN_CLIENT_OPTIONS
    end
  end
end

# Redirect urls are in format: /auth/google_oauth2/callback
Rails.application.config.middleware.use OmniAuth::Builder do
  provider :developer if Rails.env.local? || ENV["DEVELOPER_LOGIN_ENABLED"] == "true"
  # https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
  provider :github,
    ENV["GITHUB_CLIENT_ID"],
    ENV["GITHUB_CLIENT_SECRET"],
    scope: "user:email"
  provider :google_oauth2,
    ENV["GOOGLE_CLIENT_ID"],
    ENV["GOOGLE_CLIENT_SECRET"],
    prompt: "select_account"
  # https://www.openstreetmap.org/oauth2/applications
  provider :osm_oauth2, ENV["OSM_CLIENT_ID"], ENV["OSM_CLIENT_SECRET"]
  provider :garmin, ENV["GARMIN_CLIENT_ID"], ENV["GARMIN_CLIENT_SECRET"]
end

OmniAuth.config.request_validation_phase = OmniAuth::AuthenticityTokenProtection.new(key: :_csrf_token)
OmniAuth.config.logger = Rails.logger
