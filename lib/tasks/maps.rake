namespace :maps do
  desc "Take preview screenshots of updated maps"
  task screenshots: :environment do |_, args|
    base_url = ENV.fetch("MAPFORGE_HOST", "http://localhost:3000") + "/m/"

    # Verify MAPFORGE_HOST is reachable before processing maps
    uri = URI.parse(base_url)
    Net::HTTP.get_response(URI("#{uri.scheme}://#{uri.host}:#{uri.port}")) rescue abort "ERROR: MAPFORGE_HOST (#{base_url}) is not reachable: #{$!.message}"

    # puppeteer-ruby logs harmless CDP teardown errors ("Target Closed",
    # "No session with given id") straight to $stderr from background Async
    # fibers during page/browser close. They can't be caught or silenced via
    # config, so filter them out at the $stderr level for the task's duration.
    ignore = /Protocol error \((?:Runtime\.runIfWaitingForDebugger|Target\.detachFromTarget)\)/
    real_stderr = $stderr
    filtered = Object.new.tap do |io|
      io.define_singleton_method(:write) { |*a| a.any? { |s| s.to_s.match?(ignore) } ? 0 : real_stderr.write(*a) }
      io.define_singleton_method(:method_missing) { |name, *a, &b| real_stderr.send(name, *a, &b) }
      io.define_singleton_method(:respond_to_missing?) { |name, inc = false| real_stderr.respond_to?(name, inc) }
    end
    $stderr = filtered

    # https://github.com/YusukeIwaki/puppeteer-ruby
    # Launch browser once for all maps
    Puppeteer.launch(headless: true, ignore_https_errors: true, args: [ "--disable-features=ServiceWorker" ]) do |browser|
      Map.each do |map|
        last_update = File.mtime(map.screenshot_file) if File.exist?(map.screenshot_file)
        # Scheduled job is running each 10 minutes
        next if File.exist?(map.screenshot_file) && map.updated_at <= last_update

        if map.edit_permission == "private"
          puts "Skipping personal map (#{map.public_id}, #{map.name})"
          next
        end
        puts "Updating map (#{map.public_id}, #{map.name}) updated #{map.updated_at.getlocal}, last screenshot from #{last_update&.getlocal || "n/a"}"

        begin
          page = browser.new_page
          page.default_timeout = 90000
          # Use private id, because map might be private
          map_url = base_url + ERB::Util.url_encode(map.private_id) + "?static=true&viewcount=false"
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
          page.wait_for_selector("#maplibre-map[data-map-loaded='true']", timeout: 45000)
          page.wait_for_selector("#maplibre-map[data-geojson-loaded='true']", timeout: 30000)
          page.wait_for_selector("#maplibre-map[data-map-idle='true']", timeout: 30000)

          unless failure
            page.screenshot(path: map.screenshot_file, quality: 100)
            image = Rszr::Image.load(map.screenshot_file)
            image.resize!(600, :auto)
            image.save(map.screenshot_file)
            # Set file timestamps to match map's updated_at
            File.utime(map.updated_at.to_time, map.updated_at.to_time, map.screenshot_file)
            puts "Map preview stored at: #{map.screenshot_file}"
          end
        rescue => e
          puts "Error creating map screenshot: #{e}, #{e.message}"
        ensure
          if page
            # Unload page content so Chrome detaches sub-targets before close,
            # avoiding Puppeteer CDP "Target Closed" warnings
            page.goto("about:blank")
            page.close
          end
        end
      end
    end
  ensure
    $stderr = real_stderr if real_stderr
  end
end
