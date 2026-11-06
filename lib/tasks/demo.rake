namespace :demo do
  desc "Draw on an existing map in three scenes, for screen recording (Elba, La Zanca)"
  task :draw, [ :private_id, :open_page, :start_recording ] => :environment do |_task, args|
    fps = 30
    pace = 0.75                                    # every cursor action runs 25% faster

    # Opening and closing shot: all three scenes in one frame
    wide_view = { center: [ 10.2734, 42.7854 ], zoom: 10.2, bearing: 0, pitch: 0 }

    # Scene 1: Cleo's hike across the mountains of Elba. The route is stored, so a recording needs
    # no ORS key. The stops cut its 9.3 km into three legs, and the zoom fits the widest one.
    hike = JSON.parse(Rails.root.join("lib/tasks/demo_hike.geojson").read).dig("features", 0)
    track = hike["geometry"]["coordinates"]
    stops = [ 0, 83, 224, track.size - 1 ]         # index of every waypoint inside track
    walk_view = { center: track.first.first(2), zoom: 14.2, bearing: 65, pitch: 65 }
    snake = track[203].first(2)
    snake_view = { center: [ 10.1625, 42.76452 ], zoom: 14.63, bearing: 0, pitch: 54 }

    # Scene 2: Ben maps the shore at Punta della Zanca, then the water in front of it
    shore_view = { center: [ 10.122640, 42.802750 ], zoom: 16.4, bearing: 122.7, pitch: 55 }
    sea_view = { center: [ 10.124200, 42.803900 ], zoom: 16.5, bearing: 150, pitch: 52 }
    beach = [ [ 10.121079, 42.802693 ], [ 10.121444, 42.802848 ],
              [ 10.121523, 42.802739 ], [ 10.121133, 42.802628 ] ]
    spots = [ [ [ 10.122646, 42.802339 ], "binoculars", "Punta della Zanca" ],
              [ [ 10.124150, 42.803180 ], "cliff_with_rocks", "Cliff" ] ]
    snorkel = [ [ 10.123676, 42.803444 ], "person_swimming_in_water", "Snorkeling" ]
    dive_sites = [
      [ [ [ 10.122952, 42.803489 ], [ 10.123967, 42.803615 ], [ 10.123987, 42.803415 ],
          [ 10.122878, 42.803213 ], [ 10.122475, 42.803199 ], [ 10.122022, 42.803068 ],
          [ 10.121423, 42.803003 ], [ 10.121755, 42.803182 ], [ 10.122270, 42.803290 ],
          [ 10.122795, 42.803376 ] ],
        "Posidonia meadow", "Sea bream, wrasse and sea urchins", "#2f9e44" ],
      [ [ [ 10.124158, 42.803901 ], [ 10.124355, 42.804035 ], [ 10.124860, 42.804149 ],
          [ 10.125415, 42.804082 ], [ 10.125561, 42.803866 ], [ 10.125500, 42.803700 ],
          [ 10.124955, 42.803406 ], [ 10.124244, 42.803430 ] ],
        "Rocky reef", "Octopus, moray eel and scorpionfish", "#0c8599",
        { "fill-pattern" => "cross" } ] ]
    wreck = [ 10.125209, 42.805112 ]

    # Scene 3: a house in La Zanca. Local metres, x along the long wall, y into the plot.
    # The vectors come from the real footprint of the building (16.3 m by 9.6 m).
    plot = [ 10.133649, 42.801642 ]
    along = [ 1.0804e-5, 4.235e-6 ]
    into  = [ 5.756e-6, -7.953e-6 ]
    at = ->(x, y) { [ plot[0] + along[0] * x + into[0] * y, plot[1] + along[1] * x + into[1] * y ] }
    rect = ->(x0, y0, x1, y1) {
      [ at.call(x0, y0), at.call(x1, y0), at.call(x1, y1), at.call(x0, y1) ]
    }
    house = rect.call(0, 0, 16.3, 9.6)
    garden = [ [ 10.133543, 42.801620 ], [ 10.133309, 42.802022 ],
               [ 10.133702, 42.802142 ], [ 10.133888, 42.801750 ] ]
    parking = [ [ 10.133963, 42.801293 ], [ 10.134043, 42.801373 ], [ 10.134133, 42.801312 ],
                [ 10.134019, 42.801243 ], [ 10.133915, 42.801155 ], [ 10.133861, 42.801189 ] ]
    # From the parking, around the west side of the neighbour house, up to the door.
    drive = [ [ 10.133944, 42.801427, 150 ], [ 10.133929, 42.801451, 150 ],
              [ 10.133855, 42.801417, 150 ], [ 10.133726, 42.801558, 150 ],
              [ 10.133910, 42.801632, 150 ], [ 10.133872, 42.801681, 138 ] ]
    garden_spot = [ 10.133465, 42.801623 ]
    # The neighbour house, from its real footprint in OpenStreetMap (way 169710115).
    annex = [ [ 10.1339432, 42.8015571 ], [ 10.1339970, 42.8015012 ],
              [ 10.1338775, 42.8014393 ], [ 10.1338237, 42.8014952 ] ]
    house_view = { center: [ 10.134938, 42.801694 ], zoom: 17.34, bearing: 15.4, pitch: 40 }

    private_id = args[:private_id] || begin
      print "Private map id (browser should be open): "
      $stdin.gets.to_s.strip
    end
    map = Map.find_by(private_id: private_id)
    abort "No map with private_id #{private_id}" unless map
    # Printed before the slow setup below, so the page is open by the time the first
    # broadcast goes out. A cursor is a broadcast, so it needs a connected client.
    map_url = "#{ENV.fetch("MAPFORGE_HOST", "http://localhost:3000")}/m/#{map.private_id}?fps=30"
    puts "Open #{map_url}"

    hiker  = { uuid: "demo-hiker", name: "Cleo", image: "/images/frontpage/avatar2.jpeg" }
    scout  = { uuid: "demo-scout", name: "Ben", image: "/images/frontpage/avatar3.jpeg" }
    artist = { uuid: "demo-artist", name: "Ada", image: "/images/frontpage/avatar1.jpeg" }

    # Reuse the layers instead of recreating them. A destroyed layer makes every open client
    # redraw the whole basemap, which races with the new layer's source and swallows the
    # features that follow (they only appear after a reload).
    [ hiker, scout, artist ].each do |cursor|
      cursor[:layer] = map.layers.find_or_create_by!(name: cursor[:name], type: "geojson")
      cursor[:layer].features.destroy_all
    end

    add_sticker = -> {
      hiker[:layer].features.create!(
        geometry: { "type" => "Point", "coordinates" => wide_view[:center] },
        properties: { "title" => "Mapforge", "marker-image-url" => "/logo/sticker/mapforge-sticker.png",
                      "marker-size" => 9, "marker-opacity" => 0.85 })
    }
    sticker = add_sticker.call

    # The opening shot is stored on the map itself, so a fresh page load already shows the
    # wide view. An open page gets the same view broadcast below.
    map.update!(center: wide_view[:center], zoom: wide_view[:zoom],
                pitch: wide_view[:pitch], bearing: wide_view[:bearing])

    # Store the photos the way ImagesController#upload does, so the markers point at a
    # stored image. Done before the recording starts, because compression is slow.
    store_photo = ->(path) {
      filename = "#{File.basename(path, ".*")}-#{File.size(path)}.webp"
      Image.find_by(public_id: filename) || begin
        tempfile = Tempfile.new([ "demo-", File.extname(path) ])
        tempfile.binmode
        tempfile.write(File.binread(path))
        tempfile.flush
        Image.compress_to_webp!(tempfile.path)
        uid = Dragonfly.app.store(tempfile, "name" => filename)
        Image.create!(img_uid: uid, public_id: filename)
      end
    }
    photos = %w[coast.jpg photo2.jpeg summit.jpg dorf.jpg].map do |file|
      store_photo.call(Rails.root.join("public/images/frontpage/#{file}"))
    end
    utm = "utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText"
    photo_credit = ->(slug) {
      %(Foto von <a href="https://unsplash.com/de/@dariobroe?#{utm}">Dario Brönnimann</a> auf ) +
        %(<a href="https://unsplash.com/de/fotos/#{slug}?#{utm}">Unsplash</a>)
    }
    credits = [ "meereswellen-die-tagsuber-auf-felsen-sturzen-debHhXOUpLc", nil,
                "gelbe-seilbahn-tagsuber-uber-grune-baume-und-berge-W3XMVQQOdIM",
                "grune-und-weisse-betonhauser-tagsuber-y8OUdheztII" ]  # one entry per photo

    stream = "map_channel_#{map.public_id}"
    fly = ->(view, wait = 2.5) {
      ActionCable.server.broadcast(stream, { event: "fly_to" }.merge(view))
      sleep wait                                   # the client flies for 2 seconds
    }
    move = ->(cursor, lng, lat) {
      ActionCable.server.broadcast(stream, { event: "mouse", uuid: cursor[:uuid],
        user_name: cursor[:name], user_image: cursor[:image], lng: lng, lat: lat })
      cursor[:at] = [ lng, lat ]
    }
    glide = ->(cursor, to, seconds) {
      from = cursor[:at] || to
      steps = [ (seconds * pace * fps).round, 1 ].max
      1.upto(steps) do |i|
        t = i.to_f / steps
        move.call(cursor, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t)
        sleep 1.0 / fps
      end
    }
    # Move the cursor along a polyline at a constant speed. The block gets the index of the
    # last polyline point that the cursor passed.
    follow = ->(cursor, coords, seconds, &on_step) {
      return if coords.size < 2
      cum = [ 0.0 ]
      coords.each_cons(2) { |a, b| cum << cum.last + Math.hypot(b[0] - a[0], b[1] - a[1]) }
      steps = [ (seconds * pace * fps).round, 1 ].max
      1.upto(steps) do |i|
        want = cum.last * i / steps
        j = [ cum.index { |d| d >= want } || cum.size - 1, 1 ].max
        span = cum[j] - cum[j - 1]
        t = span.zero? ? 1.0 : (want - cum[j - 1]) / span
        a, b = coords[j - 1], coords[j]
        move.call(cursor, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        on_step&.call(j - 1)
        sleep 1.0 / fps
      end
    }
    # Park the cursor about 40 px away from the point it just drew, so it stops covering it.
    # A pixel offset, because the three scenes end on different zoom levels.
    step_aside = ->(cursor, zoom) {
      degrees = 25 * 360.0 / (256 * 2**zoom)
      glide.call(cursor, [ cursor[:at][0] + degrees, cursor[:at][1] - degrees ], 0.5)
    }
    # Walk the points of a shape, growing the feature after every point. The block runs on
    # every point, which lets a caller animate something else while the cursor draws.
    trace = ->(cursor, points, properties, ring: true, &on_point) {
      feature = nil
      points.each_with_index do |point, i|
        glide.call(cursor, point, 0.3)
        sleep 0.1 * pace                             # pause on the point, reads as a click
        on_point&.call(i)
        next if i < (ring ? 2 : 1)                   # two points are not a ring
        drawn = points[0..i]
        geometry = if ring
          { "type" => "Polygon", "coordinates" => [ drawn + [ points[0] ] ] }
        else
          { "type" => "LineString", "coordinates" => drawn }
        end
        if feature
          feature.update!(geometry: geometry)
        else
          feature = cursor[:layer].features.create!(geometry: geometry, properties: properties)
        end
        sleep 0.08 * pace
      end
      feature
    }

    # Scene 1: Cleo walks the stored route and pins a photo on every waypoint.
    # The track grows under her cursor, so it is drawn while she moves.
    track_feature = nil
    track_properties = ->(upto) {
      hike["properties"].except("id").merge("title" => "Elba hike",
        "route" => hike["properties"]["route"].merge(
          "waypoints" => stops[0..upto].map { |stop| track[stop].first(2) }))
    }
    grow_track = ->(upto, waypoint) {
      return if upto < 1                             # one point is not a line
      geometry = { "type" => "LineString", "coordinates" => track[0..upto] }
      if track_feature
        track_feature.update!(geometry: geometry, properties: track_properties.call(waypoint))
      else
        track_feature = hiker[:layer].features.create!(geometry: geometry,
          properties: track_properties.call(waypoint))
      end
    }
    walk_scene = -> {
      sticker.destroy
      stops.each_with_index do |stop, i|
        if i.positive?
          from = stops[i - 1]
          leg = track[from..stop]
          # The camera leaves just before Cleo. Each 2s flight covers half of the leg, the first
          # one to its middle, the second one to the next waypoint, so it keeps pace with her.
          fly.call(walk_view.merge(center: leg[leg.size / 2].first(2)), 0.2)
          drawn = Time.now
          ahead = false
          follow.call(hiker, leg, 5.5) do |j|
            if !ahead && j >= leg.size / 2
              ahead = true
              fly.call(walk_view.merge(center: leg.last.first(2)), 0)
            end
            next if Time.now - drawn < 0.25          # one write every 0.25s, not every frame
            drawn = Time.now
            grow_track.call(from + j, i)
          end
          grow_track.call(stop, i)                   # snap the end onto the waypoint
        end
        photo = photos[i % photos.size]
        desc = "[![image](/image/#{photo.public_id})](/image/#{photo.public_id})\n"
        desc += "\n#{photo_credit.call(credits[i])}\n" if credits[i]
        # Below zoom 14 a half size copy takes over, so the photos stay in the wide view.
        # Both zoom filters include their limit, so the copy ends just below it.
        [ { "marker-size" => 22, "min-zoom" => 14 }, { "marker-size" => 11, "max-zoom" => 13.99 } ].each do |size|
          hiker[:layer].features.create!(
            geometry: { "type" => "Point", "coordinates" => track[stop].first(2) }, image: photo,
            properties: size.merge("title" => "Photo #{i + 1}",
                                   "marker-image-url" => "/icon/#{photo.public_id}",
                                   "desc" => desc))
        end
        if i == 2
          hiker[:layer].features.create!(
            geometry: { "type" => "Point", "coordinates" => snake },
            properties: { "desc" => "#### Saw a snake here!", "show-desc" => "bubble",
                          "marker-shape" => "pin", "marker-symbol" => "🐍",
                          "marker-color" => "#5c940d", "marker-size" => 24,
                          "marker-scaling" => true })
          fly.call(snake_view)
        end
        # Hold on the waypoint, long enough for the camera to settle on it. The client only
        # fetches a marker image when MapLibre renders the marker and misses it
        # (setMissingStyleImageResolver). Fly away at once and the fetch never starts, so the
        # photo stays invisible for the rest of the recording. This wait does not follow pace.
        # The last waypoint needs none, because the closing hold of the scene covers it.
        sleep 0.9 unless i == stops.size - 1
      end
    }

    # Scene 2: Ben marks the beach, the nature points around it, and the dive sites offshore.
    shore_scene = -> {
      trace.call(scout, beach, { "title" => "Spiaggia della Zanca", "fill" => "#f6c453",
                                 "fill-opacity" => 0.5, "label" => "Beach" })
      sleep 0.3
      pin = ->(point, icon, title) {
        glide.call(scout, point, 0.6)
        sleep 0.2
        scout[:layer].features.create!(
          geometry: { "type" => "Point", "coordinates" => point },
          properties: { "title" => title, "marker-symbol" => "/icon-sets/pinhead/#{icon}.png",
                        "marker-color" => "#1971c2", "marker-size" => 14,
                        "label" => title, "min-zoom" => 14 })
        sleep 0.3
      }
      spots.each { |spot| pin.call(*spot) }
      fly.call(sea_view)
      dive_sites.each_with_index do |(ring, title, animals, color, extra), i|
        trace.call(scout, ring, { "title" => title, "desc" => animals, "stroke" => color,
                                  "fill" => color, "fill-opacity" => 0.35,
                                  "label" => animals, "label-title" => title,
                                  "label-size" => 11 }.merge(extra.to_h))
        sleep 0.3
        pin.call(*snorkel) if i.zero?
      end
      glide.call(scout, wreck, 0.6)
      sleep 0.2
      scout[:layer].features.create!(
        geometry: { "type" => "Point", "coordinates" => wreck },
        properties: { "title" => "Shipwreck", "marker-scaling" => true,
                      "desc" => "Steel hull at 22 m, groupers inside\n\n" \
                                "<img src=\"/images/frontpage/shipwreck.jpg\" width=\"150\">\n",
                      "marker-color" => "#000000", "stroke" => "transparent",
                      "show-desc" => "banner", "marker-size" => 8,
                      "marker-symbol" => "/icon-sets/fontawesome/ship.png" })
    }

    # Scene 3: Ada maps the plot around two houses, then raises both into 3D.
    wall = { "stroke" => "#495057", "stroke-width" => 3, "fill" => "transparent" }
    house_scene = -> {
      outline = trace.call(artist, house, wall.merge("title" => "Casa La Zanca"))
      sleep 0.3
      annex_outline = trace.call(artist, annex, wall.merge("title" => "Casa Piccola"))
      sleep 0.3
      # The walls take their colour from 'fill'. It stays transparent while the outline is
      # traced, because the flat polygon only renders until the extrusion height is set.
      risers = [ [ outline, 9 ], [ annex_outline, 6 ] ]
      steps = garden.size + 1
      risen = 0
      rise = -> {
        risen += 1
        risers.each do |feature, height|
          feature.update!(properties: feature.properties.merge(
            "fill-extrusion-height" => (height * risen / steps.to_f).round(2), "fill" => "#e5a50a",
            "fill-extrusion-opacity" => 0.7))
        end
      }
      # Both houses grow one step per garden point, so they are still rising while Ada draws.
      add_sticker.call
      rise.call
      trace.call(artist, garden, { "title" => "Garden", "stroke" => "#5c940d",
                                   "fill" => "transparent", "fill-opacity" => 1,
                                   "fill-image-url" => "/images/frontpage/garden.jpg",
                                   "label" => "Garden", "label-size" => 12 }) { rise.call }
      sleep 0.3
      trace.call(artist, parking, { "title" => "Parking", "stroke" => "#868e96",
                                    "fill" => "#dee2e6", "fill-opacity" => 0.6,
                                    "label" => "Parking", "label-size" => 11 })
      sleep 0.3
      trace.call(artist, drive, { "title" => "Driveway", "stroke" => "#63452c",
                                  "stroke-width" => 1, "fill-extrusion-height" => 1 }, ring: false)
      sleep 0.3
      glide.call(artist, garden_spot, 0.5)
      sleep 0.2
      artist[:layer].features.create!(
        geometry: { "type" => "Point", "coordinates" => garden_spot },
        properties: { "title" => "Terrace", "marker-symbol" => "/icon-sets/pinhead/picnic_table.png",
                      "marker-color" => "#5c940d", "marker-size" => 14,
                      "label" => "Terrace", "min-zoom" => 14 })
    }

    scenes = [ [ walk_view, walk_scene, hiker, track[stops.first].first(2) ],
               [ shore_view, shore_scene, scout, beach.first ],
               [ house_view, house_scene, artist, house.first ] ]
    # demo:record opens its page here: the map data is complete, so no new layer reaches an open page.
    args[:open_page]&.call(map_url)
    # demo:record flies the whole route first, so the recording finds the tiles in the cache. Ground
    # without tiles shows as black patches. The long flight from the hike to the beach takes 10s,
    # because MapLibre cancels the tile requests of a fast flight.
    if args[:start_recording]
      legs = stops.each_cons(2).flat_map do |from, to|
        leg = track[from..to]
        [ leg[leg.size / 2], leg.last ].map { |point| walk_view.merge(center: point.first(2)) }
      end
      route = [ walk_view, *legs.insert(4, snake_view), shore_view, sea_view, house_view, wide_view ]
      route.each do |view|
        seconds = view == shore_view ? 10 : 2
        fly.call(view.merge(duration: seconds * 1000), seconds)
      end
    end
    # A page that was already open kept its own view, and a stored view only reaches it when
    # nobody touched the map. Broadcast the opening shot instead. The recorder is not running yet.
    fly.call(wide_view)
    # All three cursors wait on the wide view, so the opening frame is already complete and
    # the camera always flies towards a visible person.
    scenes.each { |_view, _scene, cursor, start| move.call(cursor, *start) }

    if args[:start_recording]
      args[:start_recording].call
    else
      print "Start the recorder, then press Enter: "
      $stdin.gets
    end

    fly.call(scenes.first.first, 1.6)              # the first scene starts 0.4s before the camera lands
    scenes.each_with_index do |(view, scene, cursor, _start), n|
      scene.call
      # The cursor leaves the last marker at once. The hold comes after it, not before.
      step_aside.call(cursor, view[:zoom])
      sleep 0.5
      # The next person starts to draw the moment the camera leaves, so the whole 2s turn
      # lands on somebody who is already at work. Ada starts even earlier: the camera waits
      # a second, so the turn onto the plot finds the first walls already there. The delay
      # runs in a thread, because the scene below blocks until it is finished.
      next_scene = scenes[n + 1]
      if next_scene
        lead = next_scene[2] == artist ? 1.0 : 0
        Concurrent::ScheduledTask.execute(lead) { fly.call(next_scene.first, 0) }
      end
    end
    sleep 1.0                                      # the rest of the hold on the last scene
    track_feature.update!(properties: track_properties.call(stops.size - 1).merge("stroke-width" => 4))
    fly.call(wide_view, 3.0)
    # The three cursors stay on the work they just did, so the closing frame shows who made what.
    [ [ hiker, track[track.size / 2].first(2) ],
      [ scout, sea_view[:center] ],
      [ artist, house_view[:center] ] ].each { |cursor, spot| glide.call(cursor, spot, 0.6) }
    sleep 2.0

    puts "Done: /m/#{map.private_id}"
  end

  desc "Record demo:draw to tmp/demo.mp4. Needs a running server on MAPFORGE_HOST, Chrome and ffmpeg"
  task record: :environment do
    frames_dir = Rails.root.join("tmp/demo_frames")
    FileUtils.rm_rf(frames_dir)
    frames_dir.mkpath
    map = Map.create!(name: "Frontpage demo", base_map: "satelliteStreets", terrain: true)
    # H.264 needs an even height, so the view is 436 and not 435
    browser = Ferrum::Browser.new(headless: false, window_size: [ 700, 436 ], timeout: 90)
    browser.set_viewport(width: 700, height: 436, scale_factor: 2)
    frames = []

    open_page = ->(url) {
      # The public url shows no login warning. ?static=true would hide everything, but a static
      # page opens no websocket, and ?nocontrols=true keeps the title and attribution.
      browser.go_to("#{url.sub(map.private_id, map.public_id)}&nocontrols=true")
      browser.add_style_tag(content: "#map-head, #status-container, .maplibregl-ctrl-attrib { display: none }")
      # The same wait as maps:screenshots, plus data-online for the websocket
      %w[map-loaded geojson-loaded map-idle online].each do |attribute|
        deadline = Time.current + 60
        until browser.at_css("#maplibre-map[data-#{attribute}='true']")
          abort "Timeout waiting for data-#{attribute}" if Time.current > deadline
          sleep 0.2
        end
      end
    }
    start_recording = -> {
      browser.page.start_screencast(format: :jpeg, quality: 90) do |data, _metadata, _session|
        name = format("%06d.jpg", frames.size)
        File.binwrite(frames_dir.join(name), Base64.decode64(data))
        frames << [ name, Time.now.to_f ]
      end
      sleep 1.5                                    # the opening hold, with the sticker in view
    }

    Rake::Task["demo:draw"].invoke(map.private_id, open_page, start_recording)
    browser.page.stop_screencast
    abort "Chrome sent no frames" if frames.empty?

    times = frames.map(&:last) << Time.now.to_f
    holds = times.each_cons(2).map { |from, to| to - from }
    # Chrome sends a frame only when the page changes, and ffmpeg holds a frame until the time of
    # the next file. These copies cover the closing hold. It takes two, because ffmpeg adds the
    # gap before the last frame once more at the end.
    2.times { |i| FileUtils.cp(frames_dir.join(frames.last.first), frames_dir.join(format("%06d.jpg", frames.size + i))) }

    # The longest hold in demo:draw is below 3 seconds, a longer one means that Chrome stopped painting
    if holds.max > 5
      at = times[holds.index(holds.max)] - times.first
      abort "No frame for #{holds.max.round(1)}s, #{at.round(1)}s into the recording. Keep the Chrome window on screen."
    end
    Rake::Task["demo:encode"].invoke
  ensure
    browser&.quit
  end

  desc "Encode tmp/demo_frames to tmp/demo.mp4. A higher CRF gives a smaller file (default: 26)"
  task :encode do
    output = Rails.root.join("tmp/demo.mp4")
    # The frame times are the file times, so a copy of the folder must keep them (cp -p)
    system(*%W[ffmpeg -y -loglevel error -f image2 -ts_from_file 2 -i #{Rails.root.join("tmp/demo_frames/%06d.jpg")}
      -vf fps=30,scale=700:436:out_range=tv,format=yuv420p -c:v libx264 -preset slow
      -crf #{ENV.fetch("CRF", "26")} -movflags +faststart -an #{output}], exception: true)
    puts "Stored #{output} (#{(output.size / 1_000_000.0).round(1)} MB)"
  end
end
