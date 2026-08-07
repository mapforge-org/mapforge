import{coordEach as e}from"@turf/meta";function t(t,n={}){if(t.bbox!=null&&!0!==n.recompute)return t.bbox;let r=[1/0,1/0,-1/0,-1/0];return e(t,e=>{r[0]>e[0]&&(r[0]=e[0]),r[1]>e[1]&&(r[1]=e[1]),r[2]<e[0]&&(r[2]=e[0]),r[3]<e[1]&&(r[3]=e[1])}),r}var n=t;export{t as bbox,n as default};

