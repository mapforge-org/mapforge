module Mapforge
  # Turns a polyline into something that can be walked by distance. It measures the line once and
  # then answers both directions: where a given distance along it lands, and how far along a given
  # coordinate lies. The train map needs both, because a station is a coordinate that has to become
  # a kilometre mark and a train is a kilometre mark that has to become a coordinate.
  class LineIndex
    # Spherical, so point.distance answers in great-circle meters. The default cartesian factory
    # would answer in degrees, which are only a fixed length along the equator.
    FACTORY = RGeo::Geographic.spherical_factory

    # Length of the whole line in meters
    attr_reader :length

    # @cumulative[i] holds the distance from the start of the line to vertex i, one entry per
    # coordinate, so its last entry is the length of the line. Measuring every segment up front
    # turns each later lookup into a walk over a sorted array instead of more trigonometry.
    def initialize(coordinates)
      @coords = coordinates
      @cumulative = [ 0.0 ]
      coordinates.each_cons(2) do |a, b|
        @cumulative << @cumulative.last + FACTORY.point(*a).distance(FACTORY.point(*b))
      end
      @length = @cumulative.last
      @cursor = 0
    end

    # The [lon, lat] at `meters` from the start, interpolated inside the segment it falls into.
    # Anything past the end wraps around, so a looping animation keeps going.
    #
    # Distances are expected in ascending order (wrapping at the end of the line), so the
    # segment cursor only ever moves forward: it carries on from the segment the last call left
    # off at rather than searching the table again, and rewinds only when a distance arrives
    # behind it, which is what a wrap looks like.
    def position_at(meters)
      meters %= @length
      @cursor = 0 if @cumulative[@cursor] > meters
      @cursor += 1 while @cursor < @coords.size - 2 && @cumulative[@cursor + 1] <= meters
      a, b = @coords[@cursor], @coords[@cursor + 1]
      segment = @cumulative[@cursor + 1] - @cumulative[@cursor]
      t = segment.zero? ? 0.0 : (meters - @cumulative[@cursor]) / segment
      [ a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t ]
    end

    # The other direction: how many meters from the start the given coordinate lies. Every vertex
    # is measured against it, which is affordable because this runs once per station at setup,
    # unlike position_at, which runs once per train per tick.
    #
    # ponytail: snaps to the nearest line vertex, not the nearest point on the segment. Fine for
    # dense geometry (OSM rail is metres apart); project onto the segment if that ever gets coarse.
    def distance_at(coordinate)
      point = FACTORY.point(*coordinate)
      @cumulative[(0...@coords.size).min_by { |i| point.distance(FACTORY.point(*@coords[i])) }]
    end
  end
end
