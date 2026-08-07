require "net/http"

module Mapforge
  # Client for the DB Timetables (IRIS) API. The credentials come from an application at
  # developers.deutschebahn.com. That application needs a subscription to the "Timetables" product.
  class DbTimetables
    BASE_URL = "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1"
    # DB reports times as YYMMDDHHmm in German local time. The app runs in UTC.
    ZONE = ActiveSupport::TimeZone["Europe/Berlin"]

    class Error < StandardError; end

    def initialize(client_id: ENV["DB_CLIENT_ID"], api_key: ENV["DB_API_KEY"])
      raise Error, "DB_CLIENT_ID and DB_API_KEY must be set" if client_id.blank? || api_key.blank?
      @headers = { "DB-Client-Id" => client_id, "DB-Api-Key" => api_key, "Accept" => "application/xml" }
    end

    # Returns the planned stops of one station in one hour, keyed by stop event id. This data is
    # static and cacheable.
    def plan(eva, time, line: nil)
      parse(get("plan/#{eva}/#{time.in_time_zone(ZONE).strftime('%y%m%d/%H')}"), line: line)
    end

    # Returns the deviations known at one station, keyed by stop event id. DB refreshes them every
    # 30s. The result has no filter, so the caller merges it onto the stop ids from the plan.
    def changes(eva)
      parse(get("fchg/#{eva}"))
    end

    # DB uses two ids. An EVA number (7 digits, "80" for Germany) names a tariff point, and the
    # rest of this API uses it as the key. A DS100 code (2-5 letters, Regelwerk 100) names an
    # operating point, so junctions and depots have one too. Neither id implies the other: Berlin
    # Hbf is one EVA across BL, BLS and BHBF, and a bus stop has no code. OSM tags them uic_ref
    # and railway:ref, and eva_of in lib/tasks/trains.rake asks the two lookups below, code first.

    # Returns the eva number of a station, or nil. DB matches the name as a literal prefix and
    # writes no space before a bracket, so "Lauf (rechts Pegnitz)" needs "Lauf(rechts Pegnitz)".
    def eva(name)
      pattern = ERB::Util.url_encode(name.gsub(" (", "("))
      station = Nokogiri::XML(get("station/#{pattern}")).xpath("//station")
                        .find { |s| normalize(s["name"]) == normalize(name) }
      station["eva"] if station
    end

    # Returns the eva number behind a DS100/RL100 code, or nil. An exact code is a better key than
    # a name, but a code can also prefix a name, so this method compares the code of the hit.
    # Several codes give one station: BL, BLS and BHBF all give the eva of Berlin Hbf.
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
