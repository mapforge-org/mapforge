namespace :trains do
  desc "Create a map with the track and stations of an OpenStreetMap route relation"
  task :route_setup, [ :relation ] => :environment do |_task, args|
    # Example tracks:
    # 2213233: RB 21 Nürnberg Nordost => Gräfenberg
    # 67672: RB 30 Nürnberg Hauptbahnhof => Neuhaus
    fail "Provide an OSM relation as parameter, eg #{2213233}" unless args[:relation]
    Mongo::Logger.logger.level = Logger::WARN
    ActionCable.server.config.logger = Logger.new(nil)

    route = Mapforge::OsmElement.fetch("relation/#{args[:relation]}")
    geometry = route.geometry
    coordinates = geometry["coordinates"]

    map = Map.create
    lons, lats = coordinates.transpose
    map.update!(name: route.name, zoom: "10", base_map: "versatilesGraybeard", type: "train",
      center: [ (lons.min + lons.max) / 2, (lats.min + lats.max) / 2 ])
    layer = map.layers.first
    layer.features.create!(
      geometry: geometry,
      properties: { "title" => route.name, "stroke" => "#5cc497",
                    "stroke-width" => 2, "sort-key" => 1 })

    # The DB Timetables API is keyed on EVA numbers. uic_ref already is one, railway:ref holds a
    # DS100 code DB translates exactly, and the name is the last resort because DB only matches it
    # by prefix. Mapforge::DbTimetables#eva says how the two OSM tags differ and why this order.
    api = nil
    eva_of = lambda do |tags|
      next tags["uic_ref"] if tags["uic_ref"]
      api ||= Mapforge::DbTimetables.new
      eva = (tags["railway:ref"] && api.eva_by_ds100(tags["railway:ref"])) || api.eva(tags["name"])
      puts "  #{tags['name']}: no uic_ref in OSM, DB #{eva ? "knows eva #{eva}" : 'knows no such station'}"
      eva
    rescue Mapforge::DbTimetables::Error => e
      warn "  #{tags['name']}: eva lookup failed, #{e.message}"
      nil
    end

    stops = Mapforge::Trains::Tools.stops(route)
    stops.each do |node|
      layer.features.create!(
        geometry: { "type" => "Point", "coordinates" => node.values_at("lon", "lat") },
        properties: { "title" => node["tags"]["name"], "eva" => eva_of.call(node["tags"]),
                      "sort-key" => 5, "marker-color" => "#000000", "marker-size" => 6,
                      "marker-opacity" => 1, "stroke" => "#77767b",
                      # The name stays on the map, the live task only fills the departures below it in
                      "label-title" => node["tags"]["name"], "label-size" => 11,
                      "label-max-width" => 30, "label-offset" => [ 0, 0.8 ] })
    end

    puts "Track: #{coordinates.size} points, #{stops.size} stations"
    puts "Map: #{map.name} (public_id: #{map.public_id}, private_id: #{map.private_id})"
  end


  desc "Continuously update the train positions of a route map from the DB Timetables API"
  task :live, [ :private_map_id, :line ] => :environment do |_task, args|
    Rails.logger = Logger.new($stdout, level: ENV.fetch("LOG_LEVEL", "info"))
    Rails.logger.formatter = ->(_severity, time, _progname, message) { "#{time.strftime('%H:%M:%S')} #{message}\n" }

    # Seconds between position writes. The browser interpolates in between, but along the straight
    # line between two positions. Only writes and broadcasts scale with this,
    # the API is asked on its own schedule.
    interval = 5

    # line is the IRIS name of the line, eg "RB21", see Mapforge::Trains::Timetable
    route = begin
      Mapforge::Trains::RouteMap.new(args[:private_map_id], line: args[:line])
    rescue Mapforge::Trains::RouteMap::Error => e
      abort e.message
    end
    timetable = Mapforge::Trains::Timetable.new(route.station_names, line: args[:line])

    Rails.logger.info "Track is #{(route.length / 1000).round(1)} km long with #{route.stations.size} stations:"
    route.stations.each do |station|
      Rails.logger.info format("  at %5.1f km  %-24s eva %s", station[:distance] / 1000, station[:name], station[:eva])
    end

    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    tick = 0
    # Ctrl-C already raises this, a `kill` would end the process without running the ensure below.
    # SIGKILL cannot be caught, a run ended with `kill -9` leaves its trains on the map.
    Signal.trap("TERM") { raise Interrupt }
    begin
      loop do
        now = Time.current
        timetable.refresh(now)
        running = route.show_trains(timetable.trips, now)
        route.show_boards(timetable.by_station, now)

        if (tick % (60 / interval)).zero?
          upcoming = timetable.next_time(now)&.in_time_zone(Mapforge::DbTimetables::ZONE)
          Rails.logger.info running.any? ?
            "#{running.size} trains running: #{running.join(' | ')}" :
            "No trains running, #{timetable.size} stops known, next one at " \
              "#{upcoming ? upcoming.strftime('%d.%m. %H:%M') : 'never'}"
        end
        tick += 1
        sleep [ started + tick * interval - Process.clock_gettime(Process::CLOCK_MONOTONIC), 0 ].max
      end
    rescue Interrupt
      Rails.logger.info "Stopping"
    ensure
      route.clear
    end
  end
end
