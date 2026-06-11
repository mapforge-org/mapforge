# frozen_string_literal: true

# Rack middleware to rewrite preview URLs from timestamped paths to physical files
# Converts: /previews/<timestamp>/<filename>.jpg -> /previews/<filename>.jpg
# This allows cache busting via URL path while keeping physical files simple
class PreviewUrlRewriter
  def initialize(app)
    @app = app
  end

  def call(env)
    request_path = env["REQUEST_PATH"] || env["PATH_INFO"]

    # Match pattern: /previews/<timestamp>/<filename>
    # Capture groups: timestamp (digits), filename (alphanumeric, dots, dashes, underscores)
    if request_path =~ %r{\A/previews/(\d+)/([\w.-]+\.jpg)\z}
      # timestamp = $1
      filename = $2

      # Rewrite the path to the physical file location
      env["REQUEST_PATH"] = "/previews/#{filename}"
      env["PATH_INFO"] = "/previews/#{filename}"

      # Optionally log the rewrite in development
      Rails.logger.debug "Preview URL rewrite: #{request_path} -> /previews/#{filename}" if Rails.env.development?
    end

    @app.call(env)
  end
end

# Insert before Rack::Sendfile so static file serving sees the rewritten path
# Rack::Sendfile handles serving static files from /public directory
Rails.application.config.middleware.insert_before Rack::Sendfile, PreviewUrlRewriter
