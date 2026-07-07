Yabeda.configure do
  group :websocket do
    gauge :active_connections,
      comment: "Number of currently active WebSocket connections"

    counter :connections_opened,
      comment: "Total number of WebSocket connections opened"

    counter :connections_closed,
      comment: "Total number of WebSocket connections closed"

    counter :messages_received,
      comment: "Total number of WebSocket messages received",
      tags: %i[action channel]

    counter :messages_failed,
      comment: "Total number of WebSocket messages that raised an error while processing",
      tags: %i[action channel]

    gauge :active_subscriptions,
      comment: "Number of active WebSocket channel subscriptions",
      tags: %i[channel]

    counter :subscriptions_opened,
      comment: "Total number of WebSocket channel subscriptions opened",
      tags: %i[channel]

    counter :subscriptions_closed,
      comment: "Total number of WebSocket channel subscriptions closed",
      tags: %i[channel]
  end

  counter :dragonfly_transformations,
    comment: "Total number of Dragonfly image transformations performed",
    tags: %i[processor]

  counter :layers_created,
    comment: "Total number of layers created, by type",
    tags: %i[type]

  counter :geolocation_lookup_failures,
    comment: "Total number of failed MaxMind IP geolocation lookups"

  counter :geolocation_lookup_successes,
    comment: "Total number of successful MaxMind IP geolocation lookups"

  group :ulogger do
    counter :errors,
      comment: "Total number of µlogger API requests that failed at the application level",
      tags: %i[reason]
  end
end

# Fires for every ActionCable action dispatch (all channels). ActiveSupport::Notifications
# automatically fills in payload[:exception] when the instrumented block raises, so this
# gives WebSocket error visibility without touching individual channel action methods.
ActiveSupport::Notifications.subscribe("perform_action.action_cable") do |event|
  next unless event.payload[:exception]
  Yabeda.websocket.messages_failed.increment(
    { action: event.payload[:action], channel: event.payload[:channel_class] }
  )
end
