# Advanced feature styling

Mapforge stores your maps in GeoJSON format. Below you can see the list of supported properties to style your map elements (called *features* in GeoJSON).
Most of the properties are supported to be changed in the UI. For changing the properties directly, you can use the *Edit JSON* button in the feature details modal.

### Supported feature attributes:

Extending the [Mapbox Simplestyle Spec](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0), Mapforge supports these feature attributes:

#### *All* geometries:

* `label`: Label to show on the map (no emoji support)
* `label-title`: heading line, drawn above `label` at 1.3 times `label-size` (works without a `label`, and takes the same color, font, anchor and offset as the label)
* `label-size`: font size (default 16, max. 254)
* `label-font`: label font array (default depends on base map, like `["noto_sans_regular"]`), see *[Label fonts](#label-fonts)* below
* `label-color`: font color in format "#000000" (default)
* `label-justify`: alignment: auto (default), left, center, right
* `label-max-width`: line width (default 10)
* `label-letter-spacing`: space between letters (default 0)
* `label-shadow`: font shadow in format "#ffffff" (default)
* `label-shadow-width`: shadow width/halo width in pixels (default 2, max. 5)
* `label-anchor`: text anchor position relative to the feature: top (default), bottom, left, right, center, top-left, top-right, bottom-left, bottom-right
* `label-offset`: label position offset from the anchor as `[x, y]` in em units (default: depends on marker size for `label-anchor: top`, otherwise `[0, 0]`)
* `sort-key`: sort order of features: higher numbers overlay lower numbers (default: 1)
* `min-zoom`: Display feature only on zoom levels bigger than min-zoom (only integer values)
* `max-zoom`: Display feature only on zoom levels smaller than max-zoom (only integer values)
* `level`: floor the feature belongs to (e.g. `"0"`, `"1"`, `"-1"`). Accepts an OSM-style semicolon-separated list (`"0;1;2"`) for features that span multiple floors. Features without this property are always visible.
* `title`: title
* `desc`: detailed description (markdown supported)
* `onclick`: on hover/click behavior: 'details' (default), 'false' (do not react on hover/click), 'link' (link to url), 'feature' (link to another feature on the map)
* `onclick-target`: required for onclick=link/feature: url or feature id of target

#### *Point* geometry:

* `marker-color`: circle color (default "green", 'transparent' for none)
* `marker-size`: radius of the marker (default: 6, with 'marker-symbol' fixed to 16 )
* `marker-opacity`: opacity of the marker (default: 0.7)
* `marker-symbol`: taken as text/emoji, emoji list: https://emojipedia.org/google/15.1
* `marker-image-url`: URL pointing to icon image. Can point to a Mapforge hosted image like /image/<id>. Disables `marker-color` and `stroke`.
* `marker-scaling`: marker scales with zoom level (default: false)
* `stroke-width`: width of the circle border line (default: 2)
* `stroke`: circle border color (default "white", 'transparent' for none)
* `heatmap`: if set, points will be styled as a heatmap
* `flat`: if set, marker + label with be projected 'flat' on the map
* `marker-rotate`: rotate marker by x degrees clockwise

#### *LineString* geometry:

* `stroke-width`: width of the line (default: 2)
* `stroke`: line color (default: 'darkgreen')
* `stroke-opacity`: opacity of the line (default: 0.8)
* `stroke-image-url`: URL pointing to icon image that will get repeated along the line. Can point to a Mapforge hosted image like /icons/direction-arrow.png
* `stroke-symbol`: taken as text/emoji, emoji list: https://emojipedia.org/google/16
* `stroke-dasharray`: true/false for making the stroke line dashed (default: false)
* `fill-extrusion-color`: color of the extrusion (default: green, a 'transparent' `stroke` is ignored here)
* `fill-extrusion-height`: height in m
* `fill-extrusion-width`: width in m
* `fill-extrusion-base`: ground distance in m (default: 0)
* `fill-extrusion-opacity`: opacity of the extrusion, rounded to nearest 0.1 (default: 0.9)
* `fill-extrusion-shadow`: true/false for the ground below the extrusion (default: true with a base, else false)
* `show-km-markers`: show markers at each kilometer (default: false)

#### *Polygon* geometry:

* `stroke-width`: width of the line (default: 3)
* `stroke`: line color (default: 'darkgreen', 'transparent' for none)
* `stroke-opacity`: opacity of the line (default: 1.0)
* `fill`: fill color (default: "#0A870A", green, 'transparent' for none)
* `fill-opacity`: opacity of the fill color (default: 0.9)
* `fill-extrusion-color`: color of the extrusion (default: green, a 'transparent' `fill` is ignored here)
* `fill-extrusion-height`: height in m
* `fill-extrusion-base`: ground distance in m (default: 0)
* `fill-extrusion-opacity`: opacity of the extrusion, rounded to nearest 0.1 (defaults to `fill-opacity`, else 0.9)
* `fill-extrusion-shadow`: true/false for the ground below the extrusion (default: true with a base, else false)

### Label fonts

`label-font` takes an array of font names. Names are looked up in two places:

1. **The glyph server of the base map.** Every base map ships a fixed set of fonts, so the valid names differ per map: `noto_sans_regular` / `noto_sans_bold` and 16 other families on the VersaTiles based maps ([full list](https://github.com/versatiles-org/versatiles-fonts/tree/main/fonts)), `Noto Sans Regular` and friends on the MapTiler and OpenFreeMap based maps.
2. **Web fonts and device fonts.** If the name is not on the glyph server, the label is rendered in the browser instead, from any font the browser can resolve by CSS name. That covers the web fonts Mapforge loads on every page — `SUSE`, `Bree Serif`, `Lobster Two` — and the fonts installed on the device of the viewer.

#### Weight and style

There is no separate weight property. The **first** entry of the array decides weight and style, the entries after it are the family the browser actually resolves:

```json
{ "label": "Hello", "label-font": ["SUSE Bold", "SUSE"] }
```

Recognized keywords in that first entry: `thin` 100, `extra light` 200, `light` 300, `regular` 400, `medium` 500, `semibold` 600, `bold` 700, `extra bold` 800, `heavy` 900, plus `italic` and `oblique`. `"SUSE Light Italic", "SUSE"` renders SUSE at weight 300, italic.
