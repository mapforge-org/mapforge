if ENV["COVERAGE"] == "true"
  require "simplecov"
  # CI splits the suite over jobs. A single job covers only its own groups, so the
  # minimum applies to the merged report instead, see the coverage job in ci.yml.
  SimpleCov.minimum_coverage 100 unless ENV["CI_PART"]
  SimpleCov.start "rails" do
    enable_coverage :oneshot_line
    skip "app/jobs/application_job.rb"
    skip "lib/tasks"
  end
end

require "spec_helper"
ENV["RAILS_ENV"] ||= "test"
ENV["DEFAULT_MAP"] = "test"
# The routing UI only renders when an ORS key exists, see Map.provider_keys
ENV["OPENROUTESERVICE_KEY"] ||= "test"

require_relative "../config/environment"
abort("The Rails environment is running in production mode!") if Rails.env.production?
require "rspec/rails"

require "database_cleaner/mongoid"
require "capybara-screenshot/rspec"
require "mongoid-rspec"
require "capybara_mock/rspec"
require "webmock/rspec"

# host-resolver-rules in spec/support/capybara.rb isolates Chrome. This isolates the Rails
# process the same way, so a missed stub fails loudly instead of reaching the real network.
# The Capybara server and the Chrome debug port both listen on localhost.
WebMock.disable_net_connect!(allow_localhost: true)

Rails.root.glob("spec/support/**/*.rb").sort.each { |f| require f }

# raise on js console errors
class JavaScriptError < StandardError; end

RSpec.configure do |config|
  config.use_active_record = false

  config.include Mongoid::Matchers, type: :model
  config.include FactoryBot::Syntax::Methods

  config.before(:suite) do
    # Drop rack cache responses
    FileUtils.rm_rf(Dir["tmp/cache/rack"])
  end

  config.around do |spec|
    DatabaseCleaner.cleaning do
      spec.run
    end
  end

  config.around(:each, :phone) do |spec|
    page.driver.browser.resize(width: 290, height: 523)
    spec.run
    page.driver.browser.resize(width: 1024, height: 860)
  end

  config.after(:each, type: :feature) do |spec|
    # https://danielabaron.me/blog/capture-browser-console-logs-capybara-cuprite/
    logger = page.driver.browser.options.logger
    console_logs = logger.string.lines.select { |line| line.include?("Runtime.consoleAPICalled") }
    error_logs = console_logs.select { |line| line.include?('"type":"error"') }

    # Clear the logger buffer to prevent errors from carrying over to subsequent tests,
    # also for :skip_console_errors specs
    logger.truncate(0)
    logger.rewind

    # Raise after clearing to ensure isolation even when test fails
    if error_logs.present? && !spec.metadata[:skip_console_errors]
      raise JavaScriptError, error_logs.join("\n\n")
    end
  end

  config.infer_spec_type_from_file_location!

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!
end
