export function style (geojson, queryName) {
  const template = queries.find(q => q.name === queryName)
  if (template) {
    geojson.features.forEach(f => { if(template.style) { template.style(f) }} )
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
    query: '(nwr["craft"~"brewery",i];nwr["microbrewery"="yes"];nwr["industrial"="brewery"];);out center;',
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
  }},
  { name: 'Hiking routes',
    query: "relation[type=route][route=hiking];out geom 200;",
  },
  { name: 'Bicycle routes',
    query: "relation[type=route][route=bicycle];out geom;",
  },
  { name: 'Camping',
    query: "nwr[tourism=camp_site];out center;",
    style: (f) => {
      if (f.properties.tourism === 'camp_site') {
        f.properties["marker-symbol"] = "🏕️"
      }
    }
  },
  { name: 'Feuerwehr',
    query: "nwr[amenity=fire_station];out center;",
  },
  { name: 'Trains',
    query: '(relation["route"="tracks"]; // Train tracks (railways)\n' +
           'node["railway"="station"]; // Train stations\n' +
           'node["railway"="halt"];\n' +
           '//way["railway"="station"];\n' +
           '//relation["railway"="station"];\n' +
           ');\n' +
           'out geom 250;\n',
    style: (f) => {
      f.properties.desc = "[Abfahrten](https://bahn.expert/" +
        encodeURIComponent(f.properties.name) + ")\n" + f.properties.desc
      if (f.properties.route === "tracks") {
         f.properties["stroke"] = "black"
         f.properties["stroke-width"] = "2"
      }
      if (["halt", "station"].includes(f.properties.railway)) {
        f.properties["marker-size"] = "5"
        f.properties["marker-color"] = "#000"
        f.properties["stroke"] = "transparent"
      }
    }
  },
  { name: 'Wifi',
    query: '(nwr["internet_access:fee"=no];nwr["internet_access:fee"=customers];);out center;',
    style: (f) => {
      if (['no', 'customers'].includes(f.properties['internet_access:fee'])) {
        f.properties["marker-symbol"] = "🛜"
      }
    }
  },
  { name: 'Food Shops',
    query: '(nwr[shop=supermarket];\n' +
           'nwr[amenity=fuel][shop=yes];\n' +
           'nwr[shop=bakery];\n' +
           // 'nwr[shop=butcher];\n' +
           ');out center;',
    style: (f) => {
      if (['supermarket'].includes(f.properties['shop'])) {
        f.properties["marker-symbol"] = "🛒"
      }
      if (['fuel'].includes(f.properties['amenity'])) {
        f.properties["marker-symbol"] = "⛽"
      }
      if (['bakery'].includes(f.properties['shop'])) {
        f.properties["marker-symbol"] = "🥐"
      }
      if (['butcher'].includes(f.properties['shop'])) {
        f.properties["marker-symbol"] = "🥩"
      }
    }
  }
]
