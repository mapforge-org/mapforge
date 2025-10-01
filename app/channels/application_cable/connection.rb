class ApplicationCable::Connection < ActionCable::Connection::Base
  def connect
    Yabeda.websocket.connections_opened.increment({})
    Yabeda.websocket.active_connections.set({}, current_active_connections + 1)
  end

  def disconnect
    Yabeda.websocket.connections_closed.increment({})
    Yabeda.websocket.active_connections.set({}, current_active_connections - 1)
  end

  private

  def current_active_connections
    ActionCable.server.connections.size
  end
end
