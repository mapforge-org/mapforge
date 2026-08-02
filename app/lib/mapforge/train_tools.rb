module Mapforge
  module TrainTools
    # The stop nodes of an OsmElement route relation, in travel order
    def self.stops(element)
      element.members.select { |m| m["type"] == "node" && m["role"].to_s.start_with?("stop") }
             .map { |m| element.nodes.fetch(m["ref"]) }
    end

    # Where one train is at `now`, in meters along the line, or nil before it leaves and after it
    # has arrived. It stands still while it dwells at a station and moves at a constant speed in
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
      stops = stops.filter_map do |stop|
        time = stop[:arrival] || stop[:departure]
        next unless time
        stop.merge(arrival: stop[:arrival] || time, departure: stop[:departure] || time)
      end
      return nil if stops.size < 2 || now < stops.first[:departure] || now > stops.last[:arrival]

      stops.each_cons(2) do |a, b|
        return a[:distance] if now <= a[:departure] # still standing at a
        next if now > b[:arrival]
        progress = (now - a[:departure]) / (b[:arrival] - a[:departure])
        return a[:distance] + (b[:distance] - a[:distance]) * progress
      end
      stops.last[:distance]
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
  end
end
