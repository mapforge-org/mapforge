MiniMagick.configure do |config|
  config.timeout = 15 # number of seconds IM commands may take
  config.errors = true # raise errors non nonzero exit status
  config.warnings = false # forward warnings to standard error
  config.tmpdir = Dir.tmpdir # alternative directory for tempfiles
  config.logger = Rails.logger # where to log IM commands
  config.cli_prefix = nil # add prefix to all IM commands
  config.cli_env = {
    "MAGICK_MEMORY_LIMIT" => "128MiB",
    "MAGICK_MAP_LIMIT" => "64MiB",
    "MAGICK_FILTER" => "Triangle"
  } # environment variables to set for IM commands
  config.restricted_env = true # when true, block IM commands from accessing system environment variables other than those in cli_env
end

Rszr.autorotate = true
