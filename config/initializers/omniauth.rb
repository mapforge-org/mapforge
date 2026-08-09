# Redirect urls are in format: /auth/google_oauth2/callback
Rails.application.config.middleware.use OmniAuth::Builder do
  provider :developer if Rails.env.local? || ENV["DEVELOPER_LOGIN_ENABLED"] == "true"
  # https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
  provider :github,
    Rails.application.credentials.dig(:github, :client_id) || ENV["GITHUB_CLIENT_ID"],
    Rails.application.credentials.dig(:github, :client_secret) || ENV["GITHUB_CLIENT_SECRET"],
    scope: "user:email"
  provider :google_oauth2,
    Rails.application.credentials.dig(:google, :client_id) || ENV["GOOGLE_CLIENT_ID"],
    Rails.application.credentials.dig(:google, :client_secret) || ENV["GOOGLE_CLIENT_SECRET"],
    prompt: "select_account"
  # https://www.openstreetmap.org/oauth2/applications
  provider :osm_oauth2,
    Rails.application.credentials.dig(:osm, :client_id) || ENV["OSM_CLIENT_ID"],
    Rails.application.credentials.dig(:osm, :client_secret) || ENV["OSM_CLIENT_SECRET"]
end

OmniAuth.config.request_validation_phase = OmniAuth::AuthenticityTokenProtection.new(key: :_csrf_token)
OmniAuth.config.logger = Rails.logger
