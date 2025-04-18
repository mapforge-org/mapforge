// maplibre-contour@0.1.0 downloaded from https://ga.jspm.io/npm:maplibre-contour@0.1.0/dist/index.mjs

var e,t,i;function define(r,s){if(e)if(t){var n="var sharedChunk = {}; ("+e+")(sharedChunk); ("+t+")(sharedChunk);";var o={};e(o);i=s(o);typeof window!=="undefined"&&(i.workerUrl=window.URL.createObjectURL(new Blob([n],{type:"text/javascript"})))}else t=s;else e=s}define(["exports"],(function(e){class Fragment{constructor(e,t){this.start=e;this.end=t;this.points=[];this.append=this.append.bind(this);this.prepend=this.prepend.bind(this)}append(e,t){this.points.push(Math.round(e),Math.round(t))}prepend(e,t){this.points.splice(0,0,Math.round(e),Math.round(t))}lineString(){return this.toArray()}isEmpty(){return this.points.length<2}appendFragment(e){this.points.push(...e.points);this.end=e.end}toArray(){return this.points}}const t=[[],[[[1,2],[0,1]]],[[[2,1],[1,2]]],[[[2,1],[0,1]]],[[[1,0],[2,1]]],[[[1,2],[0,1]],[[1,0],[2,1]]],[[[1,0],[1,2]]],[[[1,0],[0,1]]],[[[0,1],[1,0]]],[[[1,2],[1,0]]],[[[0,1],[1,0]],[[2,1],[1,2]]],[[[2,1],[1,0]]],[[[0,1],[2,1]]],[[[1,2],[2,1]]],[[[0,1],[1,2]]],[]];function index(e,t,i,r){t=t*2+r[0];i=i*2+r[1];return t+i*(e+1)*2}function ratio(e,t,i){return(t-e)/(i-e)}
/**
 * Generates contour lines from a HeightTile
 *
 * @param interval Vertical distance between contours
 * @param tile The input height tile, where values represent the height at the top-left of each pixel
 * @param extent Vector tile extent (default 4096)
 * @param buffer How many pixels into each neighboring tile to include in a tile
 * @returns an object where keys are the elevation, and values are a list of `[x1, y1, x2, y2, ...]`
 * contour lines in tile coordinates
 */function generateIsolines(e,i,r=4096,s=1){if(!e)return{};const n=r/(i.width-1);let o,a,h,l;let c,d;const u={};const f=new Map;const p=new Map;function interpolate(e,t,i){e[0]===0?i(n*(d-1),n*(c-ratio(h,t,o))):e[0]===2?i(n*d,n*(c-ratio(l,t,a))):e[1]===0?i(n*(d-ratio(a,t,o)),n*(c-1)):i(n*(d-ratio(l,t,h)),n*c)}for(c=1-s;c<i.height+s;c++){a=i.get(0,c-1);l=i.get(0,c);let r=Math.min(a,l);let n=Math.max(a,l);for(d=1-s;d<i.width+s;d++){o=a;h=l;a=i.get(d,c-1);l=i.get(d,c);const s=r;const w=n;r=Math.min(a,l);n=Math.max(a,l);if(isNaN(o)||isNaN(a)||isNaN(l)||isNaN(h))continue;const g=Math.min(s,r);const m=Math.max(w,n);const b=Math.ceil(g/e)*e;const v=Math.floor(m/e)*e;for(let r=b;r<=v;r+=e){const e=o>r;const s=a>r;const n=h>r;const w=l>r;for(const o of t[(e?8:0)|(s?4:0)|(w?2:0)|(n?1:0)]){let e=f.get(r);e||f.set(r,e=new Map);let t=p.get(r);t||p.set(r,t=new Map);const s=o[0];const n=o[1];const a=index(i.width,d,c,s);const h=index(i.width,d,c,n);let l,w;if(l=t.get(a)){t.delete(a);if(w=e.get(h)){e.delete(h);if(l===w){interpolate(n,r,l.append);if(!l.isEmpty()){let e=u[r];e||(u[r]=e=[]);e.push(l.lineString())}}else{l.appendFragment(w);t.set(l.end=w.end,l)}}else{interpolate(n,r,l.append);t.set(l.end=h,l)}}else if(l=e.get(h)){e.delete(h);interpolate(s,r,l.prepend);e.set(l.start=a,l)}else{const i=new Fragment(a,h);interpolate(s,r,i.append);interpolate(n,r,i.append);e.set(a,i);t.set(h,i)}}}}}for(const[e,t]of f.entries()){let i=null;for(const r of t.values())if(!r.isEmpty()){i==null&&(i=u[e]||(u[e]=[]));i.push(r.lineString())}}return u}function __rest(e,t){var i={};for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&t.indexOf(r)<0&&(i[r]=e[r]);if(e!=null&&typeof Object.getOwnPropertySymbols==="function"){var s=0;for(r=Object.getOwnPropertySymbols(e);s<r.length;s++)t.indexOf(r[s])<0&&Object.prototype.propertyIsEnumerable.call(e,r[s])&&(i[r[s]]=e[r[s]])}return i}function __awaiter(e,t,i,r){function adopt(e){return e instanceof i?e:new i((function(t){t(e)}))}return new(i||(i=Promise))((function(i,s){function fulfilled(e){try{step(r.next(e))}catch(e){s(e)}}function rejected(e){try{step(r.throw(e))}catch(e){s(e)}}function step(e){e.done?i(e.value):adopt(e.value).then(fulfilled,rejected)}step((r=r.apply(e,t||[])).next())}))}function sortedEntries(e){const t=Object.entries(e);t.sort((([e],[t])=>e<t?-1:e>t?1:0));return t}function encodeThresholds(e){return sortedEntries(e).map((([e,t])=>[e,...typeof t==="number"?[t]:t].join("*"))).join("~")}function decodeThresholds(e){return Object.fromEntries(e.split("~").map((e=>e.split("*").map(Number))).map((([e,...t])=>[e,t])))}function encodeOptions(e){var{thresholds:t}=e,i=__rest(e,["thresholds"]);return sortedEntries(Object.assign({thresholds:encodeThresholds(t)},i)).map((([e,t])=>`${encodeURIComponent(e)}=${encodeURIComponent(t)}`)).join("&")}function decodeOptions(e){return Object.fromEntries(e.replace(/^.*\?/,"").split("&").map((e=>{const t=e.split("=").map(decodeURIComponent);const i=t[0];let r=t[1];switch(i){case"thresholds":r=decodeThresholds(r);break;case"extent":case"multiplier":case"overzoom":case"buffer":r=Number(r)}return[i,r]})))}function encodeIndividualOptions(e){return sortedEntries(e).map((([e,t])=>`${encodeURIComponent(e)}=${encodeURIComponent(t)}`)).join(",")}function getOptionsForZoom(e,t){const{thresholds:i}=e,r=__rest(e,["thresholds"]);let s=[];let n=-Infinity;Object.entries(i).forEach((([e,i])=>{const r=Number(e);if(r<=t&&r>n){n=r;s=typeof i==="number"?[i]:i}}));return Object.assign({levels:s},r)}function copy(e){const t=new ArrayBuffer(e.byteLength);new Uint8Array(t).set(new Uint8Array(e));return t}function prepareDemTile(e,t){return e.then((e=>{var{data:i}=e,r=__rest(e,["data"]);let s=i;if(t){s=new Float32Array(i.length);s.set(i)}return Object.assign(Object.assign({},r),{data:s,transferrables:[s.buffer]})}))}function prepareContourTile(e){return e.then((({arrayBuffer:e})=>{const t=copy(e);return{arrayBuffer:t,transferrables:[t]}}))}let i=null;function offscreenCanvasSupported(){i==null&&(i=typeof OffscreenCanvas!=="undefined"&&new OffscreenCanvas(1,1).getContext("2d")&&typeof createImageBitmap==="function");return i||false}let r=null;function shouldUseVideoFrame(){if(r==null){r=false;if(offscreenCanvasSupported()&&typeof VideoFrame!=="undefined"){const e=5;const t=new OffscreenCanvas(5,5);const i=t.getContext("2d",{willReadFrequently:true});if(i){for(let t=0;t<e*e;t++){const r=t*4;i.fillStyle=`rgb(${r},${r+1},${r+2})`;i.fillRect(t%e,Math.floor(t/e),1,1)}const t=i.getImageData(0,0,e,e).data;for(let i=0;i<e*e*4;i++)if(i%4!==3&&t[i]!==i){r=true;break}}}}return r||false}function withTimeout(e,t,i){let reject=()=>{};const r=setTimeout((()=>{reject(new Error("timed out"));i===null||i===void 0?void 0:i.abort()}),e);onAbort(i,(()=>{reject(new Error("aborted"));clearTimeout(r)}));const s=new Promise(((e,t)=>{reject=t}));return Promise.race([s,t.finally((()=>clearTimeout(r)))])}function onAbort(e,t){t&&(e===null||e===void 0?void 0:e.signal.addEventListener("abort",t))}function isAborted(e){var t;return Boolean((t=e===null||e===void 0?void 0:e.signal)===null||t===void 0?void 0:t.aborted)}let s=0;class AsyncCache{constructor(e=100){this.size=()=>this.items.size;this.get=(e,t,i)=>{let r=this.items.get(e);if(r){r.lastUsed=++s;r.waiting++}else{const i=new AbortController;const n=t(e,i);r={abortController:i,item:n,lastUsed:++s,waiting:1};this.items.set(e,r);this.prune()}const n=this.items;const o=r.item.then((e=>e),(t=>{n.delete(e);return Promise.reject(t)}));let a=false;onAbort(i,(()=>{var t;if(r&&r.abortController&&!a){a=true;if(--r.waiting<=0){(t=r.abortController)===null||t===void 0?void 0:t.abort();n.delete(e)}}}));return o};this.clear=()=>this.items.clear();this.maxSize=e;this.items=new Map}prune(){if(this.items.size>this.maxSize){let e;let t=Infinity;this.items.forEach(((i,r)=>{if(i.lastUsed<t){t=i.lastUsed;e=r}}));typeof e!=="undefined"&&this.items.delete(e)}}}let n;let o;let a;let h;function decodeImageModern(e,t,i){return __awaiter(this,void 0,void 0,(function*(){const r=yield createImageBitmap(e);return isAborted(i)?null:decodeImageUsingOffscreenCanvas(r,t)}))}function decodeImageUsingOffscreenCanvas(e,t){if(!n){n=new OffscreenCanvas(e.width,e.height);o=n.getContext("2d",{willReadFrequently:true})}return getElevations(e,t,n,o)}function decodeImageVideoFrame(e,t,i){return __awaiter(this,void 0,void 0,(function*(){var r,s,n;const o=yield createImageBitmap(e);if(isAborted(i))return null;const a=new VideoFrame(o,{timestamp:0});try{const e=((r=a===null||a===void 0?void 0:a.format)===null||r===void 0?void 0:r.startsWith("BGR"))||((s=a===null||a===void 0?void 0:a.format)===null||s===void 0?void 0:s.startsWith("RGB"));if(!e)throw new Error(`Unrecognized format: ${a===null||a===void 0?void 0:a.format}`);const i=(n=a===null||a===void 0?void 0:a.format)===null||n===void 0?void 0:n.startsWith("BGR");const h=a.allocationSize();const l=new Uint8ClampedArray(h);yield a.copyTo(l);if(i)for(let e=0;e<l.length;e+=4){const t=l[e];l[e]=l[e+2];l[e+2]=t}return decodeParsedImage(o.width,o.height,t,l)}catch(e){return isAborted(i)?null:decodeImageUsingOffscreenCanvas(o,t)}finally{a.close()}}))}function decodeImageOld(e,t,i){return __awaiter(this,void 0,void 0,(function*(){if(!a){a=document.createElement("canvas");h=a.getContext("2d",{willReadFrequently:true})}const r=new Image;onAbort(i,(()=>r.src=""));const s=yield new Promise(((t,s)=>{r.onload=()=>{isAborted(i)||t(r);URL.revokeObjectURL(r.src);r.onload=null};r.onerror=()=>s(new Error("Could not load image."));r.src=e.size?URL.createObjectURL(e):""}));return getElevations(s,t,a,h)}))}function decodeImageOnMainThread(e,t,i){return self.actor.send("decodeImage",[],i,void 0,e,t)}function isWorker(){return typeof WorkerGlobalScope!=="undefined"&&typeof self!=="undefined"&&self instanceof WorkerGlobalScope}const l=shouldUseVideoFrame()?decodeImageVideoFrame:offscreenCanvasSupported()?decodeImageModern:isWorker()?decodeImageOnMainThread:decodeImageOld;function getElevations(e,t,i,r){i.width=e.width;i.height=e.height;if(!r)throw new Error("failed to get context");r.drawImage(e,0,0,e.width,e.height);const s=r.getImageData(0,0,e.width,e.height).data;return decodeParsedImage(e.width,e.height,t,s)}function decodeParsedImage(e,t,i,r){const s=i==="mapbox"?(e,t,i)=>(e*256*256+t*256+i)*.1-1e4:(e,t,i)=>e*256+t+i/256-32768;const n=new Float32Array(e*t);for(let e=0;e<r.length;e+=4)n[e/4]=s(r[e],r[e+1],r[e+2]);return{width:e,height:t,data:n}}const c=-12e3;const d=9e3;function defaultIsValid(e){return!isNaN(e)&&e>=c&&e<=d}class HeightTile{constructor(e,t,i){this.split=(e,t,i)=>{if(e===0)return this;const r=1<<e;const s=t*this.width/r;const n=i*this.height/r;return new HeightTile(this.width/r,this.height/r,((e,t)=>this.get(e+s,t+n)))};this.subsamplePixelCenters=e=>{const lerp=(e,t,i)=>isNaN(e)?t:isNaN(t)?e:e+(t-e)*i;if(e<=1)return this;const t=.5-1/(2*e);const blerper=(i,r)=>{const s=i/e-t;const n=r/e-t;const o=Math.floor(s);const a=Math.floor(n);const h=this.get(o,a);const l=this.get(o+1,a);const c=this.get(o,a+1);const d=this.get(o+1,a+1);const u=s-o;const f=n-a;const p=lerp(h,l,u);const w=lerp(c,d,u);return lerp(p,w,f)};return new HeightTile(this.width*e,this.height*e,blerper)};this.averagePixelCentersToGrid=(e=1)=>new HeightTile(this.width+1,this.height+1,((t,i)=>{let r=0,s=0,n=0;for(let o=t-e;o<t+e;o++)for(let t=i-e;t<i+e;t++)if(!isNaN(n=this.get(o,t))){s++;r+=n}return s===0?NaN:r/s}));this.scaleElevation=e=>e===1?this:new HeightTile(this.width,this.height,((t,i)=>this.get(t,i)*e));this.materialize=(e=2)=>{const t=this.width+2*e;const i=new Float32Array(t*(this.height+2*e));let r=0;for(let t=-e;t<this.height+e;t++)for(let s=-e;s<this.width+e;s++)i[r++]=this.get(s,t);return new HeightTile(this.width,this.height,((r,s)=>i[(s+e)*t+r+e]))};this.get=i;this.width=e;this.height=t}static fromRawDem(e){return new HeightTile(e.width,e.height,((t,i)=>{const r=e.data[i*e.width+t];return defaultIsValid(r)?r:NaN}))}
/**
     * Construct a height tile from a DEM tile plus it's 8 neighbors, so that
     * you can request `x` or `y` outside the bounds of the original tile.
     *
     * @param neighbors An array containing tiles: `[nw, n, ne, w, c, e, sw, s, se]`
     */static combineNeighbors(e){if(e.length!==9)throw new Error("Must include a tile plus 8 neighbors");const t=e[4];if(!t)return;const i=t.width;const r=t.height;return new HeightTile(i,r,((t,s)=>{let n=0;if(s<0)s+=r;else if(s<r)n+=3;else{s-=r;n+=6}if(t<0)t+=i;else if(t<i)n+=1;else{t-=i;n+=2}const o=e[n];return o?o.get(t,s):NaN}))}}const u=4294967296;const f=1/u;const p=12;const w=typeof TextDecoder==="undefined"?null:new TextDecoder("utf-8");const g=0;const m=1;const b=2;const v=5;class Pbf{
/**
     * @param {Uint8Array | ArrayBuffer} [buf]
     */
constructor(e=new Uint8Array(16)){this.buf=ArrayBuffer.isView(e)?e:new Uint8Array(e);this.dataView=new DataView(this.buf.buffer);this.pos=0;this.type=0;this.length=this.buf.length}
/**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     * @param {number} [end]
     */
readFields(e,t,i=this.length){while(this.pos<i){const i=this.readVarint(),r=i>>3,s=this.pos;this.type=i&7;e(r,t,this);this.pos===s&&this.skip(i)}return t}
/**
     * @template T
     * @param {(tag: number, result: T, pbf: Pbf) => void} readField
     * @param {T} result
     */readMessage(e,t){return this.readFields(e,t,this.readVarint()+this.pos)}readFixed32(){const e=this.dataView.getUint32(this.pos,true);this.pos+=4;return e}readSFixed32(){const e=this.dataView.getInt32(this.pos,true);this.pos+=4;return e}readFixed64(){const e=this.dataView.getUint32(this.pos,true)+this.dataView.getUint32(this.pos+4,true)*u;this.pos+=8;return e}readSFixed64(){const e=this.dataView.getUint32(this.pos,true)+this.dataView.getInt32(this.pos+4,true)*u;this.pos+=8;return e}readFloat(){const e=this.dataView.getFloat32(this.pos,true);this.pos+=4;return e}readDouble(){const e=this.dataView.getFloat64(this.pos,true);this.pos+=8;return e}
/**
     * @param {boolean} [isSigned]
     */readVarint(e){const t=this.buf;let i,r;r=t[this.pos++];i=r&127;if(r<128)return i;r=t[this.pos++];i|=(r&127)<<7;if(r<128)return i;r=t[this.pos++];i|=(r&127)<<14;if(r<128)return i;r=t[this.pos++];i|=(r&127)<<21;if(r<128)return i;r=t[this.pos];i|=(r&15)<<28;return readVarintRemainder(i,e,this)}readVarint64(){return this.readVarint(true)}readSVarint(){const e=this.readVarint();return e%2===1?(e+1)/-2:e/2}readBoolean(){return Boolean(this.readVarint())}readString(){const e=this.readVarint()+this.pos;const t=this.pos;this.pos=e;return e-t>=p&&w?w.decode(this.buf.subarray(t,e)):readUtf8(this.buf,t,e)}readBytes(){const e=this.readVarint()+this.pos,t=this.buf.subarray(this.pos,e);this.pos=e;return t}
/**
     * @param {number[]} [arr]
     * @param {boolean} [isSigned]
     */
readPackedVarint(e=[],t){const i=this.readPackedEnd();while(this.pos<i)e.push(this.readVarint(t));return e}
/** @param {number[]} [arr] */readPackedSVarint(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readSVarint());return e}
/** @param {boolean[]} [arr] */readPackedBoolean(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readBoolean());return e}
/** @param {number[]} [arr] */readPackedFloat(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readFloat());return e}
/** @param {number[]} [arr] */readPackedDouble(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readDouble());return e}
/** @param {number[]} [arr] */readPackedFixed32(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readFixed32());return e}
/** @param {number[]} [arr] */readPackedSFixed32(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readSFixed32());return e}
/** @param {number[]} [arr] */readPackedFixed64(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readFixed64());return e}
/** @param {number[]} [arr] */readPackedSFixed64(e=[]){const t=this.readPackedEnd();while(this.pos<t)e.push(this.readSFixed64());return e}readPackedEnd(){return this.type===b?this.readVarint()+this.pos:this.pos+1}
/** @param {number} val */skip(e){const t=e&7;if(t===g)while(this.buf[this.pos++]>127);else if(t===b)this.pos=this.readVarint()+this.pos;else if(t===v)this.pos+=4;else{if(t!==m)throw new Error(`Unimplemented type: ${t}`);this.pos+=8}}
/**
     * @param {number} tag
     * @param {number} type
     */
writeTag(e,t){this.writeVarint(e<<3|t)}
/** @param {number} min */realloc(e){let t=this.length||16;while(t<this.pos+e)t*=2;if(t!==this.length){const e=new Uint8Array(t);e.set(this.buf);this.buf=e;this.dataView=new DataView(e.buffer);this.length=t}}finish(){this.length=this.pos;this.pos=0;return this.buf.subarray(0,this.length)}
/** @param {number} val */writeFixed32(e){this.realloc(4);this.dataView.setInt32(this.pos,e,true);this.pos+=4}
/** @param {number} val */writeSFixed32(e){this.realloc(4);this.dataView.setInt32(this.pos,e,true);this.pos+=4}
/** @param {number} val */writeFixed64(e){this.realloc(8);this.dataView.setInt32(this.pos,e&-1,true);this.dataView.setInt32(this.pos+4,Math.floor(e*f),true);this.pos+=8}
/** @param {number} val */writeSFixed64(e){this.realloc(8);this.dataView.setInt32(this.pos,e&-1,true);this.dataView.setInt32(this.pos+4,Math.floor(e*f),true);this.pos+=8}
/** @param {number} val */writeVarint(e){e=+e||0;if(e>268435455||e<0)writeBigVarint(e,this);else{this.realloc(4);this.buf[this.pos++]=e&127|(e>127?128:0);if(!(e<=127)){this.buf[this.pos++]=127&(e>>>=7)|(e>127?128:0);if(!(e<=127)){this.buf[this.pos++]=127&(e>>>=7)|(e>127?128:0);e<=127||(this.buf[this.pos++]=e>>>7&127)}}}}
/** @param {number} val */writeSVarint(e){this.writeVarint(e<0?2*-e-1:e*2)}
/** @param {boolean} val */writeBoolean(e){this.writeVarint(+e)}
/** @param {string} str */writeString(e){e=String(e);this.realloc(e.length*4);this.pos++;const t=this.pos;this.pos=writeUtf8(this.buf,e,this.pos);const i=this.pos-t;i>=128&&makeRoomForExtraLength(t,i,this);this.pos=t-1;this.writeVarint(i);this.pos+=i}
/** @param {number} val */writeFloat(e){this.realloc(4);this.dataView.setFloat32(this.pos,e,true);this.pos+=4}
/** @param {number} val */writeDouble(e){this.realloc(8);this.dataView.setFloat64(this.pos,e,true);this.pos+=8}
/** @param {Uint8Array} buffer */writeBytes(e){const t=e.length;this.writeVarint(t);this.realloc(t);for(let i=0;i<t;i++)this.buf[this.pos++]=e[i]}
/**
     * @template T
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */writeRawMessage(e,t){this.pos++;const i=this.pos;e(t,this);const r=this.pos-i;r>=128&&makeRoomForExtraLength(i,r,this);this.pos=i-1;this.writeVarint(r);this.pos+=r}
/**
     * @template T
     * @param {number} tag
     * @param {(obj: T, pbf: Pbf) => void} fn
     * @param {T} obj
     */writeMessage(e,t,i){this.writeTag(e,b);this.writeRawMessage(t,i)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedVarint(e,t){t.length&&this.writeMessage(e,writePackedVarint,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedSVarint(e,t){t.length&&this.writeMessage(e,writePackedSVarint,t)}
/**
     * @param {number} tag
     * @param {boolean[]} arr
     */writePackedBoolean(e,t){t.length&&this.writeMessage(e,writePackedBoolean,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedFloat(e,t){t.length&&this.writeMessage(e,writePackedFloat,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedDouble(e,t){t.length&&this.writeMessage(e,writePackedDouble,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedFixed32(e,t){t.length&&this.writeMessage(e,writePackedFixed32,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedSFixed32(e,t){t.length&&this.writeMessage(e,writePackedSFixed32,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedFixed64(e,t){t.length&&this.writeMessage(e,writePackedFixed64,t)}
/**
     * @param {number} tag
     * @param {number[]} arr
     */writePackedSFixed64(e,t){t.length&&this.writeMessage(e,writePackedSFixed64,t)}
/**
     * @param {number} tag
     * @param {Uint8Array} buffer
     */writeBytesField(e,t){this.writeTag(e,b);this.writeBytes(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeFixed32Field(e,t){this.writeTag(e,v);this.writeFixed32(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeSFixed32Field(e,t){this.writeTag(e,v);this.writeSFixed32(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeFixed64Field(e,t){this.writeTag(e,m);this.writeFixed64(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeSFixed64Field(e,t){this.writeTag(e,m);this.writeSFixed64(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeVarintField(e,t){this.writeTag(e,g);this.writeVarint(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeSVarintField(e,t){this.writeTag(e,g);this.writeSVarint(t)}
/**
     * @param {number} tag
     * @param {string} str
     */writeStringField(e,t){this.writeTag(e,b);this.writeString(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeFloatField(e,t){this.writeTag(e,v);this.writeFloat(t)}
/**
     * @param {number} tag
     * @param {number} val
     */writeDoubleField(e,t){this.writeTag(e,m);this.writeDouble(t)}
/**
     * @param {number} tag
     * @param {boolean} val
     */writeBooleanField(e,t){this.writeVarintField(e,+t)}}
/**
 * @param {number} l
 * @param {boolean | undefined} s
 * @param {Pbf} p
 */function readVarintRemainder(e,t,i){const r=i.buf;let s,n;n=r[i.pos++];s=(n&112)>>4;if(n<128)return toNum(e,s,t);n=r[i.pos++];s|=(n&127)<<3;if(n<128)return toNum(e,s,t);n=r[i.pos++];s|=(n&127)<<10;if(n<128)return toNum(e,s,t);n=r[i.pos++];s|=(n&127)<<17;if(n<128)return toNum(e,s,t);n=r[i.pos++];s|=(n&127)<<24;if(n<128)return toNum(e,s,t);n=r[i.pos++];s|=(n&1)<<31;if(n<128)return toNum(e,s,t);throw new Error("Expected varint not more than 10 bytes")}
/**
 * @param {number} low
 * @param {number} high
 * @param {boolean} [isSigned]
 */function toNum(e,t,i){return i?t*4294967296+(e>>>0):4294967296*(t>>>0)+(e>>>0)}
/**
 * @param {number} val
 * @param {Pbf} pbf
 */function writeBigVarint(e,t){let i,r;if(e>=0){i=e%4294967296|0;r=e/4294967296|0}else{i=~(-e%4294967296);r=~(-e/4294967296);if(i^4294967295)i=i+1|0;else{i=0;r=r+1|0}}if(e>=0x10000000000000000||e<-0x10000000000000000)throw new Error("Given varint doesn't fit into 10 bytes");t.realloc(10);writeBigVarintLow(i,r,t);writeBigVarintHigh(r,t)}
/**
 * @param {number} high
 * @param {number} low
 * @param {Pbf} pbf
 */function writeBigVarintLow(e,t,i){i.buf[i.pos++]=e&127|128;e>>>=7;i.buf[i.pos++]=e&127|128;e>>>=7;i.buf[i.pos++]=e&127|128;e>>>=7;i.buf[i.pos++]=e&127|128;e>>>=7;i.buf[i.pos]=e&127}
/**
 * @param {number} high
 * @param {Pbf} pbf
 */function writeBigVarintHigh(e,t){const i=(e&7)<<4;t.buf[t.pos++]|=i|((e>>>=3)?128:0);if(e){t.buf[t.pos++]=e&127|((e>>>=7)?128:0);if(e){t.buf[t.pos++]=e&127|((e>>>=7)?128:0);if(e){t.buf[t.pos++]=e&127|((e>>>=7)?128:0);if(e){t.buf[t.pos++]=e&127|((e>>>=7)?128:0);e&&(t.buf[t.pos++]=e&127)}}}}}
/**
 * @param {number} startPos
 * @param {number} len
 * @param {Pbf} pbf
 */function makeRoomForExtraLength(e,t,i){const r=t<=16383?1:t<=2097151?2:t<=268435455?3:Math.floor(Math.log(t)/(Math.LN2*7));i.realloc(r);for(let t=i.pos-1;t>=e;t--)i.buf[t+r]=i.buf[t]}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedVarint(e,t){for(let i=0;i<e.length;i++)t.writeVarint(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedSVarint(e,t){for(let i=0;i<e.length;i++)t.writeSVarint(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedFloat(e,t){for(let i=0;i<e.length;i++)t.writeFloat(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedDouble(e,t){for(let i=0;i<e.length;i++)t.writeDouble(e[i])}
/**
 * @param {boolean[]} arr
 * @param {Pbf} pbf
 */function writePackedBoolean(e,t){for(let i=0;i<e.length;i++)t.writeBoolean(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedFixed32(e,t){for(let i=0;i<e.length;i++)t.writeFixed32(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedSFixed32(e,t){for(let i=0;i<e.length;i++)t.writeSFixed32(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedFixed64(e,t){for(let i=0;i<e.length;i++)t.writeFixed64(e[i])}
/**
 * @param {number[]} arr
 * @param {Pbf} pbf
 */function writePackedSFixed64(e,t){for(let i=0;i<e.length;i++)t.writeSFixed64(e[i])}
/**
 * @param {Uint8Array} buf
 * @param {number} pos
 * @param {number} end
 */function readUtf8(e,t,i){let r="";let s=t;while(s<i){const t=e[s];let n=null;let o=t>239?4:t>223?3:t>191?2:1;if(s+o>i)break;let a,h,l;if(o===1)t<128&&(n=t);else if(o===2){a=e[s+1];if((a&192)===128){n=(t&31)<<6|a&63;n<=127&&(n=null)}}else if(o===3){a=e[s+1];h=e[s+2];if((a&192)===128&&(h&192)===128){n=(t&15)<<12|(a&63)<<6|h&63;(n<=2047||n>=55296&&n<=57343)&&(n=null)}}else if(o===4){a=e[s+1];h=e[s+2];l=e[s+3];if((a&192)===128&&(h&192)===128&&(l&192)===128){n=(t&15)<<18|(a&63)<<12|(h&63)<<6|l&63;(n<=65535||n>=1114112)&&(n=null)}}if(n===null){n=65533;o=1}else if(n>65535){n-=65536;r+=String.fromCharCode(n>>>10&1023|55296);n=56320|n&1023}r+=String.fromCharCode(n);s+=o}return r}
/**
 * @param {Uint8Array} buf
 * @param {string} str
 * @param {number} pos
 */function writeUtf8(e,t,i){for(let r,s,n=0;n<t.length;n++){r=t.charCodeAt(n);if(r>55295&&r<57344){if(!s){if(r>56319||n+1===t.length){e[i++]=239;e[i++]=191;e[i++]=189}else s=r;continue}if(r<56320){e[i++]=239;e[i++]=191;e[i++]=189;s=r;continue}r=s-55296<<10|r-56320|65536;s=null}else if(s){e[i++]=239;e[i++]=191;e[i++]=189;s=null}if(r<128)e[i++]=r;else{if(r<2048)e[i++]=r>>6|192;else{if(r<65536)e[i++]=r>>12|224;else{e[i++]=r>>18|240;e[i++]=r>>12&63|128}e[i++]=r>>6&63|128}e[i++]=r&63|128}}return i}var y;(function(e){e[e.UNKNOWN=0]="UNKNOWN";e[e.POINT=1]="POINT";e[e.LINESTRING=2]="LINESTRING";e[e.POLYGON=3]="POLYGON"})(y||(y={}));function encodeVectorTile(e){const t=new Pbf;for(const i in e.layers){const r=e.layers[i];r.extent||(r.extent=e.extent);t.writeMessage(3,writeLayer,Object.assign(Object.assign({},r),{id:i}))}return t.finish()}function writeLayer(e,t){if(!t)throw new Error("pbf undefined");t.writeVarintField(15,2);t.writeStringField(1,e.id||"");t.writeVarintField(5,e.extent||4096);const i={keys:[],values:[],keycache:{},valuecache:{}};for(const r of e.features){i.feature=r;t.writeMessage(2,writeFeature,i)}for(const e of i.keys)t.writeStringField(3,e);for(const e of i.values)t.writeMessage(4,writeValue,e)}function writeFeature(e,t){const i=e.feature;if(!i||!t)throw new Error;t.writeMessage(2,writeProperties,e);t.writeVarintField(3,i.type);t.writeMessage(4,writeGeometry,i)}function writeProperties(e,t){const i=e.feature;if(!i||!t)throw new Error;const r=e.keys;const s=e.values;const n=e.keycache;const o=e.valuecache;for(const e in i.properties){let a=i.properties[e];let h=n[e];if(a===null)continue;if(typeof h==="undefined"){r.push(e);h=r.length-1;n[e]=h}t.writeVarint(h);const l=typeof a;l!=="string"&&l!=="boolean"&&l!=="number"&&(a=JSON.stringify(a));const c=`${l}:${a}`;let d=o[c];if(typeof d==="undefined"){s.push(a);d=s.length-1;o[c]=d}t.writeVarint(d)}}function command(e,t){return(t<<3)+(e&7)}function zigzag(e){return e<<1^e>>31}function writeGeometry(e,t){if(!t)throw new Error;const i=e.geometry;const r=e.type;let s=0;let n=0;for(const e of i){let i=1;r===y.POINT&&(i=e.length/2);t.writeVarint(command(1,i));const o=e.length/2;const a=r===y.POLYGON?o-1:o;for(let i=0;i<a;i++){i===1&&r!==1&&t.writeVarint(command(2,a-1));const o=e[i*2]-s;const h=e[i*2+1]-n;t.writeVarint(zigzag(o));t.writeVarint(zigzag(h));s+=o;n+=h}r===y.POLYGON&&t.writeVarint(command(7,1))}}function writeValue(e,t){if(!t)throw new Error;typeof e==="string"?t.writeStringField(1,e):typeof e==="boolean"?t.writeBooleanField(7,e):typeof e==="number"&&(e%1!==0?t.writeDoubleField(3,e):e<0?t.writeSVarintField(6,e):t.writeVarintField(5,e))}const P=typeof performance!=="undefined"?performance:void 0;const F=P?P.timeOrigin||(new Date).getTime()-P.now():(new Date).getTime();function getResourceTiming(e){var t;return JSON.parse(JSON.stringify(((t=P===null||P===void 0?void 0:P.getEntriesByName)===null||t===void 0?void 0:t.call(P,e))||[]))}function now(){return P?P.now():(new Date).getTime()}function flatten(e){const t=[];for(const i of e)t.push(...i);return t}class Timer{constructor(e){this.marks={};this.urls=[];this.fetched=[];this.resources=[];this.tilesFetched=0;this.timeOrigin=F;this.finish=e=>{this.markFinish();const get=e=>{const t=this.marks[e]||[];const i=Math.max(...t.map((e=>Math.max(...e))));const r=Math.min(...t.map((e=>Math.min(...e))));return Number.isFinite(i)?i-r:void 0};const t=get("main")||0;const i=get("fetch");const r=get("decode");const s=get("isoline");return{url:e,tilesUsed:this.tilesFetched,origin:this.timeOrigin,marks:this.marks,resources:[...this.resources,...flatten(this.fetched.map(getResourceTiming))],duration:t,fetch:i,decode:r,process:s,wait:t-(i||0)-(r||0)-(s||0)}};this.error=e=>Object.assign(Object.assign({},this.finish(e)),{error:true});this.marker=e=>{var t;this.marks[e]||(this.marks[e]=[]);const i=[now()];(t=this.marks[e])===null||t===void 0?void 0:t.push(i);return()=>i.push(now())};this.useTile=e=>{if(this.urls.indexOf(e)<0){this.urls.push(e);this.tilesFetched++}};this.fetchTile=e=>{this.fetched.indexOf(e)<0&&this.fetched.push(e)};this.addAll=e=>{var t;this.tilesFetched+=e.tilesUsed;const i=e.origin-this.timeOrigin;for(const r in e.marks){const s=r;const n=this.marks[s]||(this.marks[s]=[]);n.push(...((t=e.marks[s])===null||t===void 0?void 0:t.map((e=>e.map((e=>e+i)))))||[])}this.resources.push(...e.resources.map((e=>applyOffset(e,i))))};this.markFinish=this.marker(e)}}const k=/(Start$|End$|^start|^end)/;function applyOffset(e,t){const i={};for(const r in e)e[r]!==0&&k.test(r)?i[r]=Number(e[r])+t:i[r]=e[r];return i}const defaultGetTile=(e,t)=>__awaiter(void 0,void 0,void 0,(function*(){const i={signal:t.signal};const r=yield fetch(e,i);if(!r.ok)throw new Error(`Bad response: ${r.status} for ${e}`);return{data:yield r.blob(),expires:r.headers.get("expires")||void 0,cacheControl:r.headers.get("cache-control")||void 0}}));class LocalDemManager{constructor(e){this.loaded=Promise.resolve();this.fetchAndParseTile=(e,t,i,r,s)=>{const n=this;const o=this.demUrlPattern.replace("{z}",e.toString()).replace("{x}",t.toString()).replace("{y}",i.toString());s===null||s===void 0?void 0:s.useTile(o);return this.parsedCache.get(o,((r,o)=>__awaiter(this,void 0,void 0,(function*(){const r=yield n.fetchTile(e,t,i,o,s);if(isAborted(o))throw new Error("canceled");const a=n.decodeImage(r.data,n.encoding,o);const h=s===null||s===void 0?void 0:s.marker("decode");const l=yield a;h===null||h===void 0?void 0:h();return l}))),r)};this.tileCache=new AsyncCache(e.cacheSize);this.parsedCache=new AsyncCache(e.cacheSize);this.contourCache=new AsyncCache(e.cacheSize);this.timeoutMs=e.timeoutMs;this.demUrlPattern=e.demUrlPattern;this.encoding=e.encoding;this.maxzoom=e.maxzoom;this.decodeImage=e.decodeImage||l;this.getTile=e.getTile||defaultGetTile}fetchTile(e,t,i,r,s){const n=this.demUrlPattern.replace("{z}",e.toString()).replace("{x}",t.toString()).replace("{y}",i.toString());s===null||s===void 0?void 0:s.useTile(n);return this.tileCache.get(n,((e,t)=>{s===null||s===void 0?void 0:s.fetchTile(n);const i=s===null||s===void 0?void 0:s.marker("fetch");return withTimeout(this.timeoutMs,this.getTile(n,t).finally((()=>i===null||i===void 0?void 0:i())),t)}),r)}fetchDem(e,t,i,r,s,n){return __awaiter(this,void 0,void 0,(function*(){const o=Math.min(e-(r.overzoom||0),this.maxzoom);const a=e-o;const h=1<<a;const l=Math.floor(t/h);const c=Math.floor(i/h);const d=yield this.fetchAndParseTile(o,l,c,s,n);return HeightTile.fromRawDem(d).split(a,t%h,i%h)}))}fetchContourTile(e,t,i,r,s,n){const{levels:o,multiplier:a=1,buffer:h=1,extent:l=4096,contourLayer:c="contours",elevationKey:d="ele",levelKey:u="level",subsampleBelow:f=100}=r;if(!o||o.length===0)return Promise.resolve({arrayBuffer:new ArrayBuffer(0)});const p=[e,t,i,encodeIndividualOptions(r)].join("/");return this.contourCache.get(p,((s,p)=>__awaiter(this,void 0,void 0,(function*(){const s=1<<e;const w=[];for(let o=i-1;o<=i+1;o++)for(let i=t-1;i<=t+1;i++)w.push(o<0||o>=s?void 0:this.fetchDem(e,(i+s)%s,o,r,p,n));const g=yield Promise.all(w);let m=HeightTile.combineNeighbors(g);if(!m||isAborted(p))return{arrayBuffer:(new Uint8Array).buffer};const b=n===null||n===void 0?void 0:n.marker("isoline");if(m.width>=f)m=m.materialize(2);else while(m.width<f)m=m.subsamplePixelCenters(2).materialize(2);m=m.averagePixelCentersToGrid().scaleElevation(a).materialize(1);const v=generateIsolines(o[0],m,l,h);b===null||b===void 0?void 0:b();const P=encodeVectorTile({extent:l,layers:{[c]:{features:Object.entries(v).map((([e,t])=>{const i=Number(e);return{type:y.LINESTRING,geometry:t,properties:{[d]:i,[u]:Math.max(...o.map(((e,t)=>i%e===0?t:0)))}}}))}}});b===null||b===void 0?void 0:b();return{arrayBuffer:P.buffer}}))),s)}}let x=0;class Actor{constructor(e,t,i=2e4){this.callbacks={};this.cancels={};this.dest=e;this.timeoutMs=i;this.dest.onmessage=e=>__awaiter(this,[e],void 0,(function*({data:e}){const i=e;if(i.type==="cancel"){const e=this.cancels[i.id];delete this.cancels[i.id];e===null||e===void 0?void 0:e.abort()}else if(i.type==="response"){const e=this.callbacks[i.id];delete this.callbacks[i.id];e&&e(i.error?new Error(i.error):void 0,i.response,i.timings)}else if(i.type==="request"){const e=new Timer("worker");const r=t[i.name];const s=new AbortController;const n=r.apply(r,[...i.args,s,e]);const o=`${i.name}_${i.id}`;if(i.id&&n){this.cancels[i.id]=s;try{const t=yield n;const r=t===null||t===void 0?void 0:t.transferrables;this.postMessage({id:i.id,type:"response",response:t,timings:e.finish(o)},r)}catch(t){this.postMessage({id:i.id,type:"response",error:(t===null||t===void 0?void 0:t.toString())||"error",timings:e.finish(o)})}delete this.cancels[i.id]}}}))}postMessage(e,t){this.dest.postMessage(e,t||[])}send(e,t,i,r,...s){const n=++x;const o=new Promise(((i,o)=>{this.postMessage({id:n,type:"request",name:e,args:s},t);this.callbacks[n]=(e,t,s)=>{r===null||r===void 0?void 0:r.addAll(s);e?o(e):i(t)}}));onAbort(i,(()=>{delete this.callbacks[n];this.postMessage({id:n,type:"cancel"})}));return withTimeout(this.timeoutMs,o,i)}}e.A=Actor;e.H=HeightTile;e.L=LocalDemManager;e.T=Timer;e._=__awaiter;e.a=decodeOptions;e.b=generateIsolines;e.c=decodeParsedImage;e.d=l;e.e=encodeOptions;e.f=prepareContourTile;e.g=getOptionsForZoom;e.p=prepareDemTile}));define(["./shared"],(function(e){const noManager=e=>Promise.reject(new Error(`No manager registered for ${e}`));class WorkerDispatch{constructor(){this.managers={};this.init=(t,i)=>{this.managers[t.managerId]=new e.L(t);return Promise.resolve()};this.fetchTile=(e,t,i,r,s,n)=>{var o;return((o=this.managers[e])===null||o===void 0?void 0:o.fetchTile(t,i,r,s,n))||noManager(e)};this.fetchAndParseTile=(t,i,r,s,n,o)=>{var a;return e.p(((a=this.managers[t])===null||a===void 0?void 0:a.fetchAndParseTile(i,r,s,n,o))||noManager(t),true)};this.fetchContourTile=(t,i,r,s,n,o,a)=>{var h;return e.f(((h=this.managers[t])===null||h===void 0?void 0:h.fetchContourTile(i,r,s,n,o,a))||noManager(t))}}}const t=typeof self!=="undefined"?self:typeof window!=="undefined"?window:global;t.actor=new e.A(t,new WorkerDispatch)}));define(["./shared"],(function(e){const t={workerUrl:""};let i;let r=0;class MainThreadDispatch{constructor(){this.decodeImage=(t,i,r)=>e.p(e.d(t,i,r),false)}}function defaultActor(){if(!i){const r=new Worker(t.workerUrl);const s=new MainThreadDispatch;i=new e.A(r,s)}return i}class RemoteDemManager{constructor(e){this.fetchTile=(e,t,i,r,s)=>this.actor.send("fetchTile",[],r,s,this.managerId,e,t,i);this.fetchAndParseTile=(e,t,i,r,s)=>this.actor.send("fetchAndParseTile",[],r,s,this.managerId,e,t,i);this.fetchContourTile=(e,t,i,r,s,n)=>this.actor.send("fetchContourTile",[],s,n,this.managerId,e,t,i,r);const t=this.managerId=++r;this.actor=e.actor||defaultActor();this.loaded=this.actor.send("init",[],new AbortController,void 0,Object.assign(Object.assign({},e),{managerId:t}))}}Blob.prototype.arrayBuffer||(Blob.prototype.arrayBuffer=function arrayBuffer(){return new Promise(((e,t)=>{const i=new FileReader;i.onload=t=>{var i;return e((i=t.target)===null||i===void 0?void 0:i.result)};i.onerror=t;i.readAsArrayBuffer(this)}))});const v3compat=e=>(t,i)=>{if(i instanceof AbortController)return e(t,i);{const r=new AbortController;e(t,r).then((e=>i(void 0,e.data,e.cacheControl,e.expires)),(e=>i(e))).catch((e=>i(e)));return{cancel:()=>r.abort()}}};const s=new Set;class DemSource{constructor({url:t,cacheSize:i=100,id:r="dem",encoding:n="terrarium",maxzoom:o=12,worker:a=true,timeoutMs:h=1e4,actor:l}){this.timingCallbacks=[];this.onTiming=e=>{this.timingCallbacks.push(e)};
/**
         * Adds contour and shared DEM protocol handlers to maplibre.
         *
         * @param maplibre maplibre global object
         */this.setupMaplibre=e=>{e.addProtocol(this.sharedDemProtocolId,this.sharedDemProtocol);e.addProtocol(this.contourProtocolId,this.contourProtocol)};this.sharedDemProtocolV4=(t,i)=>e._(this,void 0,void 0,(function*(){const[r,s,n]=this.parseUrl(t.url);const o=new e.T("main");let a;try{const e=yield this.manager.fetchTile(r,s,n,i,o);a=o.finish(t.url);const h=yield e.data.arrayBuffer();return{data:h,cacheControl:e.cacheControl,expires:e.expires}}catch(e){a=o.error(t.url);throw e}finally{this.timingCallbacks.forEach((e=>e(a)))}}));this.contourProtocolV4=(t,i)=>e._(this,void 0,void 0,(function*(){const r=new e.T("main");let s;try{const[n,o,a]=this.parseUrl(t.url);const h=e.a(t.url);const l=yield this.manager.fetchContourTile(n,o,a,e.g(h,n),i,r);s=r.finish(t.url);return{data:l.arrayBuffer}}catch(e){s=r.error(t.url);throw e}finally{this.timingCallbacks.forEach((e=>e(s)))}}));this.contourProtocol=v3compat(this.contourProtocolV4);this.sharedDemProtocol=v3compat(this.sharedDemProtocolV4);this.contourProtocolUrl=t=>`${this.contourProtocolUrlBase}?${e.e(t)}`;let c=r;let d=1;while(s.has(c))c=r+d++;s.add(c);this.sharedDemProtocolId=`${c}-shared`;this.contourProtocolId=`${c}-contour`;this.sharedDemProtocolUrl=`${this.sharedDemProtocolId}://{z}/{x}/{y}`;this.contourProtocolUrlBase=`${this.contourProtocolId}://{z}/{x}/{y}`;const u=a?RemoteDemManager:e.L;this.manager=new u({demUrlPattern:t,cacheSize:i,encoding:n,maxzoom:o,timeoutMs:h,actor:l})}getDemTile(e,t,i,r){return this.manager.fetchAndParseTile(e,t,i,r||new AbortController)}parseUrl(e){const[,t,i,r]=/\/\/(\d+)\/(\d+)\/(\d+)/.exec(e)||[];return[Number(t),Number(i),Number(r)]}}const n={generateIsolines:e.b,DemSource:DemSource,HeightTile:e.H,LocalDemManager:e.L,decodeParsedImage:e.c,set workerUrl(e){t.workerUrl=e},get workerUrl(){return t.workerUrl}};return n}));var r=i;export{r as default};

