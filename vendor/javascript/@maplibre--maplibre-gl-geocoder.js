// @maplibre/maplibre-gl-geocoder@1.9.4 downloaded from https://ga.jspm.io/npm:@maplibre/maplibre-gl-geocoder@1.9.4/dist/maplibre-gl-geocoder.mjs

function e(e,t,i,s){function n(e){return e instanceof i?e:new i((function(t){t(e)}))}return new(i||(i=Promise))((function(i,r){function o(e){try{l(s.next(e))}catch(e){r(e)}}function a(e){try{l(s.throw(e))}catch(e){r(e)}}function l(e){e.done?i(e.value):n(e.value).then(o,a)}l((s=s.apply(e,t||[])).next())}))}typeof SuppressedError==="function"?SuppressedError:function(e,t,i){var s=new Error(i);return s.name="SuppressedError",s.error=e,s.suppressed=t,s};var t=typeof globalThis!=="undefined"?globalThis:typeof window!=="undefined"?window:typeof global!=="undefined"?global:typeof self!=="undefined"?self:{};function i(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}var s;var n;function r(){if(n)return s;n=1;s=t;var e=Object.prototype.hasOwnProperty;function t(){var t={};for(var i=0;i<arguments.length;i++){var s=arguments[i];for(var n in s)e.call(s,n)&&(t[n]=s[n])}return t}return s}var o={exports:{}};var a;function l(){if(a)return o.exports;a=1;(function(e){(function(){var t={};e.exports=t;t.simpleFilter=function(e,i){return i.filter((function(i){return t.test(e,i)}))};t.test=function(e,i){return t.match(e,i)!==null};t.match=function(e,t,i){i=i||{};var s,n=0,r=[],o=t.length,a=0,l=0,h=i.pre||"",u=i.post||"",c=i.caseSensitive&&t||t.toLowerCase();e=i.caseSensitive&&e||e.toLowerCase();for(var p=0;p<o;p++){s=t[p];if(c[p]===e[n]){s=h+s+u;n+=1;l+=1+l}else l=0;a+=l;r[r.length]=s}if(n===e.length){a=c===e?Infinity:a;return{rendered:r.join(""),score:a}}return null};t.filter=function(e,i,s){if(!i||i.length===0)return[];if(typeof e!=="string")return i;s=s||{};return i.reduce((function(i,n,r,o){var a=n;s.extract&&(a=s.extract(n));var l=t.match(e,a,s);l!=null&&(i[i.length]={string:l.rendered,score:l.score,index:r,original:n});return i}),[]).sort((function(e,t){var i=t.score-e.score;return i||e.index-t.index}))}})()})(o);return o.exports}var h;var u;function c(){if(u)return h;u=1;var e=function(e){this.component=e;this.items=[];this.active=e.options.noInitialSelection?-1:0;this.wrapper=document.createElement("div");this.wrapper.className="suggestions-wrapper";this.element=document.createElement("ul");this.element.className="suggestions";this.wrapper.appendChild(this.element);this.selectingListItem=false;e.el.parentNode.insertBefore(this.wrapper,e.el.nextSibling);return this};e.prototype.show=function(){this.element.style.display="block"};e.prototype.hide=function(){this.element.style.display="none"};e.prototype.add=function(e){this.items.push(e)};e.prototype.clear=function(){this.items=[];this.active=this.component.options.noInitialSelection?-1:0};e.prototype.isEmpty=function(){return!this.items.length};e.prototype.isVisible=function(){return this.element.style.display==="block"};e.prototype.draw=function(){this.element.innerHTML="";if(this.items.length!==0){for(var e=0;e<this.items.length;e++)this.drawItem(this.items[e],this.active===e);this.show()}else this.hide()};e.prototype.drawItem=function(e,t){var i=document.createElement("li"),s=document.createElement("a");t&&(i.className+=" active");s.innerHTML=e.string;i.appendChild(s);this.element.appendChild(i);i.addEventListener("mousedown",function(){this.selectingListItem=true}.bind(this));i.addEventListener("mouseup",function(){this.handleMouseUp.call(this,e)}.bind(this))};e.prototype.handleMouseUp=function(e){this.selectingListItem=false;this.component.value(e.original);this.clear();this.draw()};e.prototype.move=function(e){this.active=e;this.draw()};e.prototype.previous=function(){this.move(this.active<=0?this.items.length-1:this.active-1)};e.prototype.next=function(){this.move(this.active>=this.items.length-1?0:this.active+1)};e.prototype.drawError=function(e){var t=document.createElement("li");t.innerHTML=e;this.element.appendChild(t);this.show()};h=e;return h}var p;var d;function f(){if(d)return p;d=1;var e=r();var t=l();var i=c();var s=function(t,s,n){n=n||{};this.options=e({minLength:2,limit:5,filter:true,hideOnBlur:true,noInitialSelection:true},n);this.el=t;this.data=s||[];this.list=new i(this);this.query="";this.selected=null;this.list.draw();this.el.addEventListener("keyup",function(e){this.handleKeyUp(e.keyCode,e)}.bind(this),false);this.el.addEventListener("keydown",function(e){this.handleKeyDown(e)}.bind(this));this.el.addEventListener("focus",function(){this.handleFocus()}.bind(this));this.el.addEventListener("blur",function(){this.handleBlur()}.bind(this));this.el.addEventListener("paste",function(e){this.handlePaste(e)}.bind(this));this.render=this.options.render?this.options.render.bind(this):this.render.bind(this);this.getItemValue=this.options.getItemValue?this.options.getItemValue.bind(this):this.getItemValue.bind(this);return this};s.prototype.handleKeyUp=function(e,t){if(e!==40&&e!==38&&e!==27&&e!==9)if(e!==13)this.handleInputChange(this.el.value);else if(this.list.items[this.list.active]){this.list.handleMouseUp(this.list.items[this.list.active]);t.stopPropagation()}};s.prototype.handleKeyDown=function(e){switch(e.keyCode){case 13:this.list.active>=0&&(this.list.selectingListItem=true);break;case 9:if(!this.list.isEmpty()){this.list.isVisible()&&e.preventDefault();this.value(this.list.active>=0?this.list.items[this.list.active].original:null);this.list.hide()}break;case 27:this.list.isEmpty()||this.list.hide();break;case 38:this.list.previous();break;case 40:this.list.next();break}};s.prototype.handleBlur=function(){!this.list.selectingListItem&&this.options.hideOnBlur&&this.list.hide()};s.prototype.handlePaste=function(e){if(e.clipboardData)this.handleInputChange(e.clipboardData.getData("Text"));else{var t=this;setTimeout((function(){t.handleInputChange(e.target.value)}),100)}};s.prototype.handleInputChange=function(e){this.query=this.normalize(e);this.list.clear();this.query.length<this.options.minLength?this.list.draw():this.getCandidates(function(e){for(var t=0;t<e.length;t++){this.list.add(e[t]);if(t===this.options.limit-1)break}this.list.draw()}.bind(this))};s.prototype.handleFocus=function(){this.list.isEmpty()||this.list.show();this.list.selectingListItem=false};
/**
	 * Update data previously passed
	 *
	 * @param {Array} revisedData
	 */s.prototype.update=function(e){this.data=e;this.handleKeyUp()};s.prototype.clear=function(){this.data=[];this.list.clear()};
/**
	 * Normalize the results list and input value for matching
	 *
	 * @param {String} value
	 * @return {String}
	 */s.prototype.normalize=function(e){e=e.toLowerCase();return e};
/**
	 * Evaluates whether an array item qualifies as a match with the current query
	 *
	 * @param {String} candidate a possible item from the array passed
	 * @param {String} query the current query
	 * @return {Boolean}
	 */s.prototype.match=function(e,t){return e.indexOf(t)>-1};s.prototype.value=function(e){this.selected=e;this.el.value=this.getItemValue(e||{place_name:this.query});if(document.createEvent){var t=document.createEvent("HTMLEvents");t.initEvent("change",true,false);this.el.dispatchEvent(t)}else this.el.fireEvent("onchange")};s.prototype.getCandidates=function(e){var i={pre:"<strong>",post:"</strong>",extract:function(e){return this.getItemValue(e)}.bind(this)};var s;if(this.options.filter){s=t.filter(this.query,this.data,i);s=s.map(function(e){return{original:e.original,string:this.render(e.original,e.string)}}.bind(this))}else s=this.data.map(function(e){var t=this.render(e);return{original:e,string:t}}.bind(this));e(s)};
/**
	 * For a given item in the data array, return what should be used as the candidate string
	 *
	 * @param {Object|String} item an item from the data array
	 * @return {String} item
	 */s.prototype.getItemValue=function(e){return e};
/**
	 * For a given item in the data array, return a string of html that should be rendered in the dropdown
	 * @param {Object|String} item an item from the data array
	 * @param {String} sourceFormatting a string that has pre-formatted html that should be passed directly through the render function 
	 * @return {String} html
	 */s.prototype.render=function(e,t){if(t)return t;var i=e.original?this.getItemValue(e.original):this.getItemValue(e);var s=this.normalize(i);var n=s.lastIndexOf(this.query);while(n>-1){var r=n+this.query.length;i=i.slice(0,n)+"<strong>"+i.slice(n,r)+"</strong>"+i.slice(r);n=s.slice(0,n).lastIndexOf(this.query)}return i};
/**
	 * Render an custom error message in the suggestions list
	 * @param {String} msg An html string to render as an error message
	 */s.prototype.renderError=function(e){this.list.drawError(e)};p=s;return p}var g;var m;function v(){if(m)return g;m=1;
/**
	 * A typeahead component for inputs
	 * @class Suggestions
	 *
	 * @param {HTMLInputElement} el A valid HTML input element
	 * @param {Array} data An array of data used for results
	 * @param {Object} options
	 * @param {Number} [options.limit=5] Max number of results to display in the auto suggest list.
	 * @param {Number} [options.minLength=2] Number of characters typed into an input to trigger suggestions.
	 * @param {Boolean} [options.hideOnBlur=true] If `true`, hides the suggestions when focus is lost.
	 * @return {Suggestions} `this`
	 * @example
	 * // in the browser
	 * var input = document.querySelector('input');
	 * var data = [
	 *   'Roy Eldridge',
	 *   'Roy Hargrove',
	 *   'Rex Stewart'
	 * ];
	 *
	 * new Suggestions(input, data);
	 *
	 * // with options
	 * var input = document.querySelector('input');
	 * var data = [{
	 *   name: 'Roy Eldridge',
	 *   year: 1911
	 * }, {
	 *   name: 'Roy Hargrove',
	 *   year: 1969
	 * }, {
	 *   name: 'Rex Stewart',
	 *   year: 1907
	 * }];
	 *
	 * var typeahead = new Suggestions(input, data, {
	 *   filter: false, // Disable filtering
	 *   minLength: 3, // Number of characters typed into an input to trigger suggestions.
	 *   limit: 3, //  Max number of results to display.
	 *   hideOnBlur: false // Don't hide results when input loses focus
	 * });
	 *
	 * // As we're passing an object of an arrays as data, override
	 * // `getItemValue` by specifying the specific property to search on.
	 * typeahead.getItemValue = function(item) { return item.name };
	 *
	 * input.addEventListener('change', function() {
	 *   console.log(typeahead.selected); // Current selected item.
	 * });
	 *
	 * // With browserify
	 * var Suggestions = require('suggestions');
	 *
	 * new Suggestions(input, data);
	 */var e=f();g=e;typeof window!=="undefined"&&(window.Suggestions=e);return g}var y=v();var _=i(y);var b={exports:{}};var E=b.exports;var w;function L(){if(w)return b.exports;w=1;(function(e){!function(t,i,s){e.exports?e.exports=s():t[i]=s()}(E,"subtag",(function(){var e="";var t=/^([a-zA-Z]{2,3})(?:[_-]+([a-zA-Z]{3})(?=$|[_-]+))?(?:[_-]+([a-zA-Z]{4})(?=$|[_-]+))?(?:[_-]+([a-zA-Z]{2}|[0-9]{3})(?=$|[_-]+))?/;function i(e){return e.match(t)||[]}function s(e){return i(e).filter((function(e,t){return e&&t}))}function n(t){t=i(t);return{language:t[1]||e,extlang:t[2]||e,script:t[3]||e,region:t[4]||e}}function r(e,t,i){Object.defineProperty(e,t,{value:i,enumerable:true})}function o(t,s,o){function a(s){return i(s)[t]||e}r(a,"pattern",s);r(n,o,a)}o(1,/^[a-zA-Z]{2,3}$/,"language");o(2,/^[a-zA-Z]{3}$/,"extlang");o(3,/^[a-zA-Z]{4}$/,"script");o(4,/^[a-zA-Z]{2}$|^[0-9]{3}$/,"region");r(n,"split",s);return n}))})(b);return b.exports}var x=L();var k=i(x);var M;var C;function R(){if(C)return M;C=1;var e="Expected a function";var i=NaN;var s="[object Symbol]";var n=/^\s+|\s+$/g;var r=/^[-+]0x[0-9a-f]+$/i;var o=/^0b[01]+$/i;var a=/^0o[0-7]+$/i;var l=parseInt;var h=typeof t=="object"&&t&&t.Object===Object&&t;var u=typeof self=="object"&&self&&self.Object===Object&&self;var c=h||u||Function("return this")();var p=Object.prototype;var d=p.toString;var f=Math.max,g=Math.min;
/**
	 * Gets the timestamp of the number of milliseconds that have elapsed since
	 * the Unix epoch (1 January 1970 00:00:00 UTC).
	 *
	 * @static
	 * @memberOf _
	 * @since 2.4.0
	 * @category Date
	 * @returns {number} Returns the timestamp.
	 * @example
	 *
	 * _.defer(function(stamp) {
	 *   console.log(_.now() - stamp);
	 * }, _.now());
	 * // => Logs the number of milliseconds it took for the deferred invocation.
	 */var m=function(){return c.Date.now()};
/**
	 * Creates a debounced function that delays invoking `func` until after `wait`
	 * milliseconds have elapsed since the last time the debounced function was
	 * invoked. The debounced function comes with a `cancel` method to cancel
	 * delayed `func` invocations and a `flush` method to immediately invoke them.
	 * Provide `options` to indicate whether `func` should be invoked on the
	 * leading and/or trailing edge of the `wait` timeout. The `func` is invoked
	 * with the last arguments provided to the debounced function. Subsequent
	 * calls to the debounced function return the result of the last `func`
	 * invocation.
	 *
	 * **Note:** If `leading` and `trailing` options are `true`, `func` is
	 * invoked on the trailing edge of the timeout only if the debounced function
	 * is invoked more than once during the `wait` timeout.
	 *
	 * If `wait` is `0` and `leading` is `false`, `func` invocation is deferred
	 * until to the next tick, similar to `setTimeout` with a timeout of `0`.
	 *
	 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
	 * for details over the differences between `_.debounce` and `_.throttle`.
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Function
	 * @param {Function} func The function to debounce.
	 * @param {number} [wait=0] The number of milliseconds to delay.
	 * @param {Object} [options={}] The options object.
	 * @param {boolean} [options.leading=false]
	 *  Specify invoking on the leading edge of the timeout.
	 * @param {number} [options.maxWait]
	 *  The maximum time `func` is allowed to be delayed before it's invoked.
	 * @param {boolean} [options.trailing=true]
	 *  Specify invoking on the trailing edge of the timeout.
	 * @returns {Function} Returns the new debounced function.
	 * @example
	 *
	 * // Avoid costly calculations while the window size is in flux.
	 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
	 *
	 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
	 * jQuery(element).on('click', _.debounce(sendMail, 300, {
	 *   'leading': true,
	 *   'trailing': false
	 * }));
	 *
	 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
	 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
	 * var source = new EventSource('/stream');
	 * jQuery(source).on('message', debounced);
	 *
	 * // Cancel the trailing debounced invocation.
	 * jQuery(window).on('popstate', debounced.cancel);
	 */function v(t,i,s){var n,r,o,a,l,h,u=0,c=false,p=false,d=true;if(typeof t!="function")throw new TypeError(e);i=E(i)||0;if(y(s)){c=!!s.leading;p="maxWait"in s;o=p?f(E(s.maxWait)||0,i):o;d="trailing"in s?!!s.trailing:d}function v(e){var i=n,s=r;n=r=void 0;u=e;a=t.apply(s,i);return a}function _(e){u=e;l=setTimeout(L,i);return c?v(e):a}function b(e){var t=e-h,s=e-u,n=i-t;return p?g(n,o-s):n}function w(e){var t=e-h,s=e-u;return h===void 0||t>=i||t<0||p&&s>=o}function L(){var e=m();if(w(e))return x(e);l=setTimeout(L,b(e))}function x(e){l=void 0;if(d&&n)return v(e);n=r=void 0;return a}function k(){l!==void 0&&clearTimeout(l);u=0;n=h=r=l=void 0}function M(){return l===void 0?a:x(m())}function C(){var e=m(),t=w(e);n=arguments;r=this;h=e;if(t){if(l===void 0)return _(h);if(p){l=setTimeout(L,i);return v(h)}}l===void 0&&(l=setTimeout(L,i));return a}C.cancel=k;C.flush=M;return C}
/**
	 * Checks if `value` is the
	 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
	 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
	 *
	 * @static
	 * @memberOf _
	 * @since 0.1.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
	 * @example
	 *
	 * _.isObject({});
	 * // => true
	 *
	 * _.isObject([1, 2, 3]);
	 * // => true
	 *
	 * _.isObject(_.noop);
	 * // => true
	 *
	 * _.isObject(null);
	 * // => false
	 */function y(e){var t=typeof e;return!!e&&(t=="object"||t=="function")}
/**
	 * Checks if `value` is object-like. A value is object-like if it's not `null`
	 * and has a `typeof` result of "object".
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
	 * @example
	 *
	 * _.isObjectLike({});
	 * // => true
	 *
	 * _.isObjectLike([1, 2, 3]);
	 * // => true
	 *
	 * _.isObjectLike(_.noop);
	 * // => false
	 *
	 * _.isObjectLike(null);
	 * // => false
	 */function _(e){return!!e&&typeof e=="object"}
/**
	 * Checks if `value` is classified as a `Symbol` primitive or object.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to check.
	 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
	 * @example
	 *
	 * _.isSymbol(Symbol.iterator);
	 * // => true
	 *
	 * _.isSymbol('abc');
	 * // => false
	 */function b(e){return typeof e=="symbol"||_(e)&&d.call(e)==s}
/**
	 * Converts `value` to a number.
	 *
	 * @static
	 * @memberOf _
	 * @since 4.0.0
	 * @category Lang
	 * @param {*} value The value to process.
	 * @returns {number} Returns the number.
	 * @example
	 *
	 * _.toNumber(3.2);
	 * // => 3.2
	 *
	 * _.toNumber(Number.MIN_VALUE);
	 * // => 5e-324
	 *
	 * _.toNumber(Infinity);
	 * // => Infinity
	 *
	 * _.toNumber('3.2');
	 * // => 3.2
	 */function E(e){if(typeof e=="number")return e;if(b(e))return i;if(y(e)){var t=typeof e.valueOf=="function"?e.valueOf():e;e=y(t)?t+"":t}if(typeof e!="string")return e===0?e:+e;e=e.replace(n,"");var s=o.test(e);return s||a.test(e)?l(e.slice(2),s?2:8):r.test(e)?i:+e}M=v;return M}var T=R();var O=i(T);var P=r();var A=i(P);var I={exports:{}};var B;function S(){if(B)return I.exports;B=1;var e=typeof Reflect==="object"?Reflect:null;var t=e&&typeof e.apply==="function"?e.apply:function(e,t,i){return Function.prototype.apply.call(e,t,i)};var i;i=e&&typeof e.ownKeys==="function"?e.ownKeys:Object.getOwnPropertySymbols?function(e){return Object.getOwnPropertyNames(e).concat(Object.getOwnPropertySymbols(e))}:function(e){return Object.getOwnPropertyNames(e)};function s(e){console&&console.warn&&console.warn(e)}var n=Number.isNaN||function(e){return e!==e};function r(){r.init.call(this)}I.exports=r;I.exports.once=v;r.EventEmitter=r;r.prototype._events=void 0;r.prototype._eventsCount=0;r.prototype._maxListeners=void 0;var o=10;function a(e){if(typeof e!=="function")throw new TypeError('The "listener" argument must be of type Function. Received type '+typeof e)}Object.defineProperty(r,"defaultMaxListeners",{enumerable:true,get:function(){return o},set:function(e){if(typeof e!=="number"||e<0||n(e))throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received '+e+".");o=e}});r.init=function(){if(this._events===void 0||this._events===Object.getPrototypeOf(this)._events){this._events=Object.create(null);this._eventsCount=0}this._maxListeners=this._maxListeners||void 0};r.prototype.setMaxListeners=function(e){if(typeof e!=="number"||e<0||n(e))throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received '+e+".");this._maxListeners=e;return this};function l(e){return e._maxListeners===void 0?r.defaultMaxListeners:e._maxListeners}r.prototype.getMaxListeners=function(){return l(this)};r.prototype.emit=function(e){var i=[];for(var s=1;s<arguments.length;s++)i.push(arguments[s]);var n=e==="error";var r=this._events;if(r!==void 0)n=n&&r.error===void 0;else if(!n)return false;if(n){var o;i.length>0&&(o=i[0]);if(o instanceof Error)throw o;var a=new Error("Unhandled error."+(o?" ("+o.message+")":""));a.context=o;throw a}var l=r[e];if(l===void 0)return false;if(typeof l==="function")t(l,this,i);else{var h=l.length;var u=f(l,h);for(s=0;s<h;++s)t(u[s],this,i)}return true};function h(e,t,i,n){var r;var o;var h;a(i);o=e._events;if(o===void 0){o=e._events=Object.create(null);e._eventsCount=0}else{if(o.newListener!==void 0){e.emit("newListener",t,i.listener?i.listener:i);o=e._events}h=o[t]}if(h===void 0){h=o[t]=i;++e._eventsCount}else{typeof h==="function"?h=o[t]=n?[i,h]:[h,i]:n?h.unshift(i):h.push(i);r=l(e);if(r>0&&h.length>r&&!h.warned){h.warned=true;var u=new Error("Possible EventEmitter memory leak detected. "+h.length+" "+String(t)+" listeners added. Use emitter.setMaxListeners() to increase limit");u.name="MaxListenersExceededWarning";u.emitter=e;u.type=t;u.count=h.length;s(u)}}return e}r.prototype.addListener=function(e,t){return h(this,e,t,false)};r.prototype.on=r.prototype.addListener;r.prototype.prependListener=function(e,t){return h(this,e,t,true)};function u(){if(!this.fired){this.target.removeListener(this.type,this.wrapFn);this.fired=true;return arguments.length===0?this.listener.call(this.target):this.listener.apply(this.target,arguments)}}function c(e,t,i){var s={fired:false,wrapFn:void 0,target:e,type:t,listener:i};var n=u.bind(s);n.listener=i;s.wrapFn=n;return n}r.prototype.once=function(e,t){a(t);this.on(e,c(this,e,t));return this};r.prototype.prependOnceListener=function(e,t){a(t);this.prependListener(e,c(this,e,t));return this};r.prototype.removeListener=function(e,t){var i,s,n,r,o;a(t);s=this._events;if(s===void 0)return this;i=s[e];if(i===void 0)return this;if(i===t||i.listener===t)if(--this._eventsCount===0)this._events=Object.create(null);else{delete s[e];s.removeListener&&this.emit("removeListener",e,i.listener||t)}else if(typeof i!=="function"){n=-1;for(r=i.length-1;r>=0;r--)if(i[r]===t||i[r].listener===t){o=i[r].listener;n=r;break}if(n<0)return this;n===0?i.shift():g(i,n);i.length===1&&(s[e]=i[0]);s.removeListener!==void 0&&this.emit("removeListener",e,o||t)}return this};r.prototype.off=r.prototype.removeListener;r.prototype.removeAllListeners=function(e){var t,i,s;i=this._events;if(i===void 0)return this;if(i.removeListener===void 0){if(arguments.length===0){this._events=Object.create(null);this._eventsCount=0}else i[e]!==void 0&&(--this._eventsCount===0?this._events=Object.create(null):delete i[e]);return this}if(arguments.length===0){var n=Object.keys(i);var r;for(s=0;s<n.length;++s){r=n[s];r!=="removeListener"&&this.removeAllListeners(r)}this.removeAllListeners("removeListener");this._events=Object.create(null);this._eventsCount=0;return this}t=i[e];if(typeof t==="function")this.removeListener(e,t);else if(t!==void 0)for(s=t.length-1;s>=0;s--)this.removeListener(e,t[s]);return this};function p(e,t,i){var s=e._events;if(s===void 0)return[];var n=s[t];return n===void 0?[]:typeof n==="function"?i?[n.listener||n]:[n]:i?m(n):f(n,n.length)}r.prototype.listeners=function(e){return p(this,e,true)};r.prototype.rawListeners=function(e){return p(this,e,false)};r.listenerCount=function(e,t){return typeof e.listenerCount==="function"?e.listenerCount(t):d.call(e,t)};r.prototype.listenerCount=d;function d(e){var t=this._events;if(t!==void 0){var i=t[e];if(typeof i==="function")return 1;if(i!==void 0)return i.length}return 0}r.prototype.eventNames=function(){return this._eventsCount>0?i(this._events):[]};function f(e,t){var i=new Array(t);for(var s=0;s<t;++s)i[s]=e[s];return i}function g(e,t){for(;t+1<e.length;t++)e[t]=e[t+1];e.pop()}function m(e){var t=new Array(e.length);for(var i=0;i<t.length;++i)t[i]=e[i].listener||e[i];return t}function v(e,t){return new Promise((function(i,s){function n(i){e.removeListener(t,r);s(i)}function r(){typeof e.removeListener==="function"&&e.removeListener("error",n);i([].slice.call(arguments))}_(e,t,r,{once:true});t!=="error"&&y(e,n,{once:true})}))}function y(e,t,i){typeof e.on==="function"&&_(e,"error",t,i)}function _(e,t,i,s){if(typeof e.on==="function")s.once?e.once(t,i):e.on(t,i);else{if(typeof e.addEventListener!=="function")throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type '+typeof e);e.addEventListener(t,(function n(r){s.once&&e.removeEventListener(t,n);i(r)}))}}return I.exports}var j=S();const F={fr:{name:"France",bbox:[[-4.59235,41.380007],[9.560016,51.148506]]},us:{name:"United States",bbox:[[-171.791111,18.91619],[-66.96466,71.357764]]},ru:{name:"Russia",bbox:[[19.66064,41.151416],[190.10042,81.2504]]},ca:{name:"Canada",bbox:[[-140.99778,41.675105],[-52.648099,83.23324]]}};const G={de:"Suche",it:"Ricerca",en:"Search",nl:"Zoeken",fr:"Chercher",ca:"Cerca",he:"לחפש",ja:"サーチ",lv:"Meklēt",pt:"Procurar",sr:"Претрага",zh:"搜索",cs:"Vyhledávání",hu:"Keresés",ka:"ძიება",nb:"Søke",sk:"Vyhľadávanie",th:"ค้นหา",fi:"Hae",is:"Leita",ko:"수색",pl:"Szukaj",sl:"Iskanje",fa:"جستجو",ru:"Поиск",es:"Buscar"};const z={en:"No results found",de:"Keine Ergebnisse gefunden",es:"No hay resultados",fr:"Aucun résultat trouvé"};const N={en:"There was an error reaching the server",de:"Verbindung fehlgeschlagen",es:"Error al conectarse al servidor",fr:"Une erreur est survenue lors de la connexion au serveur"};var q={placeholder:G,errorNoResults:z,errorConnectionFailed:N};const V=/(-?\d+\.?\d*)[, ]+(-?\d+\.?\d*)[ ]*$/;class MaplibreGeocoder{constructor(e,t,i=(e,t,i)=>new _(e,t,i)){this.options={zoom:16,flyTo:true,trackProximity:true,showResultsWhileTyping:false,minLength:2,reverseGeocode:false,limit:5,enableEventLogging:true,marker:true,popup:false,maplibregl:void 0,collapsed:false,clearAndBlurOnEsc:false,clearOnBlur:false,proximityMinZoom:9,getItemValue:e=>e.text!=void 0?e.text:e.place_name,render:e=>{if(!("geometry"in e)){const t=e.text;const i=t.toLowerCase().indexOf(this._typeahead.query.toLowerCase());const s=this._typeahead.query.length;const n=t.substring(0,i);const r=t.substring(i,i+s);const o=t.substring(i+s);return'<div class="maplibregl-ctrl-geocoder--suggestion"><svg class="maplibregl-ctrl-geocoder--suggestion-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M22.8702 20.1258H21.4248L20.9125 19.6318C22.7055 17.546 23.785 14.8382 23.785 11.8925C23.785 5.32419 18.4608 0 11.8925 0C5.32419 0 0 5.32419 0 11.8925C0 18.4608 5.32419 23.785 11.8925 23.785C14.8382 23.785 17.546 22.7055 19.6318 20.9125L20.1258 21.4248V22.8702L29.2739 32L32 29.2739L22.8702 20.1258ZM11.8925 20.1258C7.33676 20.1258 3.65923 16.4483 3.65923 11.8925C3.65923 7.33676 7.33676 3.65923 11.8925 3.65923C16.4483 3.65923 20.1258 7.33676 20.1258 11.8925C20.1258 16.4483 16.4483 20.1258 11.8925 20.1258Z" fill="#687078"/></svg><div class="maplibregl-ctrl-geocoder--suggestion-info"><div class="maplibregl-ctrl-geocoder--suggestion-title">'+n+'<span class="maplibregl-ctrl-geocoder--suggestion-match">'+r+"</span>"+o+"</div></div></div>"}const t=e.place_name.split(",");return'<div class="maplibregl-ctrl-geocoder--result"><svg class="maplibregl-ctrl-geocoder--result-icon" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.36571 0 0 5.38676 0 12.0471C0 21.0824 12 32 12 32C12 32 24 21.0824 24 12.0471C24 5.38676 18.6343 0 12 0ZM12 16.3496C9.63428 16.3496 7.71429 14.4221 7.71429 12.0471C7.71429 9.67207 9.63428 7.74454 12 7.74454C14.3657 7.74454 16.2857 9.67207 16.2857 12.0471C16.2857 14.4221 14.3657 16.3496 12 16.3496Z" fill="#687078"/></svg><div><div class="maplibregl-ctrl-geocoder--result-title">'+t[0]+'</div><div class="maplibregl-ctrl-geocoder--result-address">'+t.splice(1,t.length).join(",")+"</div></div></div>"},popupRender:e=>{const t=e.place_name.split(",");return'<div class="maplibregl-ctrl-geocoder--suggestion popup-suggestion"><div class="maplibregl-ctrl-geocoder--suggestion-title popup-suggestion-title">'+t[0]+'</div><div class="maplibregl-ctrl-geocoder--suggestion-address popup-suggestion-address">'+t.splice(1,t.length).join(",")+"</div></div>"},showResultMarkers:true,debounceSearch:200};this._eventEmitter=new j.EventEmitter;this.options=A({},this.options,t);this.fresh=true;this.lastSelected=null;this.geocoderApi=e;this.typeaheadFactory=i}
/**
     * Add the geocoder to a container. The container can be either a `Map`, an `HTMLElement` or a CSS selector string.
     *
     * If the container is a [`Map`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map), this function will behave identically to [`Map.addControl(geocoder)`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map#addcontrol).
     * If the container is an instance of [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement), then the geocoder will be appended as a child of that [`HTMLElement`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement).
     * If the container is a [CSS selector string](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors), the geocoder will be appended to the element returned from the query.
     *
     * This function will throw an error if the container is none of the above.
     * It will also throw an error if the referenced HTML element cannot be found in the `document.body`.
     *
     * For example, if the HTML body contains the element `<div id='geocoder-container'></div>`, the following script will append the geocoder to `#geocoder-container`:
     * @example
     * ```js
     * const GeoApi = {
     *   forwardGeocode: (config) => { return { features: [] } },
     *   reverseGeocode: (config) => { return { features: [] } }
     * }
     * const geocoder = new MaplibreGeocoder(GeoAPI, {});
     * geocoder.addTo('#geocoder-container');
     * ```
     * @param container - A reference to the container to which to add the geocoder
     */addTo(e){function t(e,t){if(!document.body.contains(t))throw new Error("Element provided to #addTo() exists, but is not in the DOM");const i=e.onAdd();t.appendChild(i)}if(e instanceof HTMLElement)t(this,e);else if(typeof e=="string"){const i=document.querySelectorAll(e);if(i.length===0)throw new Error("Element "+e+"not found.");if(i.length>1)throw new Error("Geocoder can only be added to a single html element");t(this,i[0])}else{if(!("addControl"in e))throw new Error("Error: addTo must be a maplibre-gl-js map, an html element, or a CSS selector query for a single html element");e.addControl(this)}}onAdd(e){e&&typeof e!="string"&&(this._map=e);this.setLanguage();if(this.options.localGeocoderOnly&&!this.options.localGeocoder)throw new Error("A localGeocoder function must be specified to use localGeocoderOnly mode");this._onChange=this._onChange.bind(this);this._onKeyDown=this._onKeyDown.bind(this);this._onPaste=this._onPaste.bind(this);this._onBlur=this._onBlur.bind(this);this._showButton=this._showButton.bind(this);this._hideButton=this._hideButton.bind(this);this._onQueryResult=this._onQueryResult.bind(this);this.clear=this.clear.bind(this);this._updateProximity=this._updateProximity.bind(this);this._collapse=this._collapse.bind(this);this._unCollapse=this._unCollapse.bind(this);this._clear=this._clear.bind(this);this._clearOnBlur=this._clearOnBlur.bind(this);const t=this.container=document.createElement("div");t.className="maplibregl-ctrl-geocoder maplibregl-ctrl maplibregl-ctrl-geocoder maplibregl-ctrl";const i=this.createIcon("search",'<path d="M7.4 2.5c-2.7 0-4.9 2.2-4.9 4.9s2.2 4.9 4.9 4.9c1 0 1.8-.2 2.5-.8l3.7 3.7c.2.2.4.3.8.3.7 0 1.1-.4 1.1-1.1 0-.3-.1-.5-.3-.8L11.4 10c.4-.8.8-1.6.8-2.5.1-2.8-2.1-5-4.8-5zm0 1.6c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2-3.3-1.3-3.3-3.1 1.4-3.3 3.3-3.3z"/>');this._inputEl=document.createElement("input");this._inputEl.type="search";this._inputEl.className="maplibregl-ctrl-geocoder--input";this.setPlaceholder();if(this.options.collapsed){this._collapse();this.container.addEventListener("mouseenter",this._unCollapse);this.container.addEventListener("mouseleave",this._collapse);this._inputEl.addEventListener("focus",this._unCollapse)}(this.options.collapsed||this.options.clearOnBlur)&&this._inputEl.addEventListener("blur",this._onBlur);this._inputEl.addEventListener("keydown",O(this._onKeyDown,this.options.debounceSearch));this._inputEl.addEventListener("paste",this._onPaste);this._inputEl.addEventListener("change",this._onChange);this.container.addEventListener("mouseenter",this._showButton);this.container.addEventListener("mouseleave",this._hideButton);const s=document.createElement("div");s.classList.add("maplibregl-ctrl-geocoder--pin-right");this._clearEl=document.createElement("button");this._clearEl.setAttribute("type","button");this._clearEl.setAttribute("aria-label","Clear");this._clearEl.addEventListener("click",this.clear);this._clearEl.className="maplibregl-ctrl-geocoder--button";const n=this.createIcon("close",'<path d="M3.8 2.5c-.6 0-1.3.7-1.3 1.3 0 .3.2.7.5.8L7.2 9 3 13.2c-.3.3-.5.7-.5 1 0 .6.7 1.3 1.3 1.3.3 0 .7-.2 1-.5L9 10.8l4.2 4.2c.2.3.7.3 1 .3.6 0 1.3-.7 1.3-1.3 0-.3-.2-.7-.3-1l-4.4-4L15 4.6c.3-.2.5-.5.5-.8 0-.7-.7-1.3-1.3-1.3-.3 0-.7.2-1 .3L9 7.1 4.8 2.8c-.3-.1-.7-.3-1-.3z"/>');this._clearEl.appendChild(n);this._loadingEl=this.createIcon("loading",'<path fill="#333" d="M4.4 4.4l.8.8c2.1-2.1 5.5-2.1 7.6 0l.8-.8c-2.5-2.5-6.7-2.5-9.2 0z"/><path opacity=".1" d="M12.8 12.9c-2.1 2.1-5.5 2.1-7.6 0-2.1-2.1-2.1-5.5 0-7.7l-.8-.8c-2.5 2.5-2.5 6.7 0 9.2s6.6 2.5 9.2 0 2.5-6.6 0-9.2l-.8.8c2.2 2.1 2.2 5.6 0 7.7z"/>');s.appendChild(this._clearEl);s.appendChild(this._loadingEl);t.appendChild(i);t.appendChild(this._inputEl);t.appendChild(s);this._typeahead=this.typeaheadFactory(this._inputEl,[],{filter:false,minLength:this.options.minLength,limit:this.options.limit,noInitialSelection:true});this.container.addEventListener("click",(()=>{this._typeahead.update(this._typeahead.data)}));this.setRenderFunction(this.options.render);this._typeahead.getItemValue=this.options.getItemValue;this.mapMarker=null;this.resultMarkers=[];this._handleMarker=this._handleMarker.bind(this);this._handleResultMarkers=this._handleResultMarkers.bind(this);if(this._map){if(this.options.trackProximity){this._updateProximity();this._map.on("moveend",this._updateProximity)}this._maplibregl=this.options.maplibregl;if(!this._maplibregl&&this.options.marker){console.error("No maplibregl detected in options. Map markers are disabled. Please set options.maplibregl.");this.options.marker=false}}return t}createIcon(e,t){const i=document.createElementNS("http://www.w3.org/2000/svg","svg");i.setAttribute("class","maplibregl-ctrl-geocoder--icon maplibregl-ctrl-geocoder--icon-"+e);i.setAttribute("viewBox","0 0 18 18");i.setAttribute("xml:space","preserve");i.setAttribute("width","18");i.setAttribute("height","18");if("innerHTML"in i)i.innerHTML=t;else{const e=document.createElement("div");e.innerHTML="<svg>"+t.valueOf().toString()+"</svg>";const s=e.firstChild,n=s.firstChild;i.appendChild(n)}return i}onRemove(){this.container.remove();this.options.trackProximity&&this._map&&this._map.off("moveend",this._updateProximity);this._removeMarker();this._map=null;return this}_onPaste(e){const t=(e.clipboardData||window.clipboardData).getData("text");t.length>=this.options.minLength&&this.options.showResultsWhileTyping&&this._geocode(t)}_onKeyDown(e){if(e.key==="Escape"&&this.options.clearAndBlurOnEsc){this._clear(e);this._inputEl.blur();return}const t=this._inputEl.value;if(t){if(!e.metaKey&&e.key!=="Tab"&&e.key!=="Escape"&&e.key!=="ArrowLeft"&&e.key!=="ArrowRight"&&e.key!=="ArrowUp"&&e.key!=="ArrowDown"){if(e.key==="Enter"){if(this.options.showResultsWhileTyping){this._typeahead.selected==null&&this.geocoderApi.getSuggestions?this._geocode(t,true):this._typeahead.selected==null&&this.options.showResultMarkers&&this._fitBoundsForMarkers();return}this._typeahead.selected||this._geocode(t)}t.length>=this.options.minLength&&this.options.showResultsWhileTyping&&this._geocode(t)}}else{this.fresh=true;e.key!=="Tab"&&this.clear(e);this._clearEl.style.display="none"}}_showButton(){this._inputEl.value.length>0&&(this._clearEl.style.display="block")}_hideButton(){this._typeahead.selected&&(this._clearEl.style.display="none")}_onBlur(e){this.options.clearOnBlur&&this._clearOnBlur(e);this.options.collapsed&&this._collapse()}_onChange(){var e;const t=this._typeahead.selected;if(t)if("geometry"in t){if(JSON.stringify(t)!==this.lastSelected){this._clearEl.style.display="none";if(this.options.flyTo){let i;this._removeResultMarkers();if(t.properties&&F[t.properties.short_code]){i=A({},this.options.flyTo);this._map&&this._map.fitBounds(F[t.properties.short_code].bbox,i)}else if(t.bbox){const e=t.bbox;i=A({},this.options.flyTo);this._map&&this._map.fitBounds([[e[0],e[1]],[e[2],e[3]]],i)}else{const s={zoom:this.options.zoom};i=A({},s,this.options.flyTo);t.center?i.center=t.center:((e=t.geometry)===null||e===void 0?void 0:e.type)==="Point"&&t.geometry.coordinates&&(i.center=t.geometry.coordinates);this._map&&this._map.flyTo(i)}}this.options.marker&&this._maplibregl&&this._handleMarker(t);this._inputEl.focus();this._inputEl.scrollLeft=0;this._inputEl.setSelectionRange(0,0);this.lastSelected=JSON.stringify(t);this._typeahead.selected=null;this._eventEmitter.emit("result",{result:t})}}else t.placeId?this._geocode(t.placeId,true,true):this._geocode(t.text,true)}_getConfigForRequest(){const e=["bbox","limit","proximity","countries","types","language","reverseMode"];const t=e.reduce(((e,t)=>{if(this.options[t]){["countries","types","language"].indexOf(t)>-1?e[t]=this.options[t].split(/[\s,]+/):e[t]=this.options[t];t==="proximity"&&this.options[t]&&typeof this.options[t].longitude==="number"&&typeof this.options[t].latitude==="number"&&(e[t]=[this.options[t].longitude,this.options[t].latitude])}return e}),{});return t}_geocode(t){return e(this,arguments,void 0,(function*(e,t=false,i=false){this._loadingEl.style.display="block";this._eventEmitter.emit("loading",{query:e});const s=this._getConfigForRequest();const n=this._createGeocodeRequest(s,e,t,i);const r=this.options.localGeocoder&&this.options.localGeocoder(e)||[];try{const i=yield n;yield this._handleGeocodeResponse(i,s,e,t,r)}catch(e){this._handleGeocodeErrorResponse(e,r)}return n}))}_createGeocodeRequest(e,t,i,s){if(this.options.localGeocoderOnly)return Promise.resolve({});if(this.options.reverseGeocode&&V.test(t))return this._createReverseGeocodeRequest(t,e);e.query=t;return this.geocoderApi.getSuggestions?i?this.geocoderApi.searchByPlaceId&&s?this.geocoderApi.searchByPlaceId(e):this.geocoderApi.forwardGeocode(e):this.geocoderApi.getSuggestions(e):this.geocoderApi.forwardGeocode(e)}_createReverseGeocodeRequest(e,t){const i=e.split(/[\s(,)?]+/).map((e=>parseFloat(e))).reverse();t.query=i;t.limit=1;"proximity"in t&&delete t.proximity;return this.geocoderApi.reverseGeocode(t)}_handleGeocodeResponse(t,i,s,n,r){return e(this,void 0,void 0,(function*(){this._loadingEl.style.display="none";let e={};e=t||{type:"FeatureCollection",features:[]};e.config=i;this.fresh&&(this.fresh=false);e.features=e.features?r.concat(e.features):r;const o=this.options.externalGeocoder&&this.options.externalGeocoder(s,e.features,i)||Promise.resolve([]);try{const t=yield o;e.features=e.features?t.concat(e.features):t}catch(e){}this.options.filter&&e.features.length&&(e.features=e.features.filter(this.options.filter));let a=[];a="suggestions"in e?e.suggestions:"place"in e?Array.isArray(e.place)?e.place:[e.place]:e.features;if(a.length){this._clearEl.style.display="block";this._typeahead.update(a);(!this.options.showResultsWhileTyping||n)&&this.options.showResultMarkers&&(e.features.length>0||"place"in e)&&this._fitBoundsForMarkers();this._eventEmitter.emit("results",e)}else{this._clearEl.style.display="none";this._typeahead.selected=null;this._renderNoResults();this._eventEmitter.emit("results",e)}}))}_handleGeocodeErrorResponse(e,t){this._loadingEl.style.display="none";if(t.length&&this.options.localGeocoder){this._clearEl.style.display="block";this._typeahead.update(t)}else{this._clearEl.style.display="none";this._typeahead.selected=null;this._renderError()}this._eventEmitter.emit("results",{features:t});this._eventEmitter.emit("error",{error:e})}
/**
     * Shared logic for clearing input
     * @param ev - the event that triggered the clear, if available
     */_clear(e){e&&e.preventDefault();this._inputEl.value="";this._typeahead.selected=null;this._typeahead.clear();this._onChange();this._clearEl.style.display="none";this._removeMarker();this._removeResultMarkers();this.lastSelected=null;this._eventEmitter.emit("clear");this.fresh=true}
/**
     * Clear and then focus the input.
     * @param ev - the event that triggered the clear, if available
     *
     */clear(e){this._clear(e);this._inputEl.focus()}
/**
     * Clear the input, without refocusing it. Used to implement clearOnBlur
     * constructor option.
     * @param ev - the blur event
     */_clearOnBlur(e){e.relatedTarget&&this._clear(e)}_onQueryResult(e){if(!("features"in e))return;if(!e.features.length)return;const t=e.features[0];this._typeahead.selected=t;this._inputEl.value=t.place_name;this._onChange()}_updateProximity(){if(this._map)if(this._map.getZoom()>this.options.proximityMinZoom){const e=this._map.getCenter().wrap();this.setProximity({longitude:e.lng,latitude:e.lat})}else this.setProximity(null)}_collapse(){this._inputEl.value||this._inputEl===document.activeElement||this.container.classList.add("maplibregl-ctrl-geocoder--collapsed")}_unCollapse(){this.container.classList.remove("maplibregl-ctrl-geocoder--collapsed")}
/**
     * Set & query the input
     * @param searchInput - location name or other search input
     */query(t){return e(this,void 0,void 0,(function*(){const e=yield this._geocode(t);this._onQueryResult(e)}))}_renderError(){const e=`<div class='maplibre-gl-geocoder--error'>${this._localize("errorConnectionFailed")}</div>`;this._renderMessage(e)}_renderNoResults(){const e=`<div class='maplibre-gl-geocoder--error maplibre-gl-geocoder--no-results'>\n        ${this._localize("errorNoResults")}</div>`;this._renderMessage(e)}_renderMessage(e){this._typeahead.update([]);this._typeahead.selected=null;this._typeahead.clear();this._typeahead.renderError(e)}
/**
     * Get a localised string for a given key
     *
     * If language is provided in options, attempt to return localized string (defaults to English)
     * @param key - key in the localization object
     * @returns localized string
     */_localize(e){const t=k.language(this.options.language.split(",")[0]);return this.options.language&&(q===null||q===void 0?void 0:q[e][t])?q[e][t]:q[e].en}_fitBoundsForMarkers(){var e;if(this._typeahead.data.length<1)return;const t=this._typeahead.data.filter((e=>typeof e!=="string")).slice(0,this.options.limit);this._clearEl.style.display="none";if(this.options.flyTo&&this._maplibregl&&this._map){const i={padding:100};const s=A({},i,this.options.flyTo);const n=new this._maplibregl.LngLatBounds;for(const i of t)"geometry"in i&&((e=i.geometry)===null||e===void 0?void 0:e.type)==="Point"&&n.extend(i.geometry.coordinates);this._map.fitBounds(n,s)}t.length>0&&this._maplibregl&&this._handleResultMarkers(t);return this}
/**
     * Set input
     * @param searchInput - location name or other search input
     */setInput(e){this._inputEl.value=e;this._typeahead.selected=null;this._typeahead.clear();e.length>=this.options.minLength&&this.options.showResultsWhileTyping&&this._geocode(e);return this}
/**
     * Set proximity
     * @param proximity - The new `options.proximity` value. This is a geographical point given as an object with `latitude` and `longitude` properties.
     */setProximity(e){this.options.proximity=e;return this}
/**
     * Get proximity
     * @returns The geocoder proximity
     */getProximity(){return this.options.proximity}
/**
     * Set the render function used in the results dropdown
     * @param fn - The function to use as a render function. This function accepts a single {@link CarmenGeojsonFeature} object as input and returns a string.
     */setRenderFunction(e){e&&typeof e=="function"&&(this._typeahead.render=e);return this}
/**
     * Get the function used to render the results dropdown
     *
     * @returns the render function
     */getRenderFunction(){return this._typeahead.render}
/**
     * Get the language to use in UI elements and when making search requests
     *
     * Look first at the explicitly set options otherwise use the browser's language settings
     * @param language - Specify the language to use for response text and query result weighting. Options are IETF language tags comprised of a mandatory ISO 639-1 language code and optionally one or more IETF subtags for country or script. More than one value can also be specified, separated by commas.
     */setLanguage(e){this.options.language=e||this.options.language||navigator.language;return this}
/**
     * Get the language to use in UI elements and when making search requests
     * @returns The language(s) used by the plugin, if any
     */getLanguage(){return this.options.language}
/**
     * Get the zoom level the map will move to when there is no bounding box on the selected result
     * @returns the map zoom
     */getZoom(){return this.options.zoom}
/**
     * Set the zoom level
     * @param zoom - The zoom level that the map should animate to when a `bbox` isn't found in the response. If a `bbox` is found the map will fit to the `bbox`.
     * @returns this
     */setZoom(e){this.options.zoom=e;return this}
/**
     * Get the parameters used to fly to the selected response, if any
     * @returns The `flyTo` option
     */getFlyTo(){return this.options.flyTo}
/**
     * Set the flyTo options
     * @param flyTo - If false, animating the map to a selected result is disabled. If true, animating the map will use the default animation parameters. If an object, it will be passed as `options` to the map [`flyTo`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map#flyto) or [`fitBounds`](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map#fitbounds) method providing control over the animation of the transition.
     */setFlyTo(e){this.options.flyTo=e;return this}
/**
     * Get the value of the placeholder string
     * @returns The input element's placeholder value
     */getPlaceholder(){return this.options.placeholder}
/**
     * Set the value of the input element's placeholder
     * @param placeholder - the text to use as the input element's placeholder
     */setPlaceholder(e){this.options.placeholder=e||(this.options.placeholder||this._localize("placeholder"));this._inputEl.placeholder=this.options.placeholder;this._inputEl.setAttribute("aria-label",this.options.placeholder);return this}
/**
     * Get the bounding box used by the plugin
     * @returns the bounding box, if any
     */getBbox(){return this.options.bbox}
/**
     * Set the bounding box to limit search results to
     * @param bbox - a bounding box given as an array in the format [minX, minY, maxX, maxY].
     */setBbox(e){this.options.bbox=e;return this}
/**
     * Get a list of the countries to limit search results to
     * @returns a comma separated list of countries to limit to, if any
     */getCountries(){return this.options.countries}
/**
     * Set the countries to limit search results to
     * @param countries - a comma separated list of countries to limit to
     */setCountries(e){this.options.countries=e;return this}
/**
     * Get a list of the types to limit search results to
     * @returns a comma separated list of types to limit to
     */getTypes(){return this.options.types}
/**
     * Set the types to limit search results to
     * @param types - a comma separated list of types to limit to
     */setTypes(e){this.options.types=e;return this}
/**
     * Get the minimum number of characters typed to trigger results used in the plugin
     * @returns The minimum length in characters before a search is triggered
     */getMinLength(){return this.options.minLength}
/**
     * Set the minimum number of characters typed to trigger results used by the plugin
     * @param minLength - the minimum length in characters
     */setMinLength(e){this.options.minLength=e;this._typeahead&&(this._typeahead.options.minLength=e);return this}
/**
     * Get the limit value for the number of results to display used by the plugin
     * @returns The limit value for the number of results to display used by the plugin
     */getLimit(){return this.options.limit}
/**
     * Set the limit value for the number of results to display used by the plugin
     * @param limit - the number of search results to return
     */setLimit(e){this.options.limit=e;this._typeahead&&(this._typeahead.options.limit=e);return this}
/**
     * Get the filter function used by the plugin
     * @returns the filter function
     */getFilter(){return this.options.filter}
/**
     * Set the filter function used by the plugin.
     * @param filter - A function which accepts a {@link CarmenGeojsonFeature} to filter out results from the Geocoding API response before they are included in the suggestions list. Return `true` to keep the item, `false` otherwise.
     */setFilter(e){this.options.filter=e;return this}setGeocoderApi(e){this.geocoderApi=e;return this}
/**
     * Get the geocoding endpoint the plugin is currently set to
     * @returns the geocoding API
     */getGeocoderApi(){return this.geocoderApi}
/**
     * Handle the placement of a result marking the selected result
     * @param selected - the selected geojson feature
     */_handleMarker(e){var t;if(!this._map)return;this._removeMarker();const i={color:"#4668F2"};const s=A({},i,this.options.marker);this.mapMarker=new this._maplibregl.Marker(s);let n=null;if(this.options.popup){const t={};const i=A({},t,this.options.popup);n=new this._maplibregl.Popup(i).setHTML(this.options.popupRender(e))}if(e.center){this.mapMarker.setLngLat(e.center).addTo(this._map);this.options.popup&&this.mapMarker.setPopup(n)}else if(((t=e.geometry)===null||t===void 0?void 0:t.type)==="Point"&&e.geometry.coordinates){this.mapMarker.setLngLat(e.geometry.coordinates).addTo(this._map);this.options.popup&&this.mapMarker.setPopup(n)}return this}_removeMarker(){if(this.mapMarker){this.mapMarker.remove();this.mapMarker=null}}
/**
     * Handle the placement of a result marking the selected result
     * @param results - the top results to display on the map
     */_handleResultMarkers(e){if(!this._map)return;this._removeResultMarkers();const t={color:"#4668F2"};let i=A({},t,this.options.showResultMarkers);for(const t of e){let e;if(this.options.showResultMarkers){if(this.options.showResultMarkers&&this.options.showResultMarkers.element){e=this.options.showResultMarkers.element.cloneNode(true);i=A(i,{element:e})}const s=new this._maplibregl.Marker(A({},i,{element:e}));let n;if(this.options.popup){const e={};const i=A({},e,this.options.popup);n=new this._maplibregl.Popup(i).setHTML(this.options.popupRender(t))}if(t.center){s.setLngLat(t.center).addTo(this._map);this.options.popup&&s.setPopup(n)}else if(t.geometry&&t.geometry.type&&t.geometry.type==="Point"&&t.geometry.coordinates){s.setLngLat(t.geometry.coordinates).addTo(this._map);this.options.popup&&s.setPopup(n)}this.resultMarkers.push(s)}}return this}_removeResultMarkers(){if(this.resultMarkers&&this.resultMarkers.length>0){this.resultMarkers.forEach((function(e){e.remove()}));this.resultMarkers=[]}}
/**
     * Subscribe to events that happen within the plugin.
     * @param type - name of event. Check out the {@link MaplibreGeocoderEventTypeMap} for a list of available events.
     * @param fn - function that's called when the event is emitted.
     */on(e,t){this._eventEmitter.on(e,t);return this}
/**
     * Subscribe to events that happen within the plugin only once.
     * @param type - Event name. Check out the {@link MaplibreGeocoderEventTypeMap} for a list of available events.
     * @returns a Promise that resolves when the event is emitted.
     */once(e){return new Promise((t=>{this._eventEmitter.once(e,t)}))}
/**
     * Remove an event
     * @param type - Event name.
     * @param fn - Function that should unsubscribe to the event emitted.
     */off(e,t){this._eventEmitter.removeListener(e,t);return this}}export{MaplibreGeocoder as default};

