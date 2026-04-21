import{getCoord as e}from"@turf/invariant";import{degreesToRadians as t,radiansToLength as n}from"@turf/helpers";function r(r,i,a={}){var o=e(r),s=e(i),c=t(s[1]-o[1]),l=t(s[0]-o[0]),u=t(o[1]),d=t(s[1]),f=Math.sin(c/2)**2+Math.sin(l/2)**2*Math.cos(u)*Math.cos(d);return n(2*Math.atan2(Math.sqrt(f),Math.sqrt(1-f)),a.units)}var i=r;export{i as default,r as distance};

