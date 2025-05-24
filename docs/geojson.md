### Supported feature attributes:

Extending the [Mapbox Simplestyle Spec](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0), Mapforge supports these feature attributes:

#### *All* geometries:

* `label`: Label to show on the map (no emoji support)
* `label-size`: font size (default 16)
* `label-color`: font color in format "#000000" (default)
* `label-shadow`: font shadow in format "#ffffff" (default)
* `sort-key`: higher numbers overlay labels with lower numbers (default: 1)
* `title`: title
* `desc`: detailed description (markdown supported)

#### *Point* geometry:

* `marker-color`: circle color (default "green", 'transparent' for none)
* `marker-size`: radius of the marker (default: 6, with 'marker-symbol' fixed to 16 )
* `marker-symbol`: taken as text/emoji, emoji list: https://emojipedia.org/google/15.1
* `marker-image-url`: URL pointing to icon image. Can point to a Mapforge hosted image like /image/<id>
* `stroke-width`: width of the circle border line (default: 2)
* `stroke`: circle border color (default "white", 'transparent' for none)
* `heatmap`: if set, points will be styled as a heatmap

#### *LineString* geometry:

* `stroke-width`: width of the line (default: 2)
* `stroke`: line color (default: 'darkgreen')
* `stroke-opacity`: opacity of the line (default: 0.8)
* `stroke-image-url`: URL pointing to icon image that will get repeated along the line. Can point to a Mapforge hosted image like /icons/direction-arrow.png
* `stroke-symbol`: taken as text/emoji, emoji list: https://emojipedia.org/google/15.1
* `fill-extrusion-color`: color of the extrusion (default: green)
* `fill-extrusion-height`: height in m
* `fill-extrusion-width`: width in m
* `fill-extrusion-base`: ground distance in m (default: 0)
* `show-km-markers`: show markers at each kilometer (default: false)

#### *Polygon* geometry:

* `stroke-width`: width of the line (default: 3)
* `stroke`: line color (default: 'darkgreen', 'transparent' for none)
* `stroke-opacity`: opacity of the line (default: 1.0)
* `fill`: fill color (default: "#0A870A", green, 'transparent' for none)
* `fill-opacity`: opacity of the fill color (default: 0.7)
* `fill-extrusion-color`: color of the extrusion (default: green)
* `fill-extrusion-height`: height in m
* `fill-extrusion-base`: ground distance in m (default: 0)
