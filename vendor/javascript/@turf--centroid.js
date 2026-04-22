import{point as e}from"@turf/helpers";import{coordEach as t}from"@turf/meta";function n(n,r={}){let i=0,a=0,o=0;return t(n,function(e){i+=e[0],a+=e[1],o++},!0),e([i/o,a/o],r.properties)}var r=n;export{n as centroid,r as default};

