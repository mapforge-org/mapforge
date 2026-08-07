module Mapforge
  module Trains
    module Tools
      # The API publishes the moment the doors close, the train is still standing at the platform for
      # a bit after that. Without this a train that is on time appears to roll off early.
      DEPARTURE_DELAY = 20.seconds

      # The stop nodes of an OsmElement route relation, in travel order
      def self.stops(element)
        element.members.select { |m| m["type"] == "node" && m["role"].to_s.start_with?("stop") }
               .map { |m| element.nodes.fetch(m["ref"]) }
      end

      # Where one train is at `now`, in meters along the line, or nil before it leaves and after it
      # has arrived. It stands still while it stops at a station and moves at a constant speed in
      # between. stops are in travel order; the origin has no arrival and the terminus no departure,
      # so each falls back to the other time.
      #
      #   stops = [{ distance: 0,    departure: 12:00 },
      #            { distance: 1000, arrival: 12:10, departure: 12:12 },
      #            { distance: 3000, arrival: 12:30 }]
      #   distance_at(stops, 12:05) # => 500.0  half way to the second station
      #   distance_at(stops, 12:11) # => 1000   still standing there
      #   distance_at(stops, 12:31) # => nil    the trip is over
      def self.distance_at(stops, now)
        # Untimed stops are dropped and the rest get both times, so nothing below has to nil-check
        stops = stops.filter_map do |stop|
          time = stop[:arrival] || stop[:departure]
          next unless time
          stop.merge(arrival: stop[:arrival] || time, departure: stop[:departure] || time)
        end
        # Off the map before it leaves its origin and once it has reached its terminus, which is
        # also why the walk below always returns rather than running out of pairs. Fewer than two
        # timed stops leaves no segment to interpolate along.
        return nil if stops.size < 2 || now < stops.first[:departure] || now > stops.last[:arrival]

        stops.each_cons(2) do |a, b|
          # We only get here with now past a's arrival, so now before a's departure means standing
          # at a. That also catches every ride to b that is not longer than the departure delay,
          # which is why the division below never gets a zero denominator.
          departure = a[:departure] + DEPARTURE_DELAY
          return a[:distance] if now <= departure
          next if now > b[:arrival]
          progress = (now - departure) / (b[:arrival] - departure)
          return a[:distance] + (b[:distance] - a[:distance]) * progress
        end
      end

      # The departure board of a single station: the next train towards each destination, earliest
      # first. Departures already gone are dropped, and so is every later train to a destination
      # that is on the board already.
      #
      #   stops = [{ destination: "Gräfenberg",       departure: 12:20 },
      #            { destination: "Gräfenberg",       departure: 13:20 },
      #            { destination: "Nürnberg Nordost", departure: 12:05 },
      #            { destination: "Nürnberg Nordost", departure: 11:55 }]
      #   next_departures(stops, 12:00) # => the 12:05 to Nürnberg Nordost, then the 12:20 to Gräfenberg
      def self.next_departures(stops, now)
        stops.select { |stop| stop[:destination] && stop[:departure] && stop[:departure] >= now }
             .group_by { |stop| stop[:destination] }
             .map { |_destination, towards| towards.min_by { |stop| stop[:departure] } }
             .sort_by { |stop| stop[:departure] }
      end

      # The next train that ends at a station. It has no departure, so #next_departures never sees
      # it, and no destination either, because the station it is standing in is the destination.
      def self.next_arrival(stops, now)
        stops.select { |stop| stop[:departure].nil? && stop[:arrival] && stop[:arrival] >= now }
             .min_by { |stop| stop[:arrival] }
      end

      # How many minutes late a stop is. The live time and the planned one have to be the same event:
      # comparing an arrival against a planned departure would report the stop time as being early.
      def self.delay(stop)
        planned = (stop[:arrival] && stop[:planned_arrival]) || stop[:planned]
        (((stop[:arrival] || stop[:departure]) - planned) / 60).round
      end

      # How late a running train is: the delay at the stop it is heading for, which is what a
      # passenger waiting there cares about
      def self.train_delay(stops, now)
        next_stop = stops.find { |stop| (stop[:arrival] || stop[:departure]) >= now }
        next_stop ? delay(next_stop) : 0
      end

      # What one running train looks like on the map
      def self.train_properties(trip, stops, now, line: nil)
        minutes = train_delay(stops, now)
        destination = stops.filter_map { |stop| stop[:destination] }.first
        color, shadow = delay_colors(minutes)
        { "trip_id" => trip, "title" => "#{line} → #{destination}".strip,
          "marker-symbol" => "🚆", "marker-size" => 16, "sort-key" => 10,
          "marker-color" => color, "label-shadow" => shadow, "label-max-width" => 40,
          "label" => "→ #{destination}#{" (+#{minutes})" if minutes.positive?}" }
      end

      # Marker color and the washed out version of it the label is haloed with
      def self.delay_colors(minutes)
        case minutes
        when ..4 then [ "#33d17a", "#cdf1d7" ]    # green, on time
        when 5..14 then [ "#ff7800", "#ffd7b3" ]  # orange
        else [ "#e01b24", "#f6bbbd" ]             # red
        end
      end
      private_class_method :delay_colors

      # The departure board of one station, one line per destination, below the station name that
      # route_setup left in label-title:
      #
      #   12:20 (12:18) → Gräfenberg (+2)
      #   12:35
      #
      # Planned departure, planned arrival in brackets where the train does not start here, terminus,
      # and how late it currently is. A train that ends here has no departure and no destination but
      # this station, whose name is above the board already, so its line is the planned arrival alone.
      def self.board_label(stops, now)
        lines = next_departures(stops, now).map { |stop|
          arrival = stop[:planned_arrival]
          [ stop[:planned], "#{hhmm(stop[:planned])}#{" (#{hhmm(arrival)})" if arrival} → #{stop[:destination]}",
            ((stop[:departure] - stop[:planned]) / 60).round ]
        }
        ends_here = next_arrival(stops, now)
        lines << [ ends_here[:planned], hhmm(ends_here[:planned]), delay(ends_here) ] if ends_here
        lines.sort_by(&:first).map { |_time, text, minutes| "#{text}#{" (+#{minutes})" unless minutes.zero?}" }
             .join("\n")
      end

      # Every time here comes from the DB API and belongs to a German platform display, so it is shown
      # in the zone that API reports in. The server clock is UTC and nobody standing on the platform
      # cares.
      def self.hhmm(time) = time.in_time_zone(DbTimetables::ZONE).strftime("%H:%M")
    end
  end
end
