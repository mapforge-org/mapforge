module Mapforge
  module Trains
    # The stop events of one route, kept current. DbTimetables is the transport, this is the state it
    # accumulates: the plan of a station is a static hour slice, deviations are published separately
    # and have to be merged onto the stops already known, so neither answers "where is everything
    # right now" on its own.
    #
    # It is keyed on stop event ids, which is what both endpoints agree on, and the trip key inside an
    # id is what ties the stops of one train together across the stations of the route.
    class Timetable
      # The API refreshes deviations every 30s; 11 stations/min stays well under the 60 requests/min
      # of the free plan
      CHANGES_INTERVAL = 60

      # names is { eva => station name }, the names being there so every log line says which station
      # contributed what. line is the IRIS line name, the l attribute IRIS puts on every stop event,
      # eg "RB21" or "S1". Without it every train calling at one of the stations is kept, whatever
      # line it belongs to.
      def initialize(names, line: nil, api: DbTimetables.new)
        @names = names
        @line = line
        @api = api
        @stops = {} # stop event id => { trip:, eva:, planned:, planned_arrival:, arrival:, departure:, destination: }
        @hour = nil
        @changed_at = nil
      end

      def size = @stops.size

      # Stops grouped per train, in travel order. Untimed stops are dropped, a train cannot be placed
      # by one.
      def trips
        timed = @stops.values.select { |stop| stop[:arrival] || stop[:departure] }
        timed.group_by { |stop| stop[:trip] }
             .transform_values { |stops| stops.sort_by { |stop| stop[:arrival] || stop[:departure] } }
      end

      def by_station
        @stops.values.group_by { |stop| stop[:eva] }
      end

      # When the next stop of the whole route is due, or nil. Only interesting while nothing runs.
      def next_time(after)
        @stops.values.filter_map { |stop| stop[:departure] || stop[:arrival] }.select { |time| time > after }.min
      end

      # One hour of plan is fetched ahead, so a train that is already rolling when the hour turns
      # stays complete, and stops that are two hours gone are forgotten to keep the hash from growing.
      def refresh(now)
        if @hour.nil?
          [ -1, 0, 1 ].each { |offset| load_plan(now + offset.hour) }
        elsif @hour != now.hour
          load_plan(now + 1.hour)
          @stops.delete_if { |_id, stop| (stop[:arrival] || stop[:departure]) < now - 2.hours }
        end
        @hour = now.hour

        return unless @changed_at.nil? || now - @changed_at >= CHANGES_INTERVAL
        load_changes
        @changed_at = now
      end

      private

      # The rescue sits inside the loop: one station failing is not the run failing
      def load_plan(time)
        added = 0
        @names.each do |eva, name|
          stops = @api.plan(eva, time, line: @line)
          stops.each do |id, stop|
            added += 1 unless @stops.key?(id)
            @stops[id] = stop.merge(eva: eva, planned_arrival: stop[:arrival],
                                    planned: stop[:departure] || stop[:arrival])
          end
          detail(eva, name, stops.values.map { |stop| "#{at(stop)} to #{stop[:destination] || 'somewhere'}" })
        rescue DbTimetables::Error => e
          Rails.logger.warn "  plan of #{name} failed: #{e.message}"
        end
        Rails.logger.info "Timetable for #{time.in_time_zone(DbTimetables::ZONE).strftime('%d.%m. %H:00')}: " \
                          "#{added} new stops#{" of line #{@line}" if @line}, #{size} stops known in total"
      end

      # Deviations come unfiltered, so they are merged onto the stop ids the plan already knows.
      def load_changes
        updated = 0
        @names.each do |eva, name|
          changes = @api.changes(eva)
          ours = changes.filter_map do |id, change|
            next unless (stop = @stops[id]) && (change[:arrival] || change[:departure])
            updated += 1
            was = at(stop)
            stop[:arrival] = change[:arrival] if change[:arrival]
            stop[:departure] = change[:departure] if change[:departure]
            "#{was} now #{at(stop)}"
          end
          detail(eva, name, ours.presence || [ "none of our #{changes.size} changes" ])
        rescue DbTimetables::Error => e
          Rails.logger.warn "  changes of #{name} failed: #{e.message}"
        end
        Rails.logger.info "Delays: #{updated} of #{size} known stops have a new time"
      end

      # IRIS does publish a stop with no time on it at all, and this is only ever a log line
      def at(stop)
        time = stop[:departure] || stop[:arrival]
        time ? Tools.hhmm(time) : "no time"
      end

      # One line per eva number, so it is visible which station contributes what
      def detail(eva, name, entries)
        Rails.logger.debug { "  #{eva} #{name}: #{entries.presence&.join(', ') || 'nothing'}" }
      end
    end
  end
end
