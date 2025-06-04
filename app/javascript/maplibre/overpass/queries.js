export function style (geojson, queryName) {
  const template = queries.find(q => q.name === queryName)
  if (template) {
    geojson.features.forEach( f => template.style(f) )
  }
  return geojson
}

export const queries = [
  { name: 'Public toilets',
    query: "nwr[amenity=toilets];out center;",
    style: (f) => {
      if (['toilets'].includes(f.properties.amenity)) {
         f.properties["marker-symbol"] = "🚻"
         f.properties["marker-color"] = "transparent"
      }
  }},
  // Brewery restaurants are tagged with microbrewery=yes (https://wiki.openstreetmap.org/wiki/Brewery)
  { name: 'Breweries',
    query: '(nwr["craft"~"brewery",i];nwr["microbrewery"="yes"];);out center;',
    style: (f) => {
      if (f.properties?.microbrewery === 'yes') {
        f.properties["marker-symbol"] = "🍻"
        f.properties["stroke"] = "#ffffff"
        f.properties["marker-color"] = "transparent"
      } else if (f.properties?.craft?.includes('brewery')) {
        f.properties["marker-image-url"] = "/icons/barrel-48.png"
        f.properties["marker-size"] = "20"
        f.properties["marker-color"] = "transparent"
        f.properties["stroke"] = "transparent"
      }
  }},
  { name: 'Subway',
    query: '(relation["railway"="subway"];way["railway"="subway"];); \n' +
           'out geom;\n' +
           'node["railway"="station"]["station"="subway"];\n' +
           'out center;',
    style: (f) => {
      if (f.properties?.subway === 'yes') {
         f.properties["marker-symbol"] = "🚇"
      }
      if (f.properties?.train === 'yes') {
         f.properties["marker-symbol"] = "🚆"
      }
  }},
  { name: 'Drinking water',
    query: "nwr[amenity=drinking_water];out center;",
    style: (f) => {
      if (f.properties.amenity === 'drinking_water') {
         f.properties["marker-symbol"] = "🚰"
         f.properties["marker-color"] = "transparent"
         f.properties["stroke"] = "transparent"
      }
  }}
]
