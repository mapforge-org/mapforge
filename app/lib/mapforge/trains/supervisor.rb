module Mapforge
  module Trains
    # Runs a Live loop for every train map somebody has open, and for no other.
    #
    # Who is watching comes out of Redis: the Action Cable adapter is subscribed to a stream's
    # pubsub channel exactly while that stream has clients, so PUBSUB NUMSUB on
    # "<prefix>:map_channel_<public_id>" answers it. ActionCable.server.connections cannot, it only
    # ever holds the connections of its own process, and this process has none.
    class Supervisor
      POLL = 10

      # A browser refresh takes the count to zero for a few seconds, and starting a route again
      # costs an hour of plan per station. Idling for a while is cheaper than rebuilding.
      LINGER = 120

      # ponytail: hard cap on concurrent routes, the DB free plan allows 60 requests/min shared
      # across all of them (~11/min to keep a route running, ~44 to start one). A token bucket
      # around DbTimetables if more routes ever have to run at once.
      MAX = ENV.fetch("TRAIN_MAX_LIVE", 3).to_i

      def initialize(redis: nil, prefix: nil)
        cable = Rails.application.config_for(:cable)
        @redis = redis || Redis.new(url: cable[:url])
        @prefix = prefix || cable[:channel_prefix]
        @runners = {} # public_id => { map:, thread:, live:, idle_since:, stopping: }
        @refused = []
      end

      def run
        Rails.logger.info "Watching #{Map.where(type: "train").count} train maps, " \
                          "animating up to #{MAX} of them at a time"
        loop do
          sync
          sleep POLL
        end
      ensure
        @runners.keys.each { |public_id| stop(public_id, "supervisor shutting down") }
      end

      # One pass: start what is being watched, stop what has been left alone for long enough. Only
      # ever called from the one thread that owns @runners.
      def sync(now = Time.current)
        maps = Map.where(type: "train").to_a
        watched = watched_ids(maps)
        maps.each do |map|
          runner = @runners[map.public_id]
          if runner.nil?
            start(map) if watched.include?(map.public_id)
          elsif watched.include?(map.public_id)
            runner[:idle_since] = nil
          else
            runner[:idle_since] ||= now
            stop(map.public_id, "nobody watching for #{LINGER}s") if now - runner[:idle_since] >= LINGER
          end
        end
      end

      private

      # One PUBSUB NUMSUB covers every train map, and answers [channel, count, channel, count, ...]
      def watched_ids(maps)
        return [] if maps.empty?
        counts = Hash[*@redis.pubsub("numsub", *maps.map { |map| channel(map.public_id) })]
        maps.map(&:public_id).select { |public_id| counts[channel(public_id)].to_i.positive? }
      end

      def channel(public_id) = [ @prefix, "map_channel_#{public_id}" ].compact.join(":")

      # Building the Live is the expensive part, an hour of plan for every station of the route, so
      # it happens in the runner thread rather than holding up the next poll. A route that raises
      # stays down until its map is left alone long enough for the entry to be dropped, so a map
      # that cannot run does not get retried every POLL seconds.
      def start(map)
        return refuse(map) if @runners.size >= MAX
        @refused.delete(map.public_id)
        Rails.logger.info "Starting live trains for '#{map.name}' (#{map.public_id})"
        runner = { map: map, idle_since: nil }
        # The routes share nothing, a runner touches no state but its own entry. Writing :live
        # before reading :stopping is what makes a stop arriving during the load still land.
        runner[:thread] = Thread.new do # rubocop:disable ThreadSafety/NewThread
          live = Live.new(map.private_id)
          runner[:live] = live
          live.stop if runner[:stopping]
          live.run
        rescue StandardError => e
          Rails.logger.error "Live trains for '#{map.name}' stopped: #{e.class} #{e.message}"
        end
        @runners[map.public_id] = runner
      end

      def stop(public_id, reason)
        return unless (runner = @runners.delete(public_id))
        Rails.logger.info "Stopping live trains for '#{runner[:map].name}': #{reason}"
        # The stop can arrive while the thread is still loading the timetable and has no Live yet
        runner[:stopping] = true
        runner[:live]&.stop
        runner[:thread].join(Live::INTERVAL + 5)
      end

      def refuse(map)
        return if @refused.include?(map.public_id)
        @refused << map.public_id
        Rails.logger.warn "Not animating '#{map.name}': already running #{MAX} routes, " \
                          "raise TRAIN_MAX_LIVE if the DB API plan allows it"
      end
    end
  end
end
