include Rails.application.routes.url_helpers

Rails.logger = ActiveSupport::TaggedLogging.new(Logger.new($stdout))

namespace :seed do
  desc "Seed example map data from a geojson file"
  task :geojson_file, %i[path] => :environment do |_, args|
    # the public id of the imported map will be the filename without extension
    path = args.fetch(:path)
    map_name = File.basename(path, File.extname(path)).tr(".", "_")
    collection_format = 4326 # geojson default format is epsg:4326 (WGS84)
    map = Map.find_or_create_by(public_id: map_name)

    file = File.read(path)
    geojson = JSON.parse(file)

    map.layer.features = Feature.from_collection(geojson, collection_format: collection_format)

    puts "Created map with #{map.features.size} features from #{path}"
    puts "Public id: #{map.public_id}, private id: #{map.id}"
  end

  desc "Import map from a mapforge export file"
  task :mapforge_file, %i[path] => :environment do |_, args|
    Map.create_from_file(args.fetch(:path), collection_format: 4326)
  end
end
