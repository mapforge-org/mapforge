module Ulogger
  class Api::UloggerController < ApplicationController
    before_action :set_map, only: %i[addpos]

    JAVA_MAXINT = 2147483647

    METADATA_FORMAT = [
      [ :altitude, '%.2f m' ],
      [ :speed, '%.1f km/h', ->(x) { x.to_f * 3.6 } ],
      [ :bearing, '%.1f°' ],
      [ :accuracy, '%.2f m' ],
      [ :provider, '%s' ],
      [ :comment, '%s' ]
    ]

    TRACK_PROPERTIES = {
      "title" => "µlogger track",
      "show-km-markers": true,
      "fill-extrusion-color": "#62a0ea",
      "fill-extrusion-height": 8,
      "fill-extrusion-base": 3,
      "fill-extrusion-width": 1.5,
      "stroke-opacity": 0.45,
      "stroke-width": 5,
      "stroke": "#62a0ea"
    }

    def auth
      session['email'] = params[:user]
      render json: { error: false }
    end

    def addtrack
      user = User.find_by(email: session['email'])
      map_id, padded_id = create_numeric_map_id
      @map = Map.create!(id: padded_id, name: params[:track],
                         public_id: params[:track],
                         view_permission: 'link',
                         edit_permission: 'link',
                         user: user)
      @map.save!
      render json: { error: false, trackid: map_id }
    end

    def addpos
      coords = [ params[:lon].to_f, params[:lat].to_f, params[:altitude].to_f.round(2) ]
      features = @map.layers.first.features

      # if the map has no track yet, create one, else append
      track = features.line_string.first
      track = Feature.new(layer: @map.layers.first, geometry: { 'coordinates' => [] }, properties: TRACK_PROPERTIES) unless track
      track_coords = track.geometry['coordinates'] << coords
      track.update(geometry: { "type" => "LineString",
                               "coordinates" => track_coords })

      # add point with details
      geometry = { "type" => "Point", "coordinates" => coords }

      timestamp = Time.at(params[:time].to_i).to_datetime.strftime("%Y-%m-%d %H:%M:%S")
      properties = { "title" => timestamp, "desc" => description || "", "marker-size" => 4 }
      properties['label'] = params['comment'] if params['comment']

      uploaded = params.fetch(:image, nil)

      if uploaded.is_a?(ActionDispatch::Http::UploadedFile)
        image_properties = image_properties(uploaded)
        properties.merge!(image_properties)
      else
        properties.merge!(location_properties)
      end

      # reset waypoints to default invisible style, keep photos and labels
      features.reject { |f| f.properties['marker-image-url'] ||
        f.properties['label'] || f.properties["marker-color"].nil? }.each do |f|
        f.properties["marker-size"] = 3
        f.properties["marker-color"] = "transparent"
        f.properties["stroke"] = "transparent"
        f.save!
      end
      # set leading waypoint
      features.create!(geometry: geometry, properties: properties)
      @map.update!(center: [ params[:lon].to_f, params[:lat].to_f ])

      render json: { error: false }
    end

    private

    def set_map
      @map =  Map.find_by(id: "%024d" % [ params[:trackid] ])
      render json: { error: true, message: "Invalid trackid" } unless @map
    end

    def image_properties(uploaded)
      # original filename is 'upload', we need a name with file extension
      # for Dragonfly mime_type detection:
      ext = uploaded.content_type.split('/').last
      filename = "#{SecureRandom.hex(4)}.#{ext}"
      uid = Dragonfly.app.store(uploaded.tempfile, 'name' => filename)
      img = Image.create(img_uid: uid)
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
          "- %s: #{format}" % [ key.to_s.humanize, val ]
        end
      end.join("\n")
    end

    # mongoid needs a BSON::ObjectId (24 char hex) as primary key,
    # which we use as map id currently
    def create_numeric_map_id
      id = SecureRandom.rand(1..JAVA_MAXINT)
      padded = "%024d" % [ id ]
      return create_numeric_map_id if Map.exists?(id: padded)
      [ id, padded ]
    end
  end
end
