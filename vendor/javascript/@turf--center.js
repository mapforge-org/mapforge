import{bbox as e}from"@turf/bbox";import{point as t}from"@turf/helpers";function n(n,r={}){let i=e(n);return t([(i[0]+i[2])/2,(i[1]+i[3])/2],r.properties,r)}var r=n;export{n as center,r as default};

