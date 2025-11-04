// @mapbox/geojson-normalize@0.0.1 downloaded from https://ga.jspm.io/npm:@mapbox/geojson-normalize@0.0.1/index.js

var e={};e=normalize;var t={Point:"geometry",MultiPoint:"geometry",LineString:"geometry",MultiLineString:"geometry",Polygon:"geometry",MultiPolygon:"geometry",GeometryCollection:"geometry",Feature:"feature",FeatureCollection:"featurecollection"};function normalize(e){if(!e||!e.type)return null;var r=t[e.type];return r?"geometry"===r?{type:"FeatureCollection",features:[{type:"Feature",properties:{},geometry:e}]}:"feature"===r?{type:"FeatureCollection",features:[e]}:"featurecollection"===r?e:void 0:null}var r=e;export default r;

