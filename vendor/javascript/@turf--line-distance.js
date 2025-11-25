// @turf/line-distance@4.7.3 downloaded from https://ga.jspm.io/npm:@turf/line-distance@4.7.3/index.js

import r from"@turf/distance";import e from"@turf/meta";var t={};var o=r;var n=e.segmentReduce;t=function lineDistance(r,e){if(!r)throw new Error("geojson is required");return n(r,(function(r,t){var n=t.geometry.coordinates;return r+o(n[0],n[1],e)}),0)};var i=t;export default i;

