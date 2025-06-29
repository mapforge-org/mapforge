class ConditionalRackCache
  # This middleware conditionally applies Rack::Cache to specific paths.
  # It is useful for caching responses for certain routes while leaving others uncached.
  #
  # Note: Ensure you have the 'rack-cache' gem in your Gemfile:
  # gem 'rack-cache'
  #
  # For more information on Rack::Cache, see:
  # https://github.com/rack/rack-cache
  # rails sets "cache-control", "private" by default

  PATHS = [ "/icon/", "/image/" ]

  def initialize(app)
    @app = app
    @cache = Rack::Cache.new(app,
      verbose: true,
      etag: true,
      max_age: ImagesController::IMAGE_CACHE_TIME,
      metastore:   "file:tmp/cache/rack/meta",
      entitystore: "file:tmp/cache/rack/body"
    )
  end

  def call(env)
    if PATHS.any? { |path| env["PATH_INFO"].start_with?(path) }
      @cache.call(env)
    else
      @app.call(env)
    end
  end
end

Rails.application.config.middleware.insert_before Rack::Sendfile, ConditionalRackCache
