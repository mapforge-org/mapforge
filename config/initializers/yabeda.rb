Yabeda.configure do
  # A gauge to track the number of active WebSocket connections
  gauge :websocket_active_connections,
        comment: "Number of currently active WebSocket connections"

  # A counter to track the total number of WebSocket connections opened
  counter :websocket_connections_opened,
          comment: "Total number of WebSocket connections opened"

  # A counter to track the total number of WebSocket connections closed
  counter :websocket_connections_closed,
          comment: "Total number of WebSocket connections closed"

  # A counter to track the number of WebSocket messages sent
  counter :websocket_messages_sent,
          comment: "Total number of WebSocket messages sent"

  # A counter to track the number of WebSocket messages received
  counter :websocket_messages_received,
          comment: "Total number of WebSocket messages received"
end
