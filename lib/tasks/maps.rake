namespace :maps do
  desc "Take preview screenshots of updated maps"
  task screenshots: :environment do |_, args|
    base_url = ENV.fetch("MAPFORGE_HOST", "http://localhost:3000") + "/m/"

    # Verify MAPFORGE_HOST is reachable before processing maps
    uri = URI.parse(base_url)
    Net::HTTP.get_response(URI("#{uri.scheme}://#{uri.host}:#{uri.port}")) rescue abort "ERROR: MAPFORGE_HOST (#{base_url}) is not reachable: #{$!.message}"

    # https://github.com/rubycdp/ferrum
    # Launch browser once for all maps
    browser = Ferrum::Browser.new(headless: true, window_size: [ 800, 600 ], timeout: 90,
      browser_options: { "ignore-certificate-errors" => nil, "disable-features" => "ServiceWorker" })
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
        page = browser.create_page
        # Use private id, because map might be private
        map_url = base_url + ERB::Util.url_encode(map.private_id) + "?static=true&viewcount=false"

        puts "Loading #{map_url}"
        page.go_to(map_url)
        unless (200...400).cover?(page.network.status)
          puts "Failed to capture: #{map_url}, Status Code: #{page.network.status}"
          next
        end
        page.network.wait_for_idle(duration: 0.5, timeout: 30)
        { "map-loaded" => 45, "geojson-loaded" => 30, "map-idle" => 30 }.each do |attribute, timeout|
          deadline = Time.current + timeout
          until page.at_css("#maplibre-map[data-#{attribute}='true']")
            raise "Timeout waiting for data-#{attribute}" if Time.current > deadline
            sleep 0.2
          end
        end

        page.screenshot(path: map.screenshot_file, quality: 100)
        image = Rszr::Image.load(map.screenshot_file)
        image.resize!(600, :auto)
        image.save(map.screenshot_file, quality: 75)
        # Set file timestamps to match map's updated_at
        File.utime(map.updated_at.to_time, map.updated_at.to_time, map.screenshot_file)
        puts "Map preview stored at: #{map.screenshot_file}"
      rescue => e
        puts "Error creating map screenshot: #{e}, #{e.message}"
      ensure
        page&.close
      end
    end
  ensure
    browser&.quit
  end
end
