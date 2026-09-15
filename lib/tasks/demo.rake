require "net/http"

namespace :demo do
  desc "Draw on an existing map in three scenes, for screen recording (Elba, La Zanca)"
  task draw: :environment do
    fps = 25
    pace = 0.75                                    # every cursor action runs 25% faster

    # Opening and closing shot: all three scenes in one frame
    wide_view = { center: [ 10.13148, 42.80478 ], zoom: 14.4, bearing: 0, pitch: 0 }

    # Scene 1: Ben's walk on the coast path west of Sant'Andrea
    walk_view = { center: [ 10.141389, 42.806839 ], zoom: 16.89, bearing: 36.8, pitch: 63 }
    walk = [ [ 10.141065, 42.805958 ], [ 10.137624, 42.806340 ],
             [ 10.132795, 42.803512 ], [ 10.130609, 42.804515 ] ]

    # Scene 2: Cleo maps the shore at Punta della Zanca, then the water in front of it
    shore_view = { center: [ 10.122640, 42.802750 ], zoom: 16.4, bearing: 122.7, pitch: 55 }
    sea_view = { center: [ 10.124200, 42.803900 ], zoom: 16.5, bearing: 150, pitch: 52 }
    beach = [ [ 10.121079, 42.802693 ], [ 10.121444, 42.802848 ],
              [ 10.121523, 42.802739 ], [ 10.121133, 42.802628 ] ]
    spots = [ [ [ 10.122646, 42.802339 ], "binoculars", "Punta della Zanca" ],
              [ [ 10.123330, 42.803400 ], "person_swimming_in_water", "Snorkeling" ],
              [ [ 10.124150, 42.803180 ], "cliff_with_rocks", "Cliff" ] ]
    dive_sites = [
      [ [ [ 10.122952, 42.803489 ], [ 10.123967, 42.803615 ], [ 10.123987, 42.803415 ],
          [ 10.122878, 42.803213 ], [ 10.122475, 42.803199 ], [ 10.122022, 42.803068 ],
          [ 10.121423, 42.803003 ], [ 10.121755, 42.803182 ], [ 10.122270, 42.803290 ],
          [ 10.122795, 42.803376 ] ],
        "Posidonia meadow", "Sea bream, wrasse and sea urchins", "#2f9e44" ],
      [ [ [ 10.124537, 42.803864 ], [ 10.124951, 42.804083 ], [ 10.125415, 42.804082 ],
          [ 10.125561, 42.803866 ], [ 10.125500, 42.803700 ], [ 10.124814, 42.803611 ] ],
        "Rocky reef", "Octopus, moray eel and scorpionfish", "#0c8599" ] ]
    wreck = [ 10.124450, 42.804750 ]

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
    garden = [ [ 10.133597, 42.801638 ], [ 10.133464, 42.801825 ], [ 10.133387, 42.802046 ],
               [ 10.133649, 42.802109 ], [ 10.133738, 42.801924 ], [ 10.133816, 42.801723 ],
               [ 10.133640, 42.801654 ] ]
    parking = [ [ 10.133963, 42.801293 ], [ 10.134043, 42.801373 ], [ 10.134133, 42.801312 ],
                [ 10.134019, 42.801243 ], [ 10.133915, 42.801155 ], [ 10.133861, 42.801189 ] ]
    # From the parking, around the west side of the neighbour house, up to the door.
    drive = [ [ 10.133986, 42.801382, 150 ], [ 10.133915, 42.801452, 150 ],
              [ 10.133855, 42.801417, 150 ], [ 10.133708, 42.801548, 150 ],
              [ 10.133910, 42.801632, 150 ], [ 10.133872, 42.801681, 138 ] ]
    garden_spot = [ 10.133465, 42.801623 ]
    # The neighbour house, from its real footprint in OpenStreetMap (way 169710115).
    annex = [ [ 10.1339432, 42.8015571 ], [ 10.1339970, 42.8015012 ],
              [ 10.1338775, 42.8014393 ], [ 10.1338237, 42.8014952 ] ]
    house_view = { center: [ 10.1338054, 42.8015461 ], zoom: 18.49, bearing: 0, pitch: 44 }

    print "Private map id (browser should be open): "
    private_id = $stdin.gets.to_s.strip
    map = Map.find_by(private_id: private_id)
    abort "No map with private_id #{private_id}" unless map
    # Printed before the slow setup below, so the page is open by the time the first
    # broadcast goes out. A cursor is a broadcast, so it needs a connected client.
    puts "Open #{ENV.fetch("MAPFORGE_HOST", "http://localhost:3000")}/m/#{map.private_id}"

    hiker  = { uuid: "demo-hiker", name: "Ben", image: "/images/frontpage/avatar2.jpeg" }
    scout  = { uuid: "demo-scout", name: "Cleo", image: "/images/frontpage/avatar3.jpeg" }
    artist = { uuid: "demo-artist", name: "Ada", image: "/images/frontpage/avatar1.jpeg" }

    # Reuse the layers instead of recreating them. A destroyed layer makes every open client
    # redraw the whole basemap, which races with the new layer's source and swallows the
    # features that follow (they only appear after a reload).
    [ hiker, scout, artist ].each do |cursor|
      cursor[:layer] = map.layers.find_or_create_by!(name: cursor[:name], type: "geojson")
      cursor[:layer].features.destroy_all
    end

    # The opening shot is stored on the map itself, so a fresh page load already shows the
    # wide view with the title on it. An open page gets the same view broadcast below.
    map.update!(center: wide_view[:center], zoom: wide_view[:zoom],
                pitch: wide_view[:pitch], bearing: wide_view[:bearing])
    word = "MAPFORGE"
    # The logo stays up for the whole recording. It is flat, so it lies on the ground and
    # turns with the camera instead of covering the scene.
    artist[:layer].features.create!(
      geometry: { "type" => "Point", "coordinates" => [ 10.132244, 42.802396 ] },
      properties: { "title" => word, "label" => word,
                    "label-font" => [ "Bold", "Bree Serif" ], "label-letter-spacing" => 0.08,
                    "label-size" => 500, "label-color" => "#fff",
                    "label-shadow" => "#d9d9a5", "label-shadow-width" => 4,
                    "stroke" => "transparent", "marker-color" => "transparent",
                    "marker-size" => 40, "sort-key" => 2,
                    "flat" => true, "marker-scaling" => true })

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
    photos = (1..4).map { |i| store_photo.call(Rails.root.join("public/images/frontpage/photo#{i}.jpeg")) }

    # Route the walk before the recording starts, because the API call is slow.
    key = ENV["OPENROUTESERVICE_KEY"].to_s
    abort "Set OPENROUTESERVICE_KEY to route the walk" if key.empty?
    uri = URI("https://api.heigit.org/openrouteservice/v2/directions/foot-hiking/geojson" \
              "?api_key=#{CGI.escape(key)}")
    reply = Net::HTTP.post(uri, { coordinates: walk, elevation: true,
      extra_info: %w[steepness surface waycategory waytype suitability traildifficulty],
      options: { profile_params: { weightings: { green: 0.6, quiet: 0.3 } } } }.to_json,
      "Content-Type" => "application/json")
    abort "Routing failed (#{reply.code}): #{reply.body}" unless reply.is_a?(Net::HTTPSuccess)
    routed = JSON.parse(reply.body).dig("features", 0)
    track = routed["geometry"]["coordinates"]
    stops = routed["properties"]["way_points"]     # index of every waypoint inside track
    # The same list the app requests (ORS_EXTRA_INFO). Without it there is no steepness
    # colouring and the colour mode dropdown on the feature stays hidden.
    extras = routed["properties"]["extras"]

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

    # Scene 1: Ben walks the routed coast path and pins a photo on every waypoint.
    # The track grows under his cursor, so it is drawn while he moves.
    track_feature = nil
    track_properties = ->(upto) {
      { "title" => "Coast walk", "stroke" => "#e8590c", "stroke-width" => 5,
        "stroke-opacity" => 0.65, "stroke-dasharray" => true,
        "fill-extrusion-height" => 8, "fill-extrusion-width" => 3, "fill-extrusion-opacity" => 0.6,
        "show-route-extras" => "steepness",
        "route" => { "provider" => "ors", "profile" => "foot",
                     "waypoints" => stops[0..upto].map { |stop| track[stop].first(2) },
                     "extras" => extras } }
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
      stops.each_with_index do |stop, i|
        if i.positive?
          from = stops[i - 1]
          leg = track[from..stop]
          # The camera leads Ben. It settles on the middle of the leg, then flies on to the
          # next waypoint while he is only halfway, so the track never leaves the frame.
          fly.call(walk_view.merge(center: leg[leg.size / 2].first(2)), 1.2)
          drawn = Time.now
          ahead = false
          follow.call(hiker, leg, 3.0) do |j|
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
        hiker[:layer].features.create!(
          geometry: { "type" => "Point", "coordinates" => track[stop].first(2) }, image: photo,
          properties: { "title" => "Photo #{i + 1}", "marker-size" => 26, "min-zoom" => 14,
                        "marker-image-url" => "/icon/#{photo.public_id}",
                        "desc" => "[![image](/image/#{photo.public_id})](/image/#{photo.public_id})\n" })
        # Hold on the waypoint, long enough for the camera to settle on it. The client only
        # fetches a marker image when MapLibre renders the marker and misses it
        # (setMissingStyleImageResolver). Fly away at once and the fetch never starts, so the
        # photo stays invisible for the rest of the recording. This wait does not follow pace.
        # The last waypoint needs none, because the closing hold of the scene covers it.
        sleep 0.9 unless i == stops.size - 1
      end
    }

    # Scene 2: Cleo marks the beach, the nature points around it, and the dive sites offshore.
    shore_scene = -> {
      trace.call(scout, beach, { "title" => "Spiaggia della Zanca", "fill" => "#f6c453",
                                 "fill-opacity" => 0.5, "label" => "Beach" })
      sleep 0.3
      spots.each do |point, icon, title|
        glide.call(scout, point, 0.6)
        sleep 0.2
        scout[:layer].features.create!(
          geometry: { "type" => "Point", "coordinates" => point },
          properties: { "title" => title, "marker-symbol" => "/icon-sets/pinhead/#{icon}.png",
                        "marker-color" => "#1971c2", "label" => title, "min-zoom" => 14 })
        sleep 0.3
      end
      fly.call(sea_view)
      dive_sites.each do |ring, title, animals, color|
        trace.call(scout, ring, { "title" => title, "desc" => animals, "stroke" => color,
                                  "fill" => color, "fill-opacity" => 0.35,
                                  "label" => animals, "label-title" => title, "label-size" => 11 })
        sleep 0.3
      end
      glide.call(scout, wreck, 0.6)
      sleep 0.2
      scout[:layer].features.create!(
        geometry: { "type" => "Point", "coordinates" => wreck },
        properties: { "title" => "Shipwreck", "desc" => "Steel hull at 22 m, groupers inside",
                      "marker-symbol" => "/icon-sets/fontawesome/ship.png",
                      "marker-color" => "#495057", "label" => "Shipwreck" })
    }

    # Scene 3: Ada maps the plot around two houses, then raises both into 3D.
    wall = { "stroke" => "#495057", "stroke-width" => 3, "fill" => "transparent" }
    house_scene = -> {
      outline = trace.call(artist, house, wall.merge("title" => "Casa La Zanca"))
      sleep 0.3
      annex_outline = trace.call(artist, annex, wall.merge("title" => "Casa Piccola"))
      sleep 0.3
      # The walls rise as the camera starts to tilt, not after it has landed.
      fly.call(house_view.merge(pitch: 60, bearing: -30), 0)
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
      rise.call
      trace.call(artist, garden, { "title" => "Garden", "stroke" => "#5c940d",
                                   "fill" => "#a9e34b", "fill-opacity" => 0.4,
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
                      "marker-color" => "#5c940d", "label" => "Terrace", "min-zoom" => 14 })
    }

    scenes = [ [ walk_view, walk_scene, hiker, track[stops.first].first(2) ],
               [ shore_view, shore_scene, scout, beach.first ],
               [ house_view, house_scene, artist, house.first ] ]
    # A page that was already open kept its own view, and a stored view only reaches it when
    # nobody touched the map. Broadcast the opening shot instead. The recorder is not running yet.
    fly.call(wide_view)
    # All three cursors wait on the wide view, so the opening frame is already complete and
    # the camera always flies towards a visible person.
    scenes.each { |_view, _scene, cursor, start| move.call(cursor, *start) }

    print "Start the recorder, then press Enter: "
    $stdin.gets

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
    fly.call(wide_view, 3.0)
    # The three cursors stay on the work they just did, so the closing frame shows who made what.
    [ [ hiker, track[track.size / 2].first(2) ],
      [ scout, sea_view[:center] ],
      [ artist, house_view[:center] ] ].each { |cursor, spot| glide.call(cursor, spot, 0.6) }
    sleep 2.0

    puts "Done: /m/#{map.private_id}"
  end
end
