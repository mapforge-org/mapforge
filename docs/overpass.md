# Overpass queries 

Mapforge supports adding layers defined by Overpass queries. 
There are a couple of pre-defined queries available to add to your map, 
or you can define a custom query. 

Read more about the Overpass Query Language here: 
https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL

The look of query results can be customized by adding one or more of these 
settings as comments to the query: 

`// heatmap=true` - Results will be rendered as a heat map 

`// marker-symbol=🍻` - Nodes/points will use this symbol (emoji)
`// marker-image-url=/icons/hydrant.png` - URL pointing to icon image

`// cluster=true` - Results will be clustered when too many results are close to each other
`// cluster-symbol=🍻` - Emoji/icon path used for clusters 
`// cluster-image-url=/icons/hydrant.png` - URL pointing to icon image for clusters
