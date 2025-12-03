# Redirect urls are in format: /auth/google_oauth2/callback
Rails.application.config.middleware.use OmniAuth::Builder do
  provider :developer if Rails.env.local?
  # https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
  provider :github,
            ENV["GITHUB_CLIENT_ID"],
            ENV["GITHUB_CLIENT_SECRET"],
            scope: "user:email"
  provider :google_oauth2,
            ENV["GOOGLE_CLIENT_ID"],
            ENV["GOOGLE_CLIENT_SECRET"],
            prompt: "select_account"
end

OmniAuth.config.request_validation_phase = OmniAuth::AuthenticityTokenProtection.new
OmniAuth.config.logger = Rails.logger
