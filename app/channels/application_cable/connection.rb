class ApplicationCable::Connection < ActionCable::Connection::Base
  identified_by :uuid

  def connect
    self.uuid = SecureRandom.uuid
    Yabeda.websocket.connections_opened.increment({})
    Yabeda.websocket.active_connections.set({}, current_active_connections + 1)
  end

  def disconnect
    self.uuid = nil
    Yabeda.websocket.connections_closed.increment({})
    Yabeda.websocket.active_connections.set({}, [ current_active_connections - 1, 0 ].max)
  end

  private

  def current_active_connections
    ActionCable.server.connections.size
  end
end
