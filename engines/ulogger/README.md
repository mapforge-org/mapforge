# µlogger API for Mapforge

* App: https://f-droid.org/packages/net.fabiszewski.ulogger
* Original server project: https://github.com/bfabiszewski/ulogger-server
* Client project: https://github.com/bfabiszewski/ulogger-android

![Mapforge µlogger track](https://github.com/digitaltom/mapforge/blob/main/engines/ulogger/docs/track.jpg?raw=true)

## Usage

To use the µlogger app with mapforge.org, you need to go to its settings,
and use `https://mapforge.org/ulogger` as server url, and if you want your track to get assigned to your account, add your mapforge login account email as user name (no password).

![Screenshot_20250616-160431](https://github.com/user-attachments/assets/f7f31edf-fc88-41ac-bf35-7513f955a401)

Recorded tracks are private by default, so they are not shown to other users. You can decide to share a link to your track from the µlogger app.  


## API endpoints
Auth
`curl -H 'Content-Type: application/x-www-form-urlencoded' -X POST http://localhost:3000/ulogger/client/index.php -d 'action=auth&pass=supers3cr3t&user=cwh@domain.org'`

Sets a cookie with a token for the following requests. If a user with the provided email is found, the map is assigned to that user.

New Track
`curl -H 'Content-Type: application/x-www-form-urlencoded' -X POST http://localhost:3000/ulogger/client/index.php -d 'action=addtrack&track=Auto_2024.06.09_20.59.57'`

Append New Trackpoint
`curl -H 'Content-Type: application/x-www-form-urlencoded' -X POST http://localhost:3000/ulogger/client/index.php -d 'action=addpos&altitude=374.299987792969&provider=network&trackid=18&accuracy=16.113000869751&lon=11.1158342&time=1717959606&lat=49.4442029'`

## Development

Run tests with: `bin/rspec --pattern "engines/**/*_spec.rb"`
