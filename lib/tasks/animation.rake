namespace :animation do
  desc "Animate a point along a line at constant speed (server-side)"
  task :path, %i[mapid lineid markerid speed] => :environment do |_, args|
    Map.find(args.fetch(:mapid))
    line = Feature.find(args.fetch(:lineid))
    point = Feature.find(args.fetch(:markerid))
    speed = (args[:speed] || 10).to_f # meters/second
    interval = 2 # seconds between updates, the browser interpolates in between

    line_index = Mapforge::LineIndex.new(line.coordinates(include_height: false))
    abort "Line #{line.id} has zero length" if line_index.length.zero?
    puts "Line length: #{line_index.length.round} m, speed: #{speed} m/s"

    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    tick = 0
    loop do
      coordinates = line_index.position_at(speed * interval * tick)
      point.update(geometry: { "type" => "Point", "coordinates" => coordinates })
      tick += 1
      sleep [ started + tick * interval - Process.clock_gettime(Process::CLOCK_MONOTONIC), 0 ].max
    end
  end
end
