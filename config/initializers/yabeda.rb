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
end
