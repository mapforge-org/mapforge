// @turf/bearing@7.3.0 downloaded from https://ga.jspm.io/npm:@turf/bearing@7.3.0/dist/esm/index.js

import{degreesToRadians as t,radiansToDegrees as n}from"@turf/helpers";import{getCoord as o}from"@turf/invariant";function r(r,a,c={}){if(c.final===true)return s(r,a);const i=o(r);const e=o(a);const f=t(i[0]);const h=t(e[0]);const u=t(i[1]);const M=t(e[1]);const l=Math.sin(h-f)*Math.cos(M);const m=Math.cos(u)*Math.sin(M)-Math.sin(u)*Math.cos(M)*Math.cos(h-f);return n(Math.atan2(l,m))}function s(t,n){let o=r(n,t);o=(o+180)%360;return o}var a=r;export{r as bearing,a as default};

