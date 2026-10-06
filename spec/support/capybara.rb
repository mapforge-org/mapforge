require "capybara/cuprite"

# == Configure Capybara
Capybara.configure do |config|
  config.default_max_wait_time = 30
  config.match = :one
  config.ignore_hidden_elements = true
  config.visible_text_only = true
  config.disable_animation = true
  config.default_selector = :css
  config.server_port = 7787 + ENV.fetch("TEST_ENV_NUMBER", "0").to_i
end

# == Register Capybara Drivers

Capybara.register_driver(:cuprite) do |app|
  Capybara::Cuprite::Driver.new(app, window_size: [ 1024, 860 ],
    headless: "new",
    # The first browser call of a process launches Chrome. On the CI runner both parallel
    # processes launch it at once, and a cold start then took longer than 30 seconds.
    process_timeout: 60,
    # Every example resets the browser, so the next one waits for a fresh tab. Ferrum gives
    # Chrome 5 seconds for that, which a loaded machine misses: parallel_rspec runs two
    # browsers, and then Ferrum::NoSuchTargetError fails the example before it starts.
    protocol_timeout: 30,
    # visit waits until every request of the page completes. A map page in rw mode loads more
    # than 100 modules, and on a loaded machine that took longer than the default 5 seconds.
    timeout: 10,
    js_errors: true,
    logger: StringIO.new,
    # Specs must not depend on the network. Chrome resolves no host but the Capybara server,
    # so a slow CDN cannot time out a spec. CapybaraMock intercepts before name resolution,
    # so stub_request still answers external urls. See spec/features/network_isolation_spec.rb
    browser_options: { "no-sandbox": nil,
                      "host-resolver-rules": "MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
                      "download.default_directory": Capybara.save_path })
end

# Ferrum dispatches CDP events on one thread without a rescue, so a callback that raises kills
# it. No event reaches Ruby after that, and every following example fails with
# Ferrum::NoSuchTargetError once protocol_timeout expires. Callbacks do issue synchronous
# commands (Page.getFrameTree, Target.detachFromTarget for the service worker), and those
# time out on a loaded machine.
module FerrumSubscriberRescue
  private

  def call(message)
    super
  rescue StandardError => e
    warn "Ferrum event callback raised #{e.class}: #{e.message}"
  end
end
Ferrum::Client::Subscriber.prepend(FerrumSubscriberRescue)

# Cuprite's reset disposes the browser context, and Chrome's HTTP cache with it, so every example
# downloaded the 100+ modules of a map page again. Swap only the page instead: a new page drops
# its request handlers (CapybaraMock), headers and scripts, while the context keeps the cache.
# Cookies and storage live in the context, so clear them explicitly.
module CupriteKeepCacheOnReset
  STORAGE_TYPES = "local_storage,session_storage,indexeddb,service_workers,cache_storage"

  def reset
    return super unless reusable_context?

    old_page = @page
    origin = targets[old_page.target_id].url.to_s[%r{\Ahttps?://[^/]+}]
    old_page.command("Storage.clearDataForOrigin", origin:, storageTypes: STORAGE_TYPES) if origin
    command("Storage.clearCookies", browserContextId: default_context.id)
    @options.reset_window_size
    @page = attach_page(default_context.create_target.id)
    old_page.close
  end

  private

  def reusable_context?
    @page.is_a?(Ferrum::Page) && targets[@page.target_id] && targets.values.count(&:page?) == 1
  end
end
Capybara::Cuprite::Browser.prepend(CupriteKeepCacheOnReset)

# https://github.com/rubycdp/cuprite
Capybara.javascript_driver = :cuprite

Capybara.default_driver = Capybara.javascript_driver
Capybara::Screenshot.autosave_on_failure = true
Capybara.save_path = Rails.root.join("tmp/capybara_downloads")

# Start Puma silently
# Capybara's default of 4 threads queues the module requests of a map page
Capybara.server = :puma, { Silent: true, Threads: "0:8" }

# Chrome derives Accept-Language/navigator.language from the OS locale (LANG/LC_ALL),
# not from --lang, so tests would otherwise depend on the machine's locale.
# `browser.reset` between examples rebinds the page, so this must be reapplied every example.
RSpec.configure do |config|
  config.before(:each, type: :feature) do
    page.driver.headers = { "Accept-Language" => "en-US,en;q=0.9" }
  end
end
