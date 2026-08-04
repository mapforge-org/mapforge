module Mapforge
  module Trains
    # The live animation of one route map: ask the API where the trains are, write them onto the
    # map, repeat. trains:live runs one of these by hand, Supervisor runs one per map that somebody
    # is watching.
    class Live
      # Seconds between position writes. The browser interpolates in between, but along the straight
      # line between two positions. Only writes and broadcasts scale with this,
      # the API is asked on its own schedule.
      INTERVAL = 5

      attr_reader :route

      # line is the IRIS line name, the l attribute on every stop event, eg "RB21" or "S1". Left out,
      # it comes off the track feature where route_setup put it.
      def initialize(private_id, line: nil)
        @route = RouteMap.new(private_id, line: line)
        @timetable = Timetable.new(@route.station_names, line: @route.line)
        log_route
      end

      # Blocks until #stop is called, then takes the trains and the boards off the map again
      def run
        started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        tick = 0
        until @stopped
          step(tick)
          tick += 1
          sleep [ started + tick * INTERVAL - Process.clock_gettime(Process::CLOCK_MONOTONIC), 0 ].max
        end
      ensure
        @route.clear
      end

      # Takes effect at the end of the current interval, the run is never cut off mid-write
      def stop = @stopped = true

      private

      def step(tick)
        now = Time.current
        @timetable.refresh(now)
        running = @route.show_trains(@timetable.trips, now)
        @route.show_boards(@timetable.by_station, now)
        log_running(running, now) if (tick % (60 / INTERVAL)).zero?
      end

      def log_route
        Rails.logger.info "Track is #{(@route.length / 1000).round(1)} km long " \
                          "with #{@route.stations.size} stations:"
        @route.stations.each do |station|
          Rails.logger.info format("  at %5.1f km  %-24s eva %s",
            station[:distance] / 1000, station[:name], station[:eva])
        end
      end

      def log_running(running, now)
        return Rails.logger.info("#{running.size} trains running: #{running.join(' | ')}") if running.any?
        upcoming = @timetable.next_time(now)&.in_time_zone(DbTimetables::ZONE)
        Rails.logger.info "No trains running, #{@timetable.size} stops known, next one at " \
                          "#{upcoming ? upcoming.strftime('%d.%m. %H:%M') : 'never'}"
      end
    end
  end
end
