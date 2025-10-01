module ApplicationCable
  class Channel < ActionCable::Channel::Base
    def subscribed
      super
      channel_label = self.class.name
      Yabeda.websocket.subscriptions_opened.increment({ channel: channel_label })
      # Seems there's no build-in way in ActionCable to get current number of subscriptions
      Yabeda.websocket.active_subscriptions.set({ channel: channel_label },
        (Yabeda.websocket.active_subscriptions.get({ channel: channel_label }) || 0) + 1)
    end

    def unsubscribed
      super
      channel_label = self.class.name
      Yabeda.websocket.subscriptions_closed.increment({ channel: channel_label })
      count = (Yabeda.websocket.active_subscriptions.get({ channel: channel_label }) || 1) - 1
      Yabeda.websocket.active_subscriptions.set({ channel: channel_label }, [ count, 0 ].max)
    end
  end
end
