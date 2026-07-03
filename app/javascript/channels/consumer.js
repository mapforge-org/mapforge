// Action Cable provides the framework to deal with WebSockets in Rails.
// You can generate new channels where WebSocket features live using the `bin/rails generate channel` command.

import { ConnectionMonitor, createConsumer } from '@rails/actioncable'

// Websocket connection gets reset after configured seconds.
// Needs balance to give time for busy not getting treated as
// a dropped connection — but also keep it short enough to
// detect real drops promptly (mobile going offline or backgrounded)

ConnectionMonitor.staleThreshold = 8 // default 6

export default createConsumer()
