Mongoid.configure do
  target_version = "9.0"

  # Load Mongoid behavior defaults. This automatically sets
  # features flags (refer to documentation)
  config.load_defaults target_version

  # It is recommended to use config/mongoid.yml for most Mongoid-related
  # configuration, whenever possible, but if you prefer, you can set
  # configuration values here, instead:
  #
  #   config.log_level = :debug
  #
  # Note that the settings in config/mongoid.yml always take precedence,
  # whatever else is set here.
end

# Enable Mongo driver query cache for Rack
# Rails.application.config.middleware.use(Mongo::QueryCache::Middleware)

# Enable Mongo driver query cache for ActiveJob
# ActiveSupport.on_load(:active_job) do
#   include Mongo::QueryCache::Middleware::ActiveJob
# end

# Fail application boot if mongodb is not available
begin
  Mongoid.load!(File.join(Rails.root, "config", "mongoid.yml"))
  # skip test in asset precompilation
  return if ENV["SECRET_KEY_BASE_DUMMY"]
  # dbStats, not ping/isMaster: those are exempt from authentication, so they
  # succeed even when no credentials reach the server.
  Mongoid.client(:default).command({ dbStats: 1 })
rescue Mongo::Error::NoServerAvailable, Mongo::Auth::Unauthorized, Mongo::Error::OperationFailure => e
  puts "Could not connect to MongoDB. #{e.message}"
  exit 1
end

if Rails.env.development?
  Mongoid.logger = Logger.new($stdout)
  # Mongo::Logger.logger = Logger.new($stdout)
end
