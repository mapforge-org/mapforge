class ApplicationCable::Connection < ActionCable::Connection::Base
  def connect
    Yabeda.websocket_connections_opened.increment({})
    Yabeda.websocket_active_connections.set({}, current_active_connections + 1)
  end

  def disconnect
    Yabeda.websocket_connections_closed.increment({})
    Yabeda.websocket_active_connections.set({}, current_active_connections - 1)
  end

  private

  def current_active_connections
    ActionCable.server.connections.size
  end
end
