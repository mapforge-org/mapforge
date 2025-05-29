export function style (geojson, queryName) {
  const template = queries.find(q => q.name === queryName)
  if (template) {
    geojson.features.forEach( f => template.style(f) )
    return geojson
  }
}

export const queries = [{
  name: 'Public toilets',
  query: "nwr[amenity=toilets];out center;",
  style: (f) => {
    if (['toilets'].includes(f.properties.amenity)) {
       f.properties["marker-symbol"] = "🚻"
       f.properties["marker-color"] = "transparent"
    }
  }
}]
