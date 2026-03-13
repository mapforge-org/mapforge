class GarminService
  AUTHORIZE_URL  = "https://connect.garmin.com/oauth-proxy/oauth/authorize"
  TOKEN_URL      = "https://connectapi.garmin.com/oauth-service/oauth/token"
  COURSES_URL    = "https://apis.garmin.com/wellness-api/rest/courses"

  # Generate a PKCE code_verifier / code_challenge pair.
  # Returns { verifier: String, challenge: String }
  def self.pkce_pair
    verifier  = SecureRandom.urlsafe_base64(64)
    digest    = OpenSSL::Digest::SHA256.digest(verifier)
    challenge = Base64.urlsafe_encode64(digest, padding: false)
    { verifier: verifier, challenge: challenge }
  end

  # Build the Garmin OAuth authorization URL to redirect the user to.
  def self.authorize_url(code_challenge:, state:, redirect_uri:)
    params = {
      response_type:         "code",
      client_id:             client_id,
      redirect_uri:          redirect_uri,
      code_challenge:        code_challenge,
      code_challenge_method: "S256",
      state:                 state
    }
    "#{AUTHORIZE_URL}?#{params.to_query}"
  end

  # Exchange an authorization code for an access token.
  # Returns the parsed JSON response (includes "access_token").
  def self.exchange_code(code:, code_verifier:, redirect_uri:)
    uri  = URI(TOKEN_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = Net::HTTP::Post.new(uri)
    req.basic_auth(client_id, client_secret)
    req.set_form_data(
      grant_type:    "authorization_code",
      code:          code,
      redirect_uri:  redirect_uri,
      code_verifier: code_verifier
    )

    res = http.request(req)
    raise GarminError, "Token exchange failed: #{res.code} #{res.body}" unless res.is_a?(Net::HTTPSuccess)

    JSON.parse(res.body)
  end

  # Upload a GPX string as a Course to Garmin Connect.
  # Returns the parsed JSON response from the Courses API.
  def self.upload_course(access_token:, gpx:, name:)
    uri  = URI(COURSES_URL)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    req = Net::HTTP::Post.new(uri)
    req["Authorization"] = "Bearer #{access_token}"
    req["Content-Type"]  = "application/gpx+xml"
    req["X-Course-Name"] = name.to_s.truncate(100)
    req.body = gpx

    res = http.request(req)
    raise GarminError, "Course upload failed: #{res.code} #{res.body}" unless res.is_a?(Net::HTTPSuccess)

    JSON.parse(res.body) rescue {}
  end

  def self.client_id
    ENV.fetch("GARMIN_CLIENT_ID")
  end

  def self.client_secret
    ENV.fetch("GARMIN_CLIENT_SECRET")
  end
end

class GarminError < StandardError; end
