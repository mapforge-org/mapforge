require "capybara/cuprite"

# Generates the arguments to register chrome as capybara driver
#
# @param [TrueClass|FalseClass, #headless] switch to run in headless mode
# @return [Hash] all keyword arguments needed by capybara to register the driver.
def chrome_driver_arguments(headless: false)
  options = Selenium::WebDriver::Chrome::Options.new
  options.args << '--window-size=1024,860'
  options.args << '--lang=en_US'
  options.args << '--enable-logging'
  options.args << '--disable-blink-features=AutomationControlled'
  options.args << '--disable-background-networking'
  options.args << '--disable-default-apps'
  options.args << '--disable-extensions'
  options.args << '--disable-sync'
  options.args << '--disable-translate'
  options.args << '--metrics-recording-only'
  options.args << '--no-first-run'
  options.args << '--safebrowsing-disable-auto-update'
  options.args << '--disable-client-side-phishing-detection'
  options.args << '--disable-component-update'
  options.args << '--disable-domain-reliability'
  options.args << '--disable-features=NetworkService,NetworkServiceInProcess'
  options.args << '--disable-popup-blocking'
  options.args << '--disable-renderer-backgrounding'
  options.args << '--ignore-certificate-errors'
  options.args << '--no-default-browser-check'

  if defined?(Billy)
    options.args << '--ignore-certificate-errors'
    options.args << '--proxy-server=' + "#{Billy.proxy.host}:#{Billy.proxy.port}" if defined?(Billy)
  end

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

Capybara.register_driver(:cuprite) do |app|
  Capybara::Cuprite::Driver.new(app, window_size: [ 1024, 860 ],
                                     headless: 'new',
                                     process_timeout: 20,
                                     js_errors: true,
                                     logger: StringIO.new,
                                     browser_options: { 'no-sandbox': nil })
end

# https://github.com/rubycdp/cuprite
Capybara.javascript_driver = :cuprite


Capybara.default_driver = Capybara.javascript_driver
Capybara::Screenshot.autosave_on_failure = true
# Start Puma silently
Capybara.server = :puma, { Silent: true }
