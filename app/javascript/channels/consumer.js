// Action Cable provides the framework to deal with WebSockets in Rails.
// You can generate new channels where WebSocket features live using the `bin/rails generate channel` command.

import { ConnectionMonitor, createConsumer, logger } from '@rails/actioncable'

// Websocket connection gets reset after configured seconds.
// Needs balance to give time for busy not getting treated as
// a dropped connection — but also keep it short enough to
// detect real drops promptly (mobile going offline or backgrounded)

ConnectionMonitor.staleThreshold = 8 // default 6

// Surfaces connection lifecycle (open/close/error/stale/reopen) to the console.
// Off by default in @rails/actioncable, but the websocket is mandatory for the
// app to function, so a silent failure to connect should never go unlogged.
logger.enabled = true

export default createConsumer()
