namespace :trains do
  # Both live tasks write their own log, the default rake logger would swallow it
  def train_logger!
    Rails.logger = Logger.new($stdout, level: ENV.fetch("LOG_LEVEL", "info"))
    Rails.logger.formatter = ->(_severity, time, _progname, message) { "#{time.strftime('%H:%M:%S')} #{message}\n" }
  end

  desc "Create a map with the track and stations of an OpenStreetMap route relation"
  task :route_setup, [ :relation, :line ] => :environment do |_task, args|
    # Example tracks:
    # 2213233: RB21 Nürnberg Nordost => Gräfenberg
    # 67672: RB30 Nürnberg Hauptbahnhof => Neuhaus
    # 8316681: RE87
    fail "Provide an OSM relation as parameter, eg #{2213233}" unless args[:relation]
    Mongo::Logger.logger.level = Logger::WARN
    ActionCable.server.config.logger = Logger.new(nil)

    route = Mapforge::OsmElement.fetch("relation/#{args[:relation]}")
    geometry = route.geometry
    coordinates = geometry["coordinates"]

    # The IRIS line name makes a better public url than the random hex, /train:RB21 rather than
    # /a1b2c3d4. A rerun replaces that map, the track and the stations are rebuilt from OSM anyway.
    public_id = "train:#{args[:line]}" if args[:line]
    if public_id && (old = Map.where(public_id: public_id).first)
      puts "Replacing map '#{old.name}' (#{public_id})"
      old.destroy
    end

    map = Map.create
    lons, lats = coordinates.transpose
    map.update!({ name: route.name, zoom: "10", base_map: "versatilesGraybeard", type: "train",
      public_id: public_id, center: [ (lons.min + lons.max) / 2, (lats.min + lats.max) / 2 ] }.compact)
    layer = map.layers.first
    # The line is the IRIS line name, the l attribute on every stop event, eg "RB21" or "S1". It
    # lives on the track so trains:live and trains:supervise find it from the map alone.
    layer.features.create!(
      geometry: geometry,
      properties: { "title" => route.name, "stroke" => "#5cc497", "line" => args[:line],
                    "stroke-width" => 2, "sort-key" => 1 }.compact)

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
    train_logger!
    # line is the IRIS line name, the l attribute on every stop event, eg "RB21" or "S1", see
    # Mapforge::Trains::Timetable. Left out, it comes off the track feature.
    live = begin
      Mapforge::Trains::Live.new(args[:private_map_id], line: args[:line])
    rescue Mapforge::Trains::RouteMap::Error => e
      abort e.message
    end

    # Ctrl-C already raises this, a `kill` would end the process without running the cleanup that
    # takes the trains off the map. SIGKILL cannot be caught, a run ended with `kill -9` leaves them.
    Signal.trap("TERM") { raise Interrupt }
    begin
      live.run
    rescue Interrupt
      Rails.logger.info "Stopping"
    end
  end


  desc "Animate every train map (type=train) that has a client connected, and only those"
  task supervise: :environment do
    train_logger!
    supervisor = Mapforge::Trains::Supervisor.new
    Signal.trap("TERM") { raise Interrupt }
    begin
      supervisor.run
    rescue Interrupt
      Rails.logger.info "Stopping"
    end
  end
end
