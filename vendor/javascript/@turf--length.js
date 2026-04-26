import{distance as e}from"@turf/distance";import{segmentReduce as t}from"@turf/meta";function n(n,r={}){return t(n,(t,n)=>{let i=n.geometry.coordinates;return t+e(i[0],i[1],r)},0)}var r=n;export{r as default,n as length};

