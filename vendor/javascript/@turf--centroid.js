// @turf/centroid@7.3.0 downloaded from https://ga.jspm.io/npm:@turf/centroid@7.3.0/dist/esm/index.js

import{point as t}from"@turf/helpers";import{coordEach as r}from"@turf/meta";function e(e,o={}){let f=0;let u=0;let p=0;r(e,(function(t){f+=t[0];u+=t[1];p++}),true);return t([f/p,u/p],o.properties)}var o=e;export{e as centroid,o as default};

