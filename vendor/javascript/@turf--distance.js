// @turf/distance@7.3.0 downloaded from https://ga.jspm.io/npm:@turf/distance@7.3.0/dist/esm/index.js

import{getCoord as a}from"@turf/invariant";import{degreesToRadians as t,radiansToLength as r}from"@turf/helpers";function h(h,o,n={}){var s=a(h);var v=a(o);var M=t(v[1]-s[1]);var i=t(v[0]-s[0]);var f=t(s[1]);var p=t(v[1]);var u=Math.pow(Math.sin(M/2),2)+Math.pow(Math.sin(i/2),2)*Math.cos(f)*Math.cos(p);return r(2*Math.atan2(Math.sqrt(u),Math.sqrt(1-u)),n.units)}var o=h;export{o as default,h as distance};

