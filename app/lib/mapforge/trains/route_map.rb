module Mapforge
  module Trains
    # The map that trains:route_setup built: one track, one point per station, and the train points
    # this class puts on top of them. It is the only place that writes, so everything above it
    # (Timetable, Tools) stays a plain hash of stop events.
    #
    # A station is a coordinate that has to become a kilometer mark and a train is a kilometer mark
    # that has to become a coordinate; LineIndex answers both, and the track is what it is built from.
    class RouteMap
      class Error < StandardError; end

      # [{ eva:, name:, distance:, feature: }], nearest the start of the track first
      attr_reader :stations

      # The IRIS line name, the l attribute on every stop event, eg "RB21" or "S1"
      attr_reader :line

      def initialize(private_id, line: nil)
        map = Map.find_by(private_id: private_id) ||
          raise(Error, "No map with private id #{private_id.inspect}, run 'rake trains:route_setup' first")
        @layer = map.layers.first
        track = @layer.features.line_string.first ||
          raise(Error, "No track on the map, run 'rake trains:route_setup'")
        # route_setup leaves the line on the track, so a run needs nothing but the map to start from
        @line = line || track.properties["line"]
        @index = LineIndex.new(track.coordinates(include_height: false))

        points = @layer.features.point.to_a
        @stations = points.select { |feature| feature.properties["eva"] }.map { |feature|
          { eva: feature.properties["eva"], name: feature.properties["title"], feature: feature,
            distance: @index.distance_at(feature.coordinates(include_height: false)) }
        }.sort_by { |station| station[:distance] }
        raise Error, "No station carries an eva number, run 'rake trains:route_setup'" if @stations.empty?

        @distances = @stations.to_h { |station| [ station[:eva], station[:distance] ] }
        # Trains left behind by an earlier run that never got to clear up
        points.select { |feature| feature.properties["trip_id"] }.each(&:destroy)
        @trains = {} # trip key => Feature
      end

      def length = @index.length

      def station_names = @stations.to_h { |station| [ station[:eva], station[:name] ] }

      # Writes one point per running train, removes the ones that have arrived, and returns a
      # description of each for the log
      def show_trains(trips, now)
        running = {}
        trips.each do |trip, events|
          stops = events.map { |stop| stop.merge(distance: @distances[stop[:eva]]) }
          meters = Tools.distance_at(stops, now)
          next unless meters

          properties = Tools.train_properties(trip, stops, now, line: @line)
          write_train(trip, meters, properties)
          minutes = Tools.train_delay(stops, now)
          delay = minutes.positive? ? ", +#{minutes} min late" : ""
          running[trip] = "#{properties['title']} at #{(meters / 1000).round(1)} km#{delay}"
        end
        (@trains.keys - running.keys).each do |trip|
          Rails.logger.info "Arrived: #{@trains[trip].properties['title']}"
          @trains.delete(trip).destroy
        end
        running.values
      end

      # Departure board on every station, below the station name that route_setup put there
      def show_boards(by_station, now)
        @stations.each do |station|
          label = Tools.board_label(by_station.fetch(station[:eva], []), now)
          next if station[:feature].properties["label"] == label
          station[:feature].update!(properties: station[:feature].properties.merge("label" => label))
        end
      end

      # Leaving the trains and the boards behind would show a timetable that stopped being updated
      def clear
        Rails.logger.info "Removing #{@trains.size} trains and clearing #{@stations.size} departure boards"
        @trains.each_value(&:destroy)
        @stations.each do |station|
          next unless station[:feature].properties.key?("label")
          station[:feature].update!(properties: station[:feature].properties.except("label"))
        end
      end

      private

      def write_train(trip, meters, properties)
        attributes = { geometry: { "type" => "Point", "coordinates" => @index.position_at(meters) },
                       properties: properties }
        return @trains[trip].update!(attributes) if @trains[trip]
        @trains[trip] = @layer.features.create!(attributes)
        Rails.logger.info "Departed: #{properties['title']}"
      end
    end
  end
end
