require "selenium-webdriver"
require_relative "../../spec/support/capybara.rb"

namespace :maps do
  desc "Take preview screenshots of updated maps"
  task screenshots: :environment do |_, args|
    base_url = ENV.fetch("MAPFORGE_HOST", "http://localhost:3000") + "/m/"

    Map.each do |map|
      begin
        last_update = File.mtime(map.screenshot_file) if File.exist?(map.screenshot_file)
        next if File.exist?(map.screenshot_file) && map.updated_at < last_update
        puts "Map #{map.public_id} updated #{map.updated_at}, last screenshot from #{last_update || 'n/a'}"

        # https://github.com/YusukeIwaki/puppeteer-ruby
        Puppeteer.launch(headless: true, ignore_https_errors: true) do |browser|
          context = browser.create_incognito_browser_context
          page = browser.new_page
          page.default_timeout = 90000
          map_url = base_url + map.public_id + "?static=true"
          failure = false

          page.on("response") do |response|
            status_code = response.status
            url = response.url
            unless status_code >= 200 && status_code < 400
              if url == map_url
                puts "Failed to capture: #{url}, Status Code: #{status_code}"
                failure = true
              end
            end
          end

          # page.on("console") { |response| puts "C: #{response.text}" }
          page.on("error") { |response| puts "E: #{response.text}" }

          page.viewport = Puppeteer::Viewport.new(width: 800, height: 600)
          puts "Loading #{map_url}"
          page.goto(map_url, wait_until: "networkidle0")
          page.wait_for_selector("#maplibre-map[map-loaded='true']", timeout: 30000)

          unless failure
            page.screenshot(path: map.screenshot_file, quality: 100)
            image = Rszr::Image.load(map.screenshot_file)
            image.resize!(400, :auto)
            image.save(map.screenshot_file)
            puts "Updated #{map.screenshot_file}"
          end
         browser.close
        end
      rescue => e
        puts "Error creating map screenshot: #{e}, #{e.message}"
      end
    end
  end
end
