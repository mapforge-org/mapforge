# Overpass Layers

Mapforge supports adding custom layers with 'Overpass' queries. You can overlay any type of data that is available on openstreetmap on top of your map. The easiest way is to add one of the pre-defined layers, but you can also fully customize your own layer.
Overpass layers get loaded for the currently visible view of the map. When the map gets moved or zoomed, there appears a button to reload the layer for the current view.  

![Overpass example](https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/docs/tutorials/overpass1.png)

#### Pre-defined Overpass layers 

Mapforge has a couple of useful layers prepared that can easily get added to your map. 
Open the 'Layers' window, click on 'Add query' and chose the query to add. 
There are prepared queries for example for public toilets, camp sites and hiking tracks.

<video controls>
  <source src="https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/docs/tutorials/overpass_predefined.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

#### Custom Overpass layers

Overpass layers are defined in [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) (short for "Overpass Query Language"). 
It's a language that allows to query and construct any kind of data that is available on openstreetmap. You can use [taginfo.openstreetmap.org](https://taginfo.openstreetmap.org/) or the 'Query Features' option on [openstreetmap.org](https://openstreetmap.org) to discover interest tags to build a map for. 

You can apply custom styling to overpass layers, for example setting symbols or icons for clusters and markers. This can be achieved by adding one or more of these 
settings as comments to the query: 

`// heatmap=true` - Results will be rendered as a heat map 
`// marker-symbol=🍻` - Nodes/points will use this symbol (emoji)
`// marker-image-url=/icons/hydrant.png` - URL pointing to icon image
`// cluster=true` - Results will be clustered when too many results are close to each other
`// cluster-symbol=🍻` - Emoji/icon path used for clusters 
`// cluster-image-url=/icons/hydrant.png` - URL pointing to icon image for clusters

<video controls>
  <source src="https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/docs/tutorials/overpass_custom.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

Other sites that can create maps from Overpass queries are: [overpass-ultra.us](https://overpass-ultra.us) and [overpass-turbo.eu](https://overpass-turbo.eu).