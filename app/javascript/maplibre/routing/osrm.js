import MapLibreGlDirections from "@maplibre/maplibre-gl-directions"

// https://github.com/maplibre/maplibre-gl-directions/tree/main
// Examples: https://maplibre.org/maplibre-gl-directions/#/examples
// OSRM routing server: https://project-osrm.org/, backend: https://github.com/Project-OSRM/osrm-backend/tree/master
// OSRM router.project-osrm.org rules: https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
// FOSSGIS rules: https://fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/

map.once('load', async function (_e) {

  const directions = new MapLibreGlDirections(map);
  directions.interactive = true;
})
