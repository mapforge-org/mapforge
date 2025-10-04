require "dragonfly"
# require "dragonfly/mongoid_data_store"

Dragonfly.app.configure do
  plugin :imagemagick

  secret ENV["DRAGONFLY_SECRET"] || "de11cfe896ea9350ca27bc8603fb72438808a7ec214080d89bdfe1f82508c3c8"

  url_format "/media/:job/:name"
  # datastore :mongoid

  datastore :file,
    root_path: "storage/dragonfly",
    server_root: Rails.root.join("public")

  response_header "cache-control", "public, max-age=#{1.week.to_i}"

  # custom processors: http://markevans.github.io/dragonfly/processors
  processor :rounded do |content|
    Yabeda.dragonfly_transformations.increment({ processor: "rounded" })
    content.shell_update(ext: "png") do |old_path, new_path|
      # Instagram style rounded corners, preserving inner transparency
      "/usr/bin/convert #{old_path} -alpha set \
                          \( +clone -alpha extract \
                             -draw 'fill black polygon 0,0 0,50 50,0 fill white circle 50,50 50,0' \
                             \( +clone -flip \) -compose Multiply -composite \
                             \( +clone -flop \) -compose Multiply -composite \
                          \) -alpha off -compose CopyOpacity -composite #{new_path}"
    end
  end

  processor :crop_quadrant do |content|
    Yabeda.dragonfly_transformations.increment({ processor: "crop_quadrant" })
    height = content.analyse(:height)
    width = content.analyse(:width)
    # Calculate the quadrant size
    quadrant_size = [ width, height ].min
    # Crop the image
    content.shell_update do |old_path, new_path|
      "/usr/bin/convert #{old_path} -gravity center \
        -crop #{quadrant_size}x#{quadrant_size}+0+0 +repage #{new_path}"
    end
  end

  processor :sharpen do |content, amount|
    Yabeda.dragonfly_transformations.increment({ processor: "sharpen" })
    content.shell_update do |old_path, new_path|
      "/usr/bin/convert #{old_path} -sharpen #{amount} #{new_path}"
    end
  end

  processor :border do |content, width|
    Yabeda.dragonfly_transformations.increment({ processor: "border" })
    width ||= 5
    content.shell_update(ext: "png") do |old_path, new_path|
      "/usr/bin/convert #{old_path} -bordercolor white -border #{width}x#{width} \
        -alpha set -channel RGBA -background none #{new_path}"
    end
  end
end

# Logger
Dragonfly.logger = Rails.logger

# Mount as middleware
Rails.application.middleware.use Dragonfly::Middleware

# Add model functionality
ActiveSupport.on_load(:active_record) do
  extend Dragonfly::Model
  extend Dragonfly::Model::Validations
end
