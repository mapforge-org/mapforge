# Bike Touring with Mapforge

![Bike touring with Mapforge](/images/tutorials/bike_touring_intro.png)

Mapforge is a great companion for your next bike tour. Plan your route on the desktop, then open the same map on your phone and follow your track with compass mode and a live elevation profile. This tutorial walks you through the workflow.

Check out the [Havel bike track](https://mapforge.org/m/d4209eabaf51?f=s97ubxrwy7b) for reference.

### Plan your route

There are two ways to get a track onto your map: create one with the built-in bike routing, or import an existing GPX file. It's useful to use a basemap that shows existing bike infrastructure.

#### Create a track manually with bike routing

Create a new map after logging in. Select the **bike routing** tool from the 'draw line' menu (or press `b` on the keyboard). Now click on the map to place waypoints — Mapforge will calculate a bike-friendly route between them using OpenStreetMap data.
You can also create the track without automatic routing, by creating all waypoints manually.

<video controls preload="metadata" poster="/images/tutorials/bike_touring_routing_poster.jpg">
  <source src="/images/tutorials/bike_touring_routing.webm" type="video/webm">
  <source src="/images/tutorials/bike_touring_routing.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

You can drag waypoints to adjust the route after placing them. Add as many waypoints as you need to shape the route to your liking.

#### Import a GPX track

If you already have a GPX file from another app like [Komoot](https://www.komoot.com) or [Bikerouter](https://bikerouter.de), you can import it directly. Open the **layers modal**, click the **import** button and select your file. Mapforge supports GPX, KML and GeoJSON formats (up to 2.5 MB).

The imported track will appear on your map with elevation data preserved, ready to use.

<video controls preload="metadata" poster="/images/tutorials/bike_touring_import_poster.jpg">
  <source src="/images/tutorials/bike_touring_import.webm" type="video/webm">
  <source src="/images/tutorials/bike_touring_import.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

#### Customize your map

Once your planned track is on the map, you can tailor everything to your ride:

<video controls preload="metadata" poster="/images/tutorials/bike_touring_customize_poster.jpg">
  <source src="/images/tutorials/bike_touring_customize.webm" type="video/webm">
  <source src="/images/tutorials/bike_touring_customize.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

- **Segment your track**: right-click on the track to split it into sections at any point. This is useful for highlighting different parts of your route for example in multi-day rides.
- **Style your track**: change the track color, line width, and enable **distance markers** to see kilometer markers along the route.
- **Choose a background map**: switch to a base map that suits cycling, such as the topographic or bike map, in the map settings.
- **Add points of interest**: mark stops, water refills, or scenic viewpoints as point features on your map. You can also copy important waymarks from overpass layers.
- **Share your map**: decide whether to keep your map private or share it publicly so others can follow your route.

### On the road

Open the map on your phone — either in the browser or the [installed app](https://mapforge.org/doc/app). Your track is already there, synced in real-time.

#### Compass mode

Tap the **geolocate button** (bottom-right) once to follow your position on the map. Tap it again to activate **compass mode** — the map will rotate to match the direction your phone is facing, so the road ahead is always at the top of the screen.

![Compass mode on the bike](/images/tutorials/bike_touring_compass.jpg)

Your position is shown as a dot with a directional cone indicating where you're heading. The screen stays on automatically while compass mode is active, so you don't need to keep tapping your phone.


#### Elevation profile

Tap on your track to open its details and see the **elevation profile**. The chart shows distance vs. elevation, colored by steepness — orange and red for uphill sections, green for downhill. The elevation profile always renders for the part of your track that is currently visible on screen.

<video controls preload="metadata" poster="/images/tutorials/bike_touring_elevation_poster.jpg">
  <source src="/images/tutorials/bike_touring_elevation.webm" type="video/webm">
  <source src="/images/tutorials/bike_touring_elevation.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

As you ride, your current GPS position is shown on the chart so you can see where you are on the profile and what's coming up. The chart displays total elevation gain and loss, and you can tap any point on it to fly the map to that location.


#### Track your ride

If you want to record your ride and see it on a map, you can do so with the [Mapforge µlogger integration](/doc/ulogger#docs). The µlogger [app](https://f-droid.org/packages/net.fabiszewski.ulogger) is available for Android and can be configured to push your location live to Mapforge. You can share the link to your track, so friends can follow your progress.

### After your ride

You can export your track as GPX or GeoJSON from the feature details panel - handy for sharing your route or importing it into other apps.

In the "Share" panel, you can decide to share your track publicly in the Mapforge gallery, or just share the map link with others directly.


### Other Apps and Tools

There are quite some apps that can be used in combination with Mapforge for optimal results in planning your bike trip:

* [mapshaper.org](https://mapshaper.org/) (simplify gpx track before import)
* [cyclosm.org](https://www.cyclosm.org) (base map, also available on mapforge)
* [opencyclemap.org](https://www.opencyclemap.org/) (another bicycle base map, from thunderforest.com)
* [citybik.es](https://citybik.es/) (locations and activities on rental city bikes)
* [graphhopper.com](https://graphhopper.com/maps/?profile=bike&layer=TF+Cycle) (bike routing)
* [mapillary.com](https://www.mapillary.com/) (street view like photos)
* [opencampingmap.org](https://opencampingmap.org) (camp sites)
* [campwild.org](https://map.campwild.org/) (shelters)
* [bikeparking.lorenz.lu](https://bikeparking.lorenz.lu/parkingmap) (bike stands)
* [rackfinder.app](https://rackfinder.app) (bike stands)
* [tilda-geo.de](https://tilda-geo.de/regionen/radinfra) (help to improve bicycle related data in OSM)


Creating bike routes:

* [onthegomap.com](https://onthegomap.com/) (simple routing and track export)
* [cycle.travel](https://cycle.travel/map) (routing + mobile app)
* [bikerouter.de](https://bikerouter.de) (routing with a lot of options)
* [brouter.de](https://brouter.de/brouter-web/) (original project for bikerouter.de)
* [sherpa-map.com](https://sherpa-map.com)
* [veloplanner.com](https://veloplanner.com)


Commercial alternatives for bike routing:

* [ridewithgps.com](https://ridewithgps.com/)
* [alltrails.com](https://www.alltrails.com) (former gpsies.com)