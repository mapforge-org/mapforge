export function getQueryTemplate(queryName) {
  return queries.find(q => q.name === queryName)
}

export function applyOverpassQueryStyle (geojson, queryName) {
  const template = getQueryTemplate(queryName)
  if (template) {
    geojson.features.forEach(f => { if(template.style) { template.style(f) }} )
  }
  return geojson
}

export const queries = [
  { name: 'Public toilets',
    query: "// marker-symbol=🚻\nnwr[amenity=toilets];out center 250;"
  },
  // Brewery restaurants are tagged with microbrewery=yes (https://wiki.openstreetmap.org/wiki/Brewery)
  { name: 'Breweries',
    query: '// cluster=true\n' + 
      '// cluster-symbol=🍻\n(nwr["craft"~"brewery",i];nwr["microbrewery"="yes"];nwr["industrial"="brewery"];);out center 250;',
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
      } else if (f.properties?.industrial?.includes('brewery')) {
        f.properties["marker-image-url"] = "/emojis/noto/🏭.png"
        f.properties["marker-size"] = "20"
        f.properties["marker-color"] = "transparent"
        f.properties["stroke"] = "transparent"
      }
    }
  },
  { name: 'Subway',
    query: '(relation["railway"="subway"];way["railway"="subway"];); \n' +
           'out geom;\n' +
           'node["railway"="station"]["station"="subway"];\n' +
           'out center 250;',
    style: (f) => {
      if (f.properties?.subway === 'yes') {
         f.properties["marker-symbol"] = "🚇"
      }
      if (f.properties?.train === 'yes') {
         f.properties["marker-symbol"] = "🚆"
      }
  }},
  { name: 'Drinking water',
    query: '// marker-symbol=🚰\n' +
      '// cluster=true\n' +
      '// cluster-symbol=🚰\n' +
      'nwr[amenity=drinking_water];out center 250;'
  },
  { name: 'Hiking routes',
    query: "relation[type=route][route=hiking];out geom 75;",
    style: (f) => {
      // TODO: Find a way to not select the points in the query
      if (f.geometry.type === 'Point') {
        f.properties["marker-color"] = "transparent"
        f.properties["stroke"] = "transparent"
      }
    }
  },
  { name: 'Bicycle routes',
    query: "relation[type=route][route=bicycle];out geom 75;",
  },
  { name: 'Camping',
    query: '// marker-symbol=🏕️\n' + 
      '// cluster=true\n' +
      '// cluster-symbol=🏕️\n' +
      'nwr[tourism=camp_site];out center;'
  },
  { name: 'Feuerwehr',
    query: '// marker-symbol=🚒\n' +
      '// cluster=true\n' +
      '// cluster-symbol=🚒\n' +
      'nwr[amenity=fire_station];\nout center 500;'
  },
  {
    name: 'Hydranten',
    query: '// marker-image-url=/icons/hydrant.png\n' +
      '// cluster=true\n' +
      '// cluster-image-url=/icons/hydrant.png\n' +
      'node["emergency"="fire_hydrant"];\nout body 1000;',
    style: (f) => {
      if (['fire_hydrant'].includes(f.properties['emergency'])) {
        f.properties["marker-symbol"] = "🌊"
        f.properties["marker-color"] = "#fff"
      }
    }
  },  
  { name: 'Trains',
    query: '(relation["route"="tracks"]; // Train tracks (railways)\n' +
           'node["railway"="station"][subway!=yes]; // Train stations\n' +
           'node["railway"="halt"][usage!=leisure][subway!=yes];\n' +
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
    query: '(nwr["internet_access:fee"=no];nwr["internet_access:fee"=customers];);out center 250;',
    style: (f) => {
      if (['no', 'customers'].includes(f.properties['internet_access:fee'])) {
        f.properties["marker-symbol"] = "🛜"
      }
    }
  },
  { name: 'Food Shops',
    query: '// cluster=true\n' +
      '// cluster-symbol=🥨\n' +
      '(nwr[shop=supermarket];\n' +
      'nwr[amenity=fuel][shop=yes];\n' +
      'nwr[shop=bakery];\n' +
      // 'nwr[shop=butcher];\n' +
      ');out center 250;',
    style: (f) => {
      if (['supermarket'].includes(f.properties['shop'])) {
        f.properties["marker-symbol"] = "🛒"
        f.properties["marker-color"] = "#000"
      }
      if (['fuel'].includes(f.properties['amenity'])) {
        f.properties["marker-symbol"] = "⛽"
      }
      if (['bakery'].includes(f.properties['shop'])) {
        f.properties["marker-symbol"] = "🥨"
      }
      if (['butcher'].includes(f.properties['shop'])) {
        f.properties["marker-symbol"] = "🥩"
      }
    }
  },
  {
    name: 'Swimming pools 🏊',
    query: '// cluster=true\n' +
      '// cluster-symbol=🏊\n' +
      'nwr[leisure = water_park];\n' +
      'out center 250;\n' +
      'nwr[leisure = water_park];\n' +
      'out geom 250;',
    style: (f) => {
      if (f.geometry.type === 'Point'){
        f.properties["marker-symbol"] = "🏊"
        f.properties["marker-color"] = "transparent"
      }
      if (f.geometry.type === 'Polygon') {
        f.properties["label"] = ""
      }
    }
  }
]
