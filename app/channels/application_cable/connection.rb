class ApplicationCable::Connection < ActionCable::Connection::Base
  identified_by :uuid, :current_user

  def connect
    self.uuid = SecureRandom.uuid
    self.current_user = User.find_by(id: request.session[:user_id]) if request.session[:user_id]
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
