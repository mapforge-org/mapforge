require "net/http"

module Mapforge
  # Turns an OpenStreetMap element into a GeoJSON geometry.
  class OsmElement
    API_URL = "https://api.openstreetmap.org/api/0.6"
    TYPES = %w[node way relation].freeze

    # id is "way/38512", "node/240109189" or "relation/2213233"
    def self.fetch(id)
      type, ref = id.to_s.split("/", 2)
      raise ArgumentError, "expected an id like relation/2213233, got #{id.inspect}" unless
        TYPES.include?(type) && ref.to_s.match?(/\A\d+\z/)

      # Only ways and relations have a /full, and it resolves their members for us
      path = type == "node" ? "node/#{ref}" : "#{type}/#{ref}/full"
      url = URI("#{API_URL}/#{path}.json")
      new(JSON.parse(Net::HTTP.get(url, { "User-Agent" => "mapforge" }))["elements"], type, ref.to_i)
    end

    attr_reader :members, :nodes

    def initialize(elements, type, id)
      @nodes = elements.select { |e| e["type"] == "node" }.index_by { |e| e["id"] }
      @ways = elements.select { |e| e["type"] == "way" }.index_by { |e| e["id"] }
      @element = elements.find { |e| e["type"] == type && e["id"] == id } ||
        raise(ArgumentError, "the response holds no #{type} #{id}")
      @members = @element["members"] || []
      @tags = @element["tags"] || {}
    end

    def name
      @tags["name"]
    end

    def geometry
      case @element["type"]
      when "node" then { "type" => "Point", "coordinates" => @element.values_at("lon", "lat") }
      when "way" then way_geometry
      else { "type" => "LineString", "coordinates" => relation_coordinates }
      end
    end

    private

    # ponytail: every closed way is treated as an area, which is wrong for roundabouts and
    # racetracks. The real test is the area tag table, https://wiki.openstreetmap.org/wiki/Key:area
    def way_geometry
      ring = @element["nodes"].first == @element["nodes"].last
      coordinates = way_coordinates(@element["id"])
      ring ? { "type" => "Polygon", "coordinates" => [ coordinates ] }
           : { "type" => "LineString", "coordinates" => coordinates }
    end

    # Member ways without a role make up the line, in order, but each one can be drawn either way
    # round. Ways that carry a role (a route's platforms, a multipolygon's rings) are not part of it.
    def relation_coordinates
      segments = @members.select { |m| m["type"] == "way" && m["role"].blank? }
                         .map { |m| way_coordinates(m["ref"]) }
      raise ArgumentError, "relation has no ways without a role" if segments.empty?

      line = segments.shift
      line.reverse! if segments.first && [ segments.first.first, segments.first.last ].include?(line.first)
      segments.each do |segment|
        segment = segment.reverse if segment.last == line.last
        warn "Gap in the line before #{segment.first.inspect}" unless segment.first == line.last
        line.concat(segment.first == line.last ? segment[1..] : segment)
      end
      line
    end

    def way_coordinates(id)
      @ways.fetch(id)["nodes"].map { |node_id| @nodes.fetch(node_id).values_at("lon", "lat") }
    end
  end
end
