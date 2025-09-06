# OpenStreetMap data layers (Overpass)

Mapforge enables you to add custom data layers from OpenStreetMap using **Overpass queries**. Overpass is a powerful search language for map data: You can find specific places, roads, buildings, or any feature mapped in OpenStreetMap's global database.

Overpass layers get loaded for the currently visible view of the map. When the map gets moved or zoomed, a reload button appears to fetch data for the new area.  

![Overpass example](https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/docs/tutorials/overpass1.png)


### Pre-defined Overpass layers 

Mapforge has a couple of ready-to-use layers prepared that can easily get added to your map. 
Open the 'Layers' window, click on 'Add query' and chose the query to add. 
There are prepared queries to cover common mapping needs for example for public toilets, camp sites and hiking tracks.

<video  poster="https://github.com/user-attachments/assets/8a41306e-bf5b-4204-b681-e337b9ce975d" controls>
  <source src="https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/docs/tutorials/overpass_predefined.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

### Custom Overpass layers

Overpass queries are defined in [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) (short for "Overpass Query Language"). 
This powerful language lets you query any data available in OpenStreetMap. You can browse the [official tags list](https://wiki.openstreetmap.org/wiki/Map_features), [taginfo.openstreetmap.org](https://taginfo.openstreetmap.org/), or the 'Query Features' option on [openstreetmap.org](https://openstreetmap.org) to discover interesting tags to create queries for and include in your map. 

You can enhance your layers with visual customization, for example setting symbols or icons for clusters and markers. This can be achieved by adding one or more of these settings as comments to the query:

`// heatmap=true` - Results will be rendered as a heat map (default=false)
`// marker-symbol=🍻` - Nodes/points will use this symbol (emoji)
`// marker-image-url=/icons/hydrant.png` - URL pointing to icon image
`// cluster=true` - Results will be clustered when too many results are close to each other (default=true)
`// cluster-symbol=🍻` - Emoji/icon path used for clusters 
`// cluster-image-url=/icons/hydrant.png` - URL pointing to icon image for clusters

<video poster="https://github.com/user-attachments/assets/ae7a6366-563d-4a63-9dfc-5d4825c53565" controls>
  <source src="https://raw.githubusercontent.com/mapforge-org/mapforge/refs/heads/main/docs/tutorials/overpass_custom.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

Other recommended sites that can create maps from Overpass queries are: [overpass-ultra.us](https://overpass-ultra.us) and [overpass-turbo.eu](https://overpass-turbo.eu).
