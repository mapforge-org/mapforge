import{distance as r}from"@turf/distance";import{segmentReduce as t}from"@turf/meta";function o(o,e={}){return t(o,((t,o)=>{const n=o.geometry.coordinates;return t+r(n[0],n[1],e)}),0)}var e=o;export{e as default,o as length};

