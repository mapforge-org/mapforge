Yabeda.counter(:websocket_connections_total, comment: "Total websocket connections")
Yabeda.gauge(:websocket_active_connections, comment: "Currently active websocket connections")

class ApplicationCable::Connection < ActionCable::Connection::Base
  identified_by :current_user

  def connect2
    Yabeda.websocket_connections_total.increment
    Yabeda.websocket_active_connections.set(
      nil,
      Yabeda.websocket_active_connections.get(nil).to_i + 1
    )
  end

  def disconnect2
    Yabeda.websocket_active_connections.set(
      nil,
      [ Yabeda.websocket_active_connections.get(nil).to_i - 1, 0 ].max
    )
  end
end
