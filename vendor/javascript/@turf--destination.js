// @turf/destination@7.3.0 downloaded from https://ga.jspm.io/npm:@turf/destination@7.3.0/dist/esm/index.js

import{degreesToRadians as t,lengthToRadians as s,radiansToDegrees as n,point as o}from"@turf/helpers";import{getCoord as a}from"@turf/invariant";function i(i,r,c,h={}){const M=a(i);const e=t(M[0]);const p=t(M[1]);const f=t(c);const u=s(r,h.units);const m=Math.asin(Math.sin(p)*Math.cos(u)+Math.cos(p)*Math.sin(u)*Math.cos(f));const v=e+Math.atan2(Math.sin(f)*Math.sin(u)*Math.cos(p),Math.cos(u)-Math.sin(p)*Math.sin(m));const d=n(v);const l=n(m);return M[2]!==void 0?o([d,l,M[2]],h.properties):o([d,l],h.properties)}var r=i;export{r as default,i as destination};

