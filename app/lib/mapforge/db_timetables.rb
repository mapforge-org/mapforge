require "net/http"

module Mapforge
  # Client for the DB Timetables (IRIS) API. Credentials come from an application registered at
  # developers.deutschebahn.com that is subscribed to the "Timetables" product.
  class DbTimetables
    BASE_URL = "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1"
    # Times are reported as YYMMDDHHmm in German local time, while the app runs in UTC.
    ZONE = ActiveSupport::TimeZone["Europe/Berlin"]

    class Error < StandardError; end

    def initialize(client_id: ENV["DB_CLIENT_ID"], api_key: ENV["DB_API_KEY"])
      raise Error, "DB_CLIENT_ID and DB_API_KEY must be set" if client_id.blank? || api_key.blank?
      @headers = { "DB-Client-Id" => client_id, "DB-Api-Key" => api_key, "Accept" => "application/xml" }
    end

    # Planned stops of one station within one hour slice, keyed by stop event id. Static, cacheable.
    def plan(eva, time, line: nil)
      parse(get("plan/#{eva}/#{time.in_time_zone(ZONE).strftime('%y%m%d/%H')}"), line: line)
    end

    # Deviations currently known at one station, keyed by stop event id. Upstream refresh is 30s.
    # Unfiltered: the caller merges these onto the stop ids it already knows from the plan.
    def changes(eva)
      parse(get("fchg/#{eva}"))
    end

    # A station carries two kinds of id and DB uses both. An EVA number (7 digits, UIC country code
    # plus five, "80" for Germany) names a tariff and passenger information point, and is what the
    # rest of this API is keyed on. A DS100 code (2-5 letters, Regelwerk 100, first letter the old
    # directorate region, N for Nürnberg) names an operating point instead, so codes exist for
    # junctions and depots that sell no ticket. Neither implies the other: Berlin Hbf is one EVA
    # across the three operating points BL, BLS and BHBF, while a bus stop has an EVA and no code.
    #
    # OSM tags them uic_ref and railway:ref. eva_of in lib/tasks/trains.rake takes uic_ref straight
    # when a stop has one and asks the two lookups below for the rest, code first, name last.

    # The eva number of a station, or nil. The pattern is a literal prefix of the DB name, and DB
    # writes no space before a bracket where OSM does, so the space is dropped to let
    # "Lauf (rechts Pegnitz)" find "Lauf(rechts Pegnitz)".
    def eva(name)
      pattern = ERB::Util.url_encode(name.gsub(" (", "("))
      station = Nokogiri::XML(get("station/#{pattern}")).xpath("//station")
                        .find { |s| normalize(s["name"]) == normalize(name) }
      station["eva"] if station
    end

    # The eva number behind a DS100/RL100 code, or nil. A code is matched exactly rather than by
    # prefix, which is what makes it a better key than the name, but one that happens to prefix a
    # station name answers with that station, so the code of the hit is checked. The answer is one
    # station even where several codes share it, which is what we want: BL, BLS and BHBF all give
    # the eva of Berlin Hbf.
    def eva_by_ds100(code)
      station = Nokogiri::XML(get("station/#{ERB::Util.url_encode(code)}")).at_xpath("//station")
      station["eva"] if station && station["ds100"].to_s.casecmp?(code)
    end

    private

    def normalize(name)
      name.downcase.gsub(/[^[:alnum:]]/, "")
    end

    def get(path)
      uri = URI("#{BASE_URL}/#{path}")
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 15) do |http|
        http.get(uri.request_uri, @headers)
      end
      raise Error, "GET #{path} returned #{response.code}" unless response.is_a?(Net::HTTPSuccess)
      response.body
    end

    def parse(body, line: nil)
      events = Nokogiri::XML(body).xpath("//s")
      stops = events.each_with_object({}) do |event, result|
        arrival, departure = event.at_xpath("ar"), event.at_xpath("dp")
        next if line && ![ arrival&.[]("l"), departure&.[]("l") ].include?(line)

        result[event["id"]] = {
          trip: event["id"].split("-")[0..-2].join("-"),
          # ppth on a departure lists the stations still ahead, so its last entry is the terminus.
          destination: departure&.[]("ppth")&.split("|")&.last,
          arrival: time_of(arrival),
          departure: time_of(departure)
        }
      end
      Rails.logger.debug do
        seen = events.map { |e| e.xpath("ar|dp").filter_map { |event| event["l"] }.first || "unnamed" }.tally
        "  kept #{stops.size} of #{events.size} stops#{" of line #{line}" if line}, lines seen: #{seen}"
      end
      stops
    end

    def time_of(event)
      stamp = event && (event["ct"] || event["pt"])
      ZONE.strptime(stamp, "%y%m%d%H%M") if stamp
    end
  end
end
