namespace :maintenance do
  # Images nothing shows: no feature relation, no property that still holds the URL (features
  # imported from a file carry the URL but never get the relation), and no link in a feature
  # or map description (the markdown editors insert /image/<public_id> links).
  orphaned_images = lambda do
    public_ids = MapChannel::IMAGE_PROPERTIES.flat_map { |key|
      Feature.distinct("properties.#{key}").filter_map { |url| url.to_s[MapChannel::IMAGE_URL, 1] }
    }
    text = (Feature.distinct("properties.desc") + Map.distinct(:description)).join("\n")
    Image.not_in(id: Feature.distinct(:image_id).compact, public_id: public_ids).reject { |image|
      image.public_id.present? && text.match?(%r{/(?:icon|image)/#{Regexp.escape(image.public_id)}\b})
    }
  end

  tally = ->(values) { values.tally.sort_by { -_2 }.map { |k, v| "#{k}: #{v}" }.join(", ") }
  new_since = ->(model) { "New in the last 7 days: #{model.where(:created_at.gt => 7.days.ago).count}, " \
                          "30 days: #{model.where(:created_at.gt => 30.days.ago).count}" }
  map_line = ->(map, detail) { format("  %-10s %-32.32s %s", map&.public_id, map&.name, detail) }
  mb = ->(bytes) { format("%.1f MB", bytes / 1024.0 / 1024) }
  file_size = ->(uid) { uid ? File.size?(File.join(Dragonfly.app.datastore.root_path, uid)).to_i : 0 }

  # Query logging drowns the report when the log level is debug.
  task quiet: :environment do
    [ Mongo::Logger.logger, Mongoid.logger ].each { _1.level = Logger::WARN }
  end

  namespace :stats do
    desc "User statistics, or the maps of one user: maintenance:stats:users[email]"
    task :users, [ :email ] => :quiet do |_, args|
      if args[:email]
        user = User.find_by(email: args[:email]) || abort("No user with email #{args[:email]}")
        maps = user.owned_maps.includes(:layers).to_a
        puts "#{user.name} <#{user.email}> via #{user.provider}, since #{user.created_at.to_date}#{', admin' if user.admin}"
        puts "Maps: #{maps.size}, features: #{maps.sum(&:features_count)}, images: #{user.images_count}"
        maps.sort_by { -_1.updated_at.to_i }.each do |map|
          puts map_line.call(map, format("%5d features %5d views  updated %s",
                                         map.features_count, map.view_count, map.updated_at.to_date))
        end
      else
        puts "Users: #{User.count} (#{User.with_maps.count} with maps, #{User.with_images.count} with images, " \
             "#{User.admin.count} admins)"
        puts "Providers: #{tally.call(User.pluck(:provider))}"
        puts new_since.call(User)
        # A user document is saved on login and on map views, so updated_at approximates the last activity.
        puts "\nActive users:"
        User.where(:updated_at.gt => 7.days.ago).order(updated_at: :desc).limit(10).each do |user|
          puts format("  %-24.24s %-32.32s %-14s active %s %3d maps %3d images", user.name, user.email,
                      user.provider, user.updated_at.to_date, user.owned_maps.count, user.images_count)
        end
        puts "\nLatest users:"
        User.order(created_at: :desc).limit(10).each do |user|
          puts format("  %-24.24s %-32.32s %-14s signup %s", user.name, user.email, user.provider,
                      user.created_at.to_date)
        end
      end
    end

    desc "Map statistics and the largest maps"
    task maps: :quiet do
      maps = Map.includes(:layers).to_a
      # The features are the bulk of a map in the database, the map and layer documents are small.
      bytes_by_layer = Feature.collection.aggregate([
        { "$group" => { "_id" => "$layer_id", "bytes" => { "$sum" => { "$bsonSize" => "$$ROOT" } } } }
      ]).to_h { |row| [ row["_id"], row["bytes"] ] }
      db_size = ->(map) { map.layers.sum { |layer| bytes_by_layer[layer.id].to_i } }
      puts "Maps: #{maps.size} (#{maps.count { _1.features_count.zero? }} empty, #{Map.listed.count} listed, " \
           "#{Map.where(edit_permission: 'private').count} private)"
      puts "Types: #{tally.call(maps.map { _1.type || 'map' })}"
      puts "Layers: #{Layer.count} (#{tally.call(Layer.pluck(:type))}), features: #{Feature.count}, " \
           "#{mb.call(bytes_by_layer.values.sum)} in the database"
      puts new_since.call(Map)
      puts "\nLargest maps by feature count:"
      maps.sort_by { -_1.features_count }.first(15).each do |map|
        detail = format("%6d features %9s %5d views", map.features_count, mb.call(db_size.call(map)), map.view_count)
        puts map_line.call(map, detail)
      end
    end

    desc "Image statistics, maps with the most images"
    task images: :quiet do
      sizes = Image.pluck(:id, :img_uid).to_h { |id, uid| [ id, file_size.call(uid) ] }
      puts "Images: #{sizes.size}, #{mb.call(sizes.values.sum)}, orphaned: #{orphaned_images.call.count}"
      puts new_since.call(Image)
      pairs = Feature.where(:image_id.ne => nil).pluck(:layer_id, :image_id)
      layer_map = Layer.in(id: pairs.map(&:first).uniq).pluck(:id, :map_id).to_h
      per_map = pairs.group_by { |layer_id, _| layer_map[layer_id] }.transform_values { |p| p.map(&:last).uniq }
      puts "\nMaps with the most images:"
      per_map.sort_by { |_, ids| -ids.size }.first(15).each do |map_id, ids|
        detail = format("%4d images %9s", ids.size, mb.call(ids.sum { sizes[_1].to_i }))
        puts map_line.call(Map.find_by(id: map_id), detail)
      end
    end
  end

  namespace :prune do
    desc "Delete images no feature references. DRY_RUN=1 to report only."
    task images: :quiet do
      dry_run = ENV["DRY_RUN"].present?
      orphans = orphaned_images.call
      bytes = orphans.sum { |image| file_size.call(image.img_uid) }
      orphans.each do |image|
        puts "#{dry_run ? 'Would delete' : 'Deleting'} #{image.public_id} (#{image.img_uid}, #{image.created_at.to_date})"
        image.destroy unless dry_run
      end
      puts "#{dry_run ? 'Would free' : 'Freed'} #{mb.call(bytes)} by deleting #{orphans.size} images"
    end
  end
end
