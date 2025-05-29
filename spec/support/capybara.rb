# == Define helpers

# Generates the arguments to register chrome as capybara driver
#
# @param [TrueClass|FalseClass, #headless] switch to run in headless mode
# @return [Hash] all keyword arguments needed by capybara to register the driver.
def chrome_driver_arguments(headless: false)
  options = Selenium::WebDriver::Chrome::Options.new
  options.args << '--window-size=1024,860'
  options.args << '--lang=en_US'
  options.args << '--enable-logging'

  options.logging_prefs = {
    browser: 'ALL', # Capture all JavaScript errors
    driver: 'SEVERE' # Capture severe WebDriver errors
  }

  if headless
    options.args << '--headless'
    options.args << '--no-sandbox' # http://chromedriver.chromium.org/help/chrome-doesn-t-start
    options.args << '--disable-gpu'
  end

  {
    browser: :chrome, options:, timeout: 600
  }
end

# == Configure Capybara
Capybara.configure do |config|
  config.default_max_wait_time = 30
  config.match = :one
  config.ignore_hidden_elements = true
  config.visible_text_only = true
  config.disable_animation = true
  config.default_selector = :css
  config.server_port = 7787 + ENV.fetch('TEST_ENV_NUMBER', '0').to_i
end

# == Register Capybara Drivers

# ++ Browser Driver
Capybara.register_driver :chrome do |app|
  Capybara::Selenium::Driver.new(app, **chrome_driver_arguments(headless: false))
end

Capybara.register_driver :headless_chrome do |app|
  Capybara::Selenium::Driver.new(app, **chrome_driver_arguments(headless: true))
end

Capybara.javascript_driver = :headless_chrome

# Register our custom driver name. otherwise 'screenshot_failed_tests' would fail
# see https://github.com/mattheworiordan/capybara-screenshot/issues/84#issuecomment-41219326
Capybara::Screenshot.register_driver(Capybara.javascript_driver) do |driver, path|
  driver.browser.save_screenshot(path)
end

Capybara.default_driver = Capybara.javascript_driver
# Start Puma silently
Capybara.server = :puma, { Silent: true }
