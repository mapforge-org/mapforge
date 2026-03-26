module Ulogger
  class Api::UloggerController < ApplicationController
    before_action :set_map, only: %i[addpos]

    JAVA_MAXINT = 2147483647

    METADATA_FORMAT = [
      [ :altitude, "%.2f m" ],
      [ :speed, "%.1f km/h", ->(x) { x.to_f * 3.6 } ],
      [ :bearing, "%.1f°" ],
      [ :accuracy, "%.2f m" ],
      [ :provider, "%s" ],
      [ :comment, "%s" ]
    ]

    # params: {"pass" => "pwd", "user" => "user@mail.com"}
    def auth
      session["email"] = params[:user]
      render json: { error: false }
    end

    # Called by the app on first waypoint upload
    # params: { "track" => "tom_2026-03-24_11.08" }
    # When track name matches "<private_map_id>#<track name>", you can log into an existing map/track
    def addtrack
      @user = User.find_by(email: session["email"])
      if params[:track] =~ /^(\d+)#(\S+)/
        session["track_name"] = $2
        @map = Map.find_by(private_id: $1)
      else
        session["track_name"] = params[:track]
        @map = Map.create!(private_id: random_map_id, name: params[:track],
          view_permission: "link",
          edit_permission: "link",
          user: @user)
      end
      if @map
        render json: { error: false, trackid:  @map.private_id.to_i }
      else
        Rails.logger.error("Cannot create map for track '#{params[:track]}'")
        render json: { error: true, message: "Invalid trackid" }
      end
    end

    # params: {"altitude" => "384.600006103516", "provider" => "network",
    #          "trackid" => "123", "accuracy" => "12.3999996185303",
    #          "lon" => "11.0871855", "time" => "1774346910", "lat" => "49.428361"}
    #
    # Uses/Creates track with track name from 'addtrack' call before
    def addpos
      coords = [ params[:lon].to_f, params[:lat].to_f, params[:altitude].to_f.round(2) ]

      # Find track layer, fallback to map name which also has the initial track name by default
      track_name = session["track_name"] || @map.name
      layer = @map.layers.geojson.find { |l| l.name == track_name } || @map.layers.create(name: track_name)
      features = layer.features

      # Find track with current name on map, or create new
      track = features.line_string.find { |l| l.properties['title'] == track_name }
      track ||= Feature.new(layer: layer, geometry: { "coordinates" => [] },
                            properties: track_properties(track_name, string_to_color(track_name)))

      track_coords = track.geometry["coordinates"] << coords
      track.update(geometry: { "type" => "LineString",
                              "coordinates" => track_coords })

      # add point with details
      geometry = { "type" => "Point", "coordinates" => coords }

      timestamp = Time.at(params[:time].to_i).to_datetime.strftime("%Y-%m-%d %H:%M:%S")
      # properties of leading point
      properties = { "title" => timestamp,
                    "desc" => description || "",
                    "marker-size" => 4 }
      properties["label"] = params["comment"] if params["comment"]

      uploaded = params.fetch(:image, nil)

      if uploaded.is_a?(ActionDispatch::Http::UploadedFile)
        image = save_image(uploaded)
        image_properties = image_properties(image)
        properties.merge!(image_properties)
      else
        properties.merge!(location_properties)
      end

      # reset standard waypoints to default style,
      # keep photos and labels, exclude already styled waypoints
      features.reject { |f|
        f.properties["marker-image-url"] ||
          f.properties["label"] || f.properties["marker-color"].nil? ||
          f.geometry["type"] == "LineString"
      }.each do |f|
        f.properties["marker-size"] = 2
        f.properties["marker-color"] = "#f6f5f4"
        f.properties["stroke"] = "transparent"
        f.properties["min-zoom"] = 14
        f.save!
      end
      # set leading waypoint
      features.create!(geometry: geometry, properties: properties, image: image)
      @map.update!(center: [ params[:lon].to_f, params[:lat].to_f ])

      render json: { error: false }
    end

    private

    def set_map
      @map = Map.find_by(private_id: params[:trackid])
      render json: { error: true, message: "Invalid trackid" } unless @map
    end

    def save_image(uploaded)
      # original filename is 'upload', we need a name with file extension
      # for Dragonfly mime_type detection:
      ext = uploaded.content_type.split("/").last
      filename = "ulogger-#{SecureRandom.hex(4)}.#{ext}"

      uid = Dragonfly.app.store(uploaded.tempfile, "name" => filename) # name needs to be a string here
      Image.create(img_uid: uid, public_id: filename, user: @map.user)
    end

    def image_properties(img)
      desc = "[![image](/image/#{img.public_id})](/image/#{img.public_id})\n" +
        description
      { "marker-color" => "transparent",
       "stroke" => "#ffffff",
       "marker-size" => 20,
       "stroke-width" => 8,
       "marker-image-url" => "/icon/" + img.public_id,
       "desc" => desc }
    end

    def location_properties
      { "marker-size": "8",
        "marker-color": "#ff7800",
        "stroke": "#000000" }
    end

    def description
      METADATA_FORMAT.filter_map do |dtype|
        key, format, lambda = dtype
        val = params.fetch(key, nil)
        if val.present?
          val = lambda.call(val) if lambda
          "- %s: #{format}" % [ key.to_s.humanize, val ] # standard:disable Lint/FormatParameterMismatch
        end
      end.join("\n")
    end

    def track_properties(title, color)
      {
        "title" => title || "µlogger track",
        :"show-km-markers" => true,
        :"fill-extrusion-height" => 8,
        :"fill-extrusion-base" => 3,
        :"fill-extrusion-width" => 1.5,
        :"stroke-opacity" => 0.75,
        :"stroke-width" => 5,
        :stroke => color
      }
    end

    # ulogger needs a numeric map id
    def random_map_id
      SecureRandom.rand(1..JAVA_MAXINT)
    end

    def string_to_color(str)
      hex = Digest::MD5.hexdigest(str)
      "##{hex[0, 6]}"
    end
  end
end
