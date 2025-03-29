namespace :animation do
  desc "Animate a point along a line (server-side)"
  task :path, %i[mapid lineid markerid] => :environment do |_, args|
    Map.find(args.fetch(:mapid))
    line = Feature.find(args.fetch(:lineid))
    point = Feature.find(args.fetch(:markerid))
    # line
    linestring_geojson = line.geojson[:geometry]
    linestring = RGeo::GeoJSON.decode(linestring_geojson)
    i = 0
    # animate
    loop do
      linepoint = linestring.points[i]
      i += 1
      puts "Moving to: #{linepoint}"
      point.update(geometry: { "type" => "Point", "coordinates" => linepoint.coordinates })
      sleep 0.3
      i = 0 if i >= linestring.points.size
    end
  end
end
