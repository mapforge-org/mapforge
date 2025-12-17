import{coordEach as t}from"@turf/meta";function n(n,i={}){if(n.bbox!=null&&true!==i.recompute)return n.bbox;const r=[Infinity,Infinity,-Infinity,-Infinity];t(n,(t=>{r[0]>t[0]&&(r[0]=t[0]);r[1]>t[1]&&(r[1]=t[1]);r[2]<t[0]&&(r[2]=t[0]);r[3]<t[1]&&(r[3]=t[1])}));return r}var i=n;export{n as bbox,i as default};

