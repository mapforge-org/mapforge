source "https://rubygems.org"
ruby "3.4.5"

gem "rails"

gem "sprockets-rails"
gem "puma"
gem "thruster" # https://github.com/basecamp/thruster

# Rails
gem "importmap-rails"
gem "turbo-rails"
gem "jbuilder"
gem "bootsnap", require: false
gem "rack-cache", require: "rack/cache"
gem "net-pop", github: "ruby/net-pop"

# login
gem "omniauth"
gem "omniauth-rails_csrf_protection"
gem "omniauth-github"
gem "omniauth-google-oauth2"

# Javascript
gem "gon"
gem "ostruct" # needed by 'gon', but not included in Ruby 3.5
gem "stimulus-rails"

# Databases
gem "redis", ">= 4.0.1"
gem "mongoid", ">= 9.0.2" # without version, bundler tries to install 8.1.6
gem "mongoid_rails_migrations"

# image uploads
# https://github.com/markevans/dragonfly (rdoc: https://rubydoc.info/github/markevans/dragonfly/)
# https://github.com/demersus/dragonfly-mongoid_data_store
gem "dragonfly"
gem "mini_magick"

gem "amazing_print"
gem "haml"
gem "redcarpet" # Markdown parser for docs

# taking screenshots with "rake maps:screenshots"
gem "capybara"
gem "capybara-screenshot"
gem "puppeteer-ruby"
gem "rszr"

# map + coordinates libraries
gem "rgeo"
gem "rgeo-geojson"
gem "rgeo-proj4"
gem "gpx"
# resolving request IP addresses to coordinates
gem "maxminddb"

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "byebug"
  gem "debug", platforms: %i[mri windows]
  gem "dotenv-rails", require: "dotenv/load"
  gem "listen"
  gem "mongo_logs_on_roids"
  gem "parallel_tests"
end

group :development do
  # Use console on exceptions pages [https://github.com/rails/web-console]
  gem "rubocop", require: false
  gem "rubocop-capybara", require: false
  gem "rubocop-performance", require: false
  gem "rubocop-rails", require: false
  gem "rubocop-rspec", require: false
  gem "rubocop-thread_safety", require: false
  gem "rubocop-rails-omakase", require: false
  gem "rubocop-rubycw"
  gem "rubycritic", require: false
  gem "brakeman"
  gem "bundler-audit"
  gem "hotwire-spark"

  gem "web-console"
  # Add speed badges [https://github.com/MiniProfiler/rack-mini-profiler]
  # gem "rack-mini-profiler" 
end

group :test do
  gem "factory_bot_rails"
  gem "rspec"
  gem "rspec-rails"
  gem "rspec-wait"
  gem "selenium-webdriver"
  gem "simplecov"
  gem "database_cleaner-mongoid"
  gem "mongoid-rspec"
  gem "puffing-billy"
  gem "table_print"
end
