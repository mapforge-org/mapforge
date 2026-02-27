// @mapbox/mapbox-gl-draw@1.5.1 downloaded + unminified (https://unminify.com/)
// from https://ga.jspm.io/npm:@mapbox/mapbox-gl-draw@1.5.1/index.js
// * Patched to not allow right click on vertexes (isLeftClick function)

import e from "@mapbox/geojson-area";
import { customAlphabet as t } from "nanoid/non-secure";
import o from "@mapbox/point-geometry";
import { toMercator as n, toWgs84 as r } from "@turf/projection";
import i from "fast-deep-equal";
import s from "@mapbox/geojson-normalize";
const a = {
    CANVAS: "mapboxgl-canvas",
    CONTROL_BASE: "mapboxgl-ctrl",
    CONTROL_PREFIX: "mapboxgl-ctrl-",
    CONTROL_BUTTON: "mapbox-gl-draw_ctrl-draw-btn",
    CONTROL_BUTTON_LINE: "mapbox-gl-draw_line",
    CONTROL_BUTTON_POLYGON: "mapbox-gl-draw_polygon",
    CONTROL_BUTTON_POINT: "mapbox-gl-draw_point",
    CONTROL_BUTTON_TRASH: "mapbox-gl-draw_trash",
    CONTROL_BUTTON_COMBINE_FEATURES: "mapbox-gl-draw_combine",
    CONTROL_BUTTON_UNCOMBINE_FEATURES: "mapbox-gl-draw_uncombine",
    CONTROL_GROUP: "mapboxgl-ctrl-group",
    ATTRIBUTION: "mapboxgl-ctrl-attrib",
    ACTIVE_BUTTON: "active",
    BOX_SELECT: "mapbox-gl-draw_boxselect",
};
const c = { HOT: "mapbox-gl-draw-hot", COLD: "mapbox-gl-draw-cold" };
const u = { ADD: "add", MOVE: "move", DRAG: "drag", POINTER: "pointer", NONE: "none" };
const l = { POLYGON: "polygon", LINE: "line_string", POINT: "point" };
const d = {
    FEATURE: "Feature",
    POLYGON: "Polygon",
    LINE_STRING: "LineString",
    POINT: "Point",
    FEATURE_COLLECTION: "FeatureCollection",
    MULTI_PREFIX: "Multi",
    MULTI_POINT: "MultiPoint",
    MULTI_LINE_STRING: "MultiLineString",
    MULTI_POLYGON: "MultiPolygon",
};
const p = {
    DRAW_LINE_STRING: "draw_line_string",
    DRAW_POLYGON: "draw_polygon",
    DRAW_POINT: "draw_point",
    SIMPLE_SELECT: "simple_select",
    DIRECT_SELECT: "direct_select",
};
const h = {
    CREATE: "draw.create",
    DELETE: "draw.delete",
    UPDATE: "draw.update",
    SELECTION_CHANGE: "draw.selectionchange",
    MODE_CHANGE: "draw.modechange",
    ACTIONABLE: "draw.actionable",
    RENDER: "draw.render",
    COMBINE_FEATURES: "draw.combine",
    UNCOMBINE_FEATURES: "draw.uncombine",
};
const f = { MOVE: "move", CHANGE_PROPERTIES: "change_properties", CHANGE_COORDINATES: "change_coordinates" };
const g = { FEATURE: "feature", MIDPOINT: "midpoint", VERTEX: "vertex" };
const m = { ACTIVE: "true", INACTIVE: "false" };
const y = ["scrollZoom", "boxZoom", "dragRotate", "dragPan", "keyboard", "doubleClickZoom", "touchZoomRotate"];
const E = -90;
const T = -85;
const C = 90;
const I = 85;
const S = -270;
const _ = 270;
var v = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            LAT_MAX: C,
            LAT_MIN: E,
            LAT_RENDERED_MAX: I,
            LAT_RENDERED_MIN: T,
            LNG_MAX: _,
            LNG_MIN: S,
            activeStates: m,
            classes: a,
            cursors: u,
            events: h,
            geojsonTypes: d,
            interactions: y,
            meta: g,
            modes: p,
            sources: c,
            types: l,
            updateActions: f,
        },
        Symbol.toStringTag,
        { value: "Module" }
    )
);
function O(e) {
    return function (t) {
        const o = t.featureTarget;
        return !!o && !!o.properties && o.properties.meta === e;
    };
}
function N(e) {
    return !!e.originalEvent && !!e.originalEvent.shiftKey && e.originalEvent.button === 0;
}
function L(e) {
    return (
        !!e.featureTarget &&
        !!e.featureTarget.properties &&
        e.featureTarget.properties.active === m.ACTIVE &&
        e.featureTarget.properties.meta === g.FEATURE
    );
}
function M(e) {
    return (
        !!e.featureTarget &&
        !!e.featureTarget.properties &&
        e.featureTarget.properties.active === m.INACTIVE &&
        e.featureTarget.properties.meta === g.FEATURE
    );
}
function b(e) {
    return e.featureTarget === void 0;
}
function A(e) {
    return !!e.featureTarget && !!e.featureTarget.properties && e.featureTarget.properties.meta === g.FEATURE;
}
function P(e) {
    const t = e.featureTarget;
    return !!t && !!t.properties && t.properties.meta === g.VERTEX;
}
function F(e) {
    return !!e.originalEvent && e.originalEvent.shiftKey === true;
}
function x(e) {
    return e.key === "Escape" || e.keyCode === 27;
}
function R(e) {
    return e.key === "Enter" || e.keyCode === 13;
}
function D(e) {
    return e.key === "Backspace" || e.keyCode === 8;
}
function w(e) {
    return e.key === "Delete" || e.keyCode === 46;
}
function U(e) {
    return e.key === "1" || e.keyCode === 49;
}
function k(e) {
    return e.key === "2" || e.keyCode === 50;
}
function V(e) {
    return e.key === "3" || e.keyCode === 51;
}
function G(e) {
    const t = e.key || String.fromCharCode(e.keyCode);
    const o = t >= "0" && t <= "9";
    return o;
}
function B() {
    return true;
}
var J = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            isActiveFeature: L,
            isBackspaceKey: D,
            isDeleteKey: w,
            isDigit1Key: U,
            isDigit2Key: k,
            isDigit3Key: V,
            isDigitKey: G,
            isEnterKey: R,
            isEscapeKey: x,
            isFeature: A,
            isInactiveFeature: M,
            isOfMetaType: O,
            isShiftDown: F,
            isShiftMousedown: N,
            isTrue: B,
            isVertex: P,
            noTarget: b,
        },
        Symbol.toStringTag,
        { value: "Module" }
    )
);
const $ = { Point: 0, LineString: 1, MultiLineString: 1, Polygon: 2 };
function j(e, t) {
    const o = $[e.geometry.type] - $[t.geometry.type];
    return o === 0 && e.geometry.type === d.POLYGON ? e.area - t.area : o;
}
function Y(t) {
    return t
        .map((t) => {
            t.geometry.type === d.POLYGON &&
                (t.area = e.geometry({ type: d.FEATURE, property: {}, geometry: t.geometry }));
            return t;
        })
        .sort(j)
        .map((e) => {
            delete e.area;
            return e;
        });
}
/**
 * Returns a bounding box representing the event's location.
 *
 * @param {Event} mapEvent - Mapbox GL JS map event, with a point properties.
 * @return {Array<Array<number>>} Bounding box.
 */ function H(e, t = 0) {
    return [
        [e.point.x - t, e.point.y - t],
        [e.point.x + t, e.point.y + t],
    ];
}
function X(e) {
    this._items = {};
    this._nums = {};
    this._length = e ? e.length : 0;
    if (e)
        for (let t = 0, o = e.length; t < o; t++) {
            this.add(e[t]);
            e[t] !== void 0 && (typeof e[t] === "string" ? (this._items[e[t]] = t) : (this._nums[e[t]] = t));
        }
}
X.prototype.add = function (e) {
    if (this.has(e)) return this;
    this._length++;
    typeof e === "string" ? (this._items[e] = this._length) : (this._nums[e] = this._length);
    return this;
};
X.prototype.delete = function (e) {
    if (this.has(e) === false) return this;
    this._length--;
    delete this._items[e];
    delete this._nums[e];
    return this;
};
X.prototype.has = function (e) {
    return (typeof e === "string" || typeof e === "number") && (this._items[e] !== void 0 || this._nums[e] !== void 0);
};
X.prototype.values = function () {
    const e = [];
    Object.keys(this._items).forEach((t) => {
        e.push({ k: t, v: this._items[t] });
    });
    Object.keys(this._nums).forEach((t) => {
        e.push({ k: JSON.parse(t), v: this._nums[t] });
    });
    return e.sort((e, t) => e.v - t.v).map((e) => e.k);
};
X.prototype.clear = function () {
    this._length = 0;
    this._items = {};
    this._nums = {};
    return this;
};
const K = [g.FEATURE, g.MIDPOINT, g.VERTEX];
var Z = { click: q, touch: W };
function q(e, t, o) {
    return z(e, t, o, o.options.clickBuffer);
}
function W(e, t, o) {
    return z(e, t, o, o.options.touchBuffer);
}
function z(e, t, o, n) {
    if (o.map === null) return [];
    const r = e ? H(e, n) : t;
    const i = {};
    o.options.styles && (i.layers = o.options.styles.map((e) => e.id).filter((e) => o.map.getLayer(e) != null));
    const s = o.map.queryRenderedFeatures(r, i).filter((e) => K.indexOf(e.properties.meta) !== -1);
    const a = new X();
    const c = [];
    s.forEach((e) => {
        const t = e.properties.id;
        if (!a.has(t)) {
            a.add(t);
            c.push(e);
        }
    });
    return Y(c);
}
function Q(e, t) {
    const o = Z.click(e, null, t);
    const n = { mouse: u.NONE };
    if (o[0]) {
        n.mouse = o[0].properties.active === m.ACTIVE ? u.MOVE : u.POINTER;
        n.feature = o[0].properties.meta;
    }
    t.events.currentModeName().indexOf("draw") !== -1 && (n.mouse = u.ADD);
    t.ui.queueMapClasses(n);
    t.ui.updateMapClasses();
    return o[0];
}
function ee(e, t) {
    const o = e.x - t.x;
    const n = e.y - t.y;
    return Math.sqrt(o * o + n * n);
}
const te = 4;
const oe = 12;
const ne = 500;
function re(e, t, o = {}) {
    const n = o.fineTolerance != null ? o.fineTolerance : te;
    const r = o.grossTolerance != null ? o.grossTolerance : oe;
    const i = o.interval != null ? o.interval : ne;
    e.point = e.point || t.point;
    e.time = e.time || t.time;
    const s = ee(e.point, t.point);
    return s < n || (s < r && t.time - e.time < i);
}
const ie = 25;
const se = 250;
function ae(e, t, o = {}) {
    const n = o.tolerance != null ? o.tolerance : ie;
    const r = o.interval != null ? o.interval : se;
    e.point = e.point || t.point;
    e.time = e.time || t.time;
    const i = ee(e.point, t.point);
    return i < n && t.time - e.time < r;
}
const ce = function (e, t) {
    const o = {
        drag: [],
        click: [],
        mousemove: [],
        mousedown: [],
        mouseup: [],
        mouseout: [],
        keydown: [],
        keyup: [],
        touchstart: [],
        touchmove: [],
        touchend: [],
        tap: [],
    };
    const n = {
        on(e, t, n) {
            if (o[e] === void 0) throw new Error(`Invalid event type: ${e}`);
            o[e].push({ selector: t, fn: n });
        },
        render(e) {
            t.store.featureChanged(e);
        },
    };
    const r = function (e, r) {
        const i = o[e];
        let s = i.length;
        while (s--) {
            const e = i[s];
            if (e.selector(r)) {
                const o = e.fn.call(n, r);
                o || t.store.render();
                t.ui.updateMapClasses();
                break;
            }
        }
    };
    e.start.call(n);
    return {
        render: e.render,
        stop() {
            e.stop && e.stop();
        },
        trash() {
            if (e.trash) {
                e.trash();
                t.store.render();
            }
        },
        combineFeatures() {
            e.combineFeatures && e.combineFeatures();
        },
        uncombineFeatures() {
            e.uncombineFeatures && e.uncombineFeatures();
        },
        drag(e) {
            r("drag", e);
        },
        click(e) {
            r("click", e);
        },
        mousemove(e) {
            r("mousemove", e);
        },
        mousedown(e) {
            r("mousedown", e);
        },
        mouseup(e) {
            r("mouseup", e);
        },
        mouseout(e) {
            r("mouseout", e);
        },
        keydown(e) {
            r("keydown", e);
        },
        keyup(e) {
            r("keyup", e);
        },
        touchstart(e) {
            r("touchstart", e);
        },
        touchmove(e) {
            r("touchmove", e);
        },
        touchend(e) {
            r("touchend", e);
        },
        tap(e) {
            r("tap", e);
        },
    };
};
const ue = t("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 32);
function le() {
    return ue();
}
const de = function (e, t) {
    this.ctx = e;
    this.properties = t.properties || {};
    this.coordinates = t.geometry.coordinates;
    this.id = t.id || le();
    this.type = t.geometry.type;
};
de.prototype.changed = function () {
    this.ctx.store.featureChanged(this.id);
};
de.prototype.incomingCoords = function (e) {
    this.setCoordinates(e);
};
de.prototype.setCoordinates = function (e) {
    this.coordinates = e;
    this.changed();
};
de.prototype.getCoordinates = function () {
    return JSON.parse(JSON.stringify(this.coordinates));
};
de.prototype.setProperty = function (e, t) {
    this.properties[e] = t;
};
de.prototype.toGeoJSON = function () {
    return JSON.parse(
        JSON.stringify({
            id: this.id,
            type: d.FEATURE,
            properties: this.properties,
            geometry: { coordinates: this.getCoordinates(), type: this.type },
        })
    );
};
de.prototype.internal = function (e) {
    const t = { id: this.id, meta: g.FEATURE, "meta:type": this.type, active: m.INACTIVE, mode: e };
    if (this.ctx.options.userProperties) for (const e in this.properties) t[`user_${e}`] = this.properties[e];
    return { type: d.FEATURE, properties: t, geometry: { coordinates: this.getCoordinates(), type: this.type } };
};
const pe = function (e, t) {
    de.call(this, e, t);
};
pe.prototype = Object.create(de.prototype);
pe.prototype.isValid = function () {
    return typeof this.coordinates[0] === "number" && typeof this.coordinates[1] === "number";
};
pe.prototype.updateCoordinate = function (e, t, o) {
    arguments.length === 3 ? (this.coordinates = [t, o]) : (this.coordinates = [e, t]);
    this.changed();
};
pe.prototype.getCoordinate = function () {
    return this.getCoordinates();
};
const he = function (e, t) {
    de.call(this, e, t);
};
he.prototype = Object.create(de.prototype);
he.prototype.isValid = function () {
    return this.coordinates.length > 1;
};
he.prototype.addCoordinate = function (e, t, o) {
    this.changed();
    const n = parseInt(e, 10);
    this.coordinates.splice(n, 0, [t, o]);
};
he.prototype.getCoordinate = function (e) {
    const t = parseInt(e, 10);
    return JSON.parse(JSON.stringify(this.coordinates[t]));
};
he.prototype.removeCoordinate = function (e) {
    this.changed();
    this.coordinates.splice(parseInt(e, 10), 1);
};
he.prototype.updateCoordinate = function (e, t, o) {
    const n = parseInt(e, 10);
    this.coordinates[n] = [t, o];
    this.changed();
};
const fe = function (e, t) {
    de.call(this, e, t);
    this.coordinates = this.coordinates.map((e) => e.slice(0, -1));
};
fe.prototype = Object.create(de.prototype);
fe.prototype.isValid = function () {
    return this.coordinates.length !== 0 && this.coordinates.every((e) => e.length > 2);
};
fe.prototype.incomingCoords = function (e) {
    this.coordinates = e.map((e) => e.slice(0, -1));
    this.changed();
};
fe.prototype.setCoordinates = function (e) {
    this.coordinates = e;
    this.changed();
};
fe.prototype.addCoordinate = function (e, t, o) {
    this.changed();
    const n = e.split(".").map((e) => parseInt(e, 10));
    const r = this.coordinates[n[0]];
    r.splice(n[1], 0, [t, o]);
};
fe.prototype.removeCoordinate = function (e) {
    this.changed();
    const t = e.split(".").map((e) => parseInt(e, 10));
    const o = this.coordinates[t[0]];
    if (o) {
        o.splice(t[1], 1);
        o.length < 3 && this.coordinates.splice(t[0], 1);
    }
};
fe.prototype.getCoordinate = function (e) {
    const t = e.split(".").map((e) => parseInt(e, 10));
    const o = this.coordinates[t[0]];
    return JSON.parse(JSON.stringify(o[t[1]]));
};
fe.prototype.getCoordinates = function () {
    return this.coordinates.map((e) => e.concat([e[0]]));
};
fe.prototype.updateCoordinate = function (e, t, o) {
    this.changed();
    const n = e.split(".");
    const r = parseInt(n[0], 10);
    const i = parseInt(n[1], 10);
    this.coordinates[r] === void 0 && (this.coordinates[r] = []);
    this.coordinates[r][i] = [t, o];
};
const ge = { MultiPoint: pe, MultiLineString: he, MultiPolygon: fe };
const me = (e, t, o, n, r) => {
    const i = o.split(".");
    const s = parseInt(i[0], 10);
    const a = i[1] ? i.slice(1).join(".") : null;
    return e[s][t](a, n, r);
};
const ye = function (e, t) {
    de.call(this, e, t);
    delete this.coordinates;
    this.model = ge[t.geometry.type];
    if (this.model === void 0) throw new TypeError(`${t.geometry.type} is not a valid type`);
    this.features = this._coordinatesToFeatures(t.geometry.coordinates);
};
ye.prototype = Object.create(de.prototype);
ye.prototype._coordinatesToFeatures = function (e) {
    const t = this.model.bind(this);
    return e.map(
        (e) =>
            new t(this.ctx, {
                id: le(),
                type: d.FEATURE,
                properties: {},
                geometry: { coordinates: e, type: this.type.replace("Multi", "") },
            })
    );
};
ye.prototype.isValid = function () {
    return this.features.every((e) => e.isValid());
};
ye.prototype.setCoordinates = function (e) {
    this.features = this._coordinatesToFeatures(e);
    this.changed();
};
ye.prototype.getCoordinate = function (e) {
    return me(this.features, "getCoordinate", e);
};
ye.prototype.getCoordinates = function () {
    return JSON.parse(
        JSON.stringify(this.features.map((e) => (e.type === d.POLYGON ? e.getCoordinates() : e.coordinates)))
    );
};
ye.prototype.updateCoordinate = function (e, t, o) {
    me(this.features, "updateCoordinate", e, t, o);
    this.changed();
};
ye.prototype.addCoordinate = function (e, t, o) {
    me(this.features, "addCoordinate", e, t, o);
    this.changed();
};
ye.prototype.removeCoordinate = function (e) {
    me(this.features, "removeCoordinate", e);
    this.changed();
};
ye.prototype.getFeatures = function () {
    return this.features;
};
function Ee(e) {
    this.map = e.map;
    this.drawConfig = JSON.parse(JSON.stringify(e.options || {}));
    this._ctx = e;
}
/**
 * Sets Draw's interal selected state
 * @name this.setSelected
 * @param {DrawFeature[]} - whats selected as a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js)
 */ Ee.prototype.setSelected = function (e) {
    return this._ctx.store.setSelected(e);
};
/**
 * Sets Draw's internal selected coordinate state
 * @name this.setSelectedCoordinates
 * @param {Object[]} coords - a array of {coord_path: 'string', feature_id: 'string'}
 */ Ee.prototype.setSelectedCoordinates = function (e) {
    this._ctx.store.setSelectedCoordinates(e);
    e.reduce((e, t) => {
        if (e[t.feature_id] === void 0) {
            e[t.feature_id] = true;
            this._ctx.store.get(t.feature_id).changed();
        }
        return e;
    }, {});
};
/**
 * Get all selected features as a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js)
 * @name this.getSelected
 * @returns {DrawFeature[]}
 */ Ee.prototype.getSelected = function () {
    return this._ctx.store.getSelected();
};
/**
 * Get the ids of all currently selected features
 * @name this.getSelectedIds
 * @returns {String[]}
 */ Ee.prototype.getSelectedIds = function () {
    return this._ctx.store.getSelectedIds();
};
/**
 * Check if a feature is selected
 * @name this.isSelected
 * @param {String} id - a feature id
 * @returns {Boolean}
 */ Ee.prototype.isSelected = function (e) {
    return this._ctx.store.isSelected(e);
};
/**
 * Get a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js) by its id
 * @name this.getFeature
 * @param {String} id - a feature id
 * @returns {DrawFeature}
 */ Ee.prototype.getFeature = function (e) {
    return this._ctx.store.get(e);
};
/**
 * Add a feature to draw's internal selected state
 * @name this.select
 * @param {String} id
 */ Ee.prototype.select = function (e) {
    return this._ctx.store.select(e);
};
/**
 * Remove a feature from draw's internal selected state
 * @name this.delete
 * @param {String} id
 */ Ee.prototype.deselect = function (e) {
    return this._ctx.store.deselect(e);
};
/**
 * Delete a feature from draw
 * @name this.deleteFeature
 * @param {String} id - a feature id
 */ Ee.prototype.deleteFeature = function (e, t = {}) {
    return this._ctx.store.delete(e, t);
};
/**
 * Add a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js) to draw.
 * See `this.newFeature` for converting geojson into a DrawFeature
 * @name this.addFeature
 * @param {DrawFeature} feature - the feature to add
 */ Ee.prototype.addFeature = function (e, t = {}) {
    return this._ctx.store.add(e, t);
};
Ee.prototype.clearSelectedFeatures = function () {
    return this._ctx.store.clearSelected();
};
Ee.prototype.clearSelectedCoordinates = function () {
    return this._ctx.store.clearSelectedCoordinates();
};
/**
 * Indicate if the different action are currently possible with your mode
 * See [draw.actionalbe](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#drawactionable) for a list of possible actions. All undefined actions are set to **false** by default
 * @name this.setActionableState
 * @param {Object} actions
 */ Ee.prototype.setActionableState = function (e = {}) {
    const t = {
        trash: e.trash || false,
        combineFeatures: e.combineFeatures || false,
        uncombineFeatures: e.uncombineFeatures || false,
    };
    return this._ctx.events.actionable(t);
};
/**
 * Trigger a mode change
 * @name this.changeMode
 * @param {String} mode - the mode to transition into
 * @param {Object} opts - the options object to pass to the new mode
 * @param {Object} eventOpts - used to control what kind of events are emitted.
 */ Ee.prototype.changeMode = function (e, t = {}, o = {}) {
    return this._ctx.events.changeMode(e, t, o);
};
/**
 * Fire a map event
 * @name this.fire
 * @param {String} eventName - the event name.
 * @param {Object} eventData - the event data object.
 */ Ee.prototype.fire = function (e, t) {
    return this._ctx.events.fire(e, t);
};
/**
 * Update the state of draw map classes
 * @name this.updateUIClasses
 * @param {Object} opts
 */ Ee.prototype.updateUIClasses = function (e) {
    return this._ctx.ui.queueMapClasses(e);
};
/**
 * If a name is provided it makes that button active, else if makes all buttons inactive
 * @name this.activateUIButton
 * @param {String?} name - name of the button to make active, leave as undefined to set buttons to be inactive
 */ Ee.prototype.activateUIButton = function (e) {
    return this._ctx.ui.setActiveButton(e);
};
/**
 * Get the features at the location of an event object or in a bbox
 * @name this.featuresAt
 * @param {Event||NULL} event - a mapbox-gl event object
 * @param {BBOX||NULL} bbox - the area to get features from
 * @param {String} bufferType - is this `click` or `tap` event, defaults to click
 */ Ee.prototype.featuresAt = function (e, t, o = "click") {
    if (o !== "click" && o !== "touch") throw new Error("invalid buffer type");
    return Z[o](e, t, this._ctx);
};
/**
 * Create a new [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js) from geojson
 * @name this.newFeature
 * @param {GeoJSONFeature} geojson
 * @returns {DrawFeature}
 */ Ee.prototype.newFeature = function (e) {
    const t = e.geometry.type;
    return t === d.POINT
        ? new pe(this._ctx, e)
        : t === d.LINE_STRING
          ? new he(this._ctx, e)
          : t === d.POLYGON
            ? new fe(this._ctx, e)
            : new ye(this._ctx, e);
};
/**
 * Check is an object is an instance of a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js)
 * @name this.isInstanceOf
 * @param {String} type - `Point`, `LineString`, `Polygon`, `MultiFeature`
 * @param {Object} feature - the object that needs to be checked
 * @returns {Boolean}
 */ Ee.prototype.isInstanceOf = function (e, t) {
    if (e === d.POINT) return t instanceof pe;
    if (e === d.LINE_STRING) return t instanceof he;
    if (e === d.POLYGON) return t instanceof fe;
    if (e === "MultiFeature") return t instanceof ye;
    throw new Error(`Unknown feature class: ${e}`);
};
/**
 * Force draw to rerender the feature of the provided id
 * @name this.doRender
 * @param {String} id - a feature id
 */ Ee.prototype.doRender = function (e) {
    return this._ctx.store.featureChanged(e);
};
/**
 * Triggered while a mode is being transitioned into.
 * @param opts {Object} - this is the object passed via `draw.changeMode('mode', opts)`;
 * @name MODE.onSetup
 * @returns {Object} - this object will be passed to all other life cycle functions
 */ Ee.prototype.onSetup = function () {};
/**
 * Triggered when a drag event is detected on the map
 * @name MODE.onDrag
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onDrag = function () {};
/**
 * Triggered when the mouse is clicked
 * @name MODE.onClick
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onClick = function () {};
/**
 * Triggered with the mouse is moved
 * @name MODE.onMouseMove
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onMouseMove = function () {};
/**
 * Triggered when the mouse button is pressed down
 * @name MODE.onMouseDown
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onMouseDown = function () {};
/**
 * Triggered when the mouse button is released
 * @name MODE.onMouseUp
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onMouseUp = function () {};
/**
 * Triggered when the mouse leaves the map's container
 * @name MODE.onMouseOut
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onMouseOut = function () {};
/**
 * Triggered when a key up event is detected
 * @name MODE.onKeyUp
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onKeyUp = function () {};
/**
 * Triggered when a key down event is detected
 * @name MODE.onKeyDown
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onKeyDown = function () {};
/**
 * Triggered when a touch event is started
 * @name MODE.onTouchStart
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onTouchStart = function () {};
/**
 * Triggered when one drags thier finger on a mobile device
 * @name MODE.onTouchMove
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onTouchMove = function () {};
/**
 * Triggered when one removes their finger from the map
 * @name MODE.onTouchEnd
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onTouchEnd = function () {};
/**
 * Triggered when one quicly taps the map
 * @name MODE.onTap
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ Ee.prototype.onTap = function () {};
/**
 * Triggered when the mode is being exited, to be used for cleaning up artifacts such as invalid features
 * @name MODE.onStop
 * @param state {Object} - a mutible state object created by onSetup
 */ Ee.prototype.onStop = function () {};
/**
 * Triggered when [draw.trash()](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#trash-draw) is called.
 * @name MODE.onTrash
 * @param state {Object} - a mutible state object created by onSetup
 */ Ee.prototype.onTrash = function () {};
/**
 * Triggered when [draw.combineFeatures()](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#combinefeatures-draw) is called.
 * @name MODE.onCombineFeature
 * @param state {Object} - a mutible state object created by onSetup
 */ Ee.prototype.onCombineFeature = function () {};
/**
 * Triggered when [draw.uncombineFeatures()](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#uncombinefeatures-draw) is called.
 * @name MODE.onUncombineFeature
 * @param state {Object} - a mutible state object created by onSetup
 */ Ee.prototype.onUncombineFeature = function () {};
/**
 * Triggered per feature on render to convert raw features into set of features for display on the map
 * See [styling draw](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#styling-draw) for information about what geojson properties Draw uses as part of rendering.
 * @name MODE.toDisplayFeatures
 * @param state {Object} - a mutible state object created by onSetup
 * @param geojson {Object} - a geojson being evaulated. To render, pass to `display`.
 * @param display {Function} - all geojson objects passed to this be rendered onto the map
 */ Ee.prototype.toDisplayFeatures = function () {
    throw new Error("You must overwrite toDisplayFeatures");
};
const Te = {
    drag: "onDrag",
    click: "onClick",
    mousemove: "onMouseMove",
    mousedown: "onMouseDown",
    mouseup: "onMouseUp",
    mouseout: "onMouseOut",
    keyup: "onKeyUp",
    keydown: "onKeyDown",
    touchstart: "onTouchStart",
    touchmove: "onTouchMove",
    touchend: "onTouchEnd",
    tap: "onTap",
};
const Ce = Object.keys(Te);
function Ie(e) {
    const t = Object.keys(e);
    return function (o, n = {}) {
        let r = {};
        const i = t.reduce((t, o) => {
            t[o] = e[o];
            return t;
        }, new Ee(o));
        function s(e) {
            return (t) => i[e](r, t);
        }
        return {
            start() {
                r = i.onSetup(n);
                Ce.forEach((t) => {
                    const o = Te[t];
                    let n = () => false;
                    e[o] && (n = () => true);
                    this.on(t, n, s(o));
                });
            },
            stop() {
                i.onStop(r);
            },
            trash() {
                i.onTrash(r);
            },
            combineFeatures() {
                i.onCombineFeatures(r);
            },
            uncombineFeatures() {
                i.onUncombineFeatures(r);
            },
            render(e, t) {
                i.toDisplayFeatures(r, e, t);
            },
        };
    };
}
function Se(e) {
    const t = Object.keys(e.options.modes).reduce((t, o) => {
        t[o] = Ie(e.options.modes[o]);
        return t;
    }, {});
    let o = {};
    let n = {};
    const r = {};
    let i = null;
    let s = null;
    const isLeftClick = (e) => {
        const originalEvent = e?.originalEvent;
        if (!originalEvent) { return true; }
        if ('button' in originalEvent) { return originalEvent.button === 0; }
        if ('which' in originalEvent) { return originalEvent.which === 1; }
        if ('buttons' in originalEvent) { return originalEvent.buttons === 1; }
        return true;
    };
    r.drag = function (t, o) {
        if (o({ point: t.point, time: new Date().getTime() })) {
            e.ui.queueMapClasses({ mouse: u.DRAG });
            s.drag(t);
        } else t.originalEvent.stopPropagation();
    };
    r.mousedrag = function (e) {
        r.drag(e, (e) => !re(o, e));
    };
    r.touchdrag = function (e) {
        r.drag(e, (e) => !ae(n, e));
    };
    r.mousemove = function (t) {
        const o = t.originalEvent.buttons !== void 0 ? t.originalEvent.buttons : t.originalEvent.which;
        if (o === 1) return r.mousedrag(t);
        const n = Q(t, e);
        t.featureTarget = n;
        s.mousemove(t);
    };
    r.mousedown = function (t) {
        if (!isLeftClick(t)) return;
        o = { time: new Date().getTime(), point: t.point };
        const n = Q(t, e);
        t.featureTarget = n;
        s.mousedown(t);
    };
    r.mouseup = function (t) {
        if (!isLeftClick(t)) return;
        const n = Q(t, e);
        t.featureTarget = n;
        re(o, { point: t.point, time: new Date().getTime() }) ? s.click(t) : s.mouseup(t);
    };
    r.mouseout = function (e) {
        s.mouseout(e);
    };
    r.touchstart = function (t) {
        if (!e.options.touchEnabled) return;
        n = { time: new Date().getTime(), point: t.point };
        const o = Z.touch(t, null, e)[0];
        t.featureTarget = o;
        s.touchstart(t);
    };
    r.touchmove = function (t) {
        if (e.options.touchEnabled) {
            s.touchmove(t);
            return r.touchdrag(t);
        }
    };
    r.touchend = function (t) {
        t.originalEvent.preventDefault();
        if (!e.options.touchEnabled) return;
        const o = Z.touch(t, null, e)[0];
        t.featureTarget = o;
        ae(n, { time: new Date().getTime(), point: t.point }) ? s.tap(t) : s.touchend(t);
    };
    const c = (e) => {
        const t = D(e);
        const o = w(e);
        const n = G(e);
        return !(t || o || n);
    };
    r.keydown = function (t) {
        const o = (t.srcElement || t.target).classList.contains(a.CANVAS);
        if (o)
            if ((D(t) || w(t)) && e.options.controls.trash) {
                t.preventDefault();
                s.trash();
            } else
                c(t)
                    ? s.keydown(t)
                    : U(t) && e.options.controls.point
                      ? l(p.DRAW_POINT)
                      : k(t) && e.options.controls.line_string
                        ? l(p.DRAW_LINE_STRING)
                        : V(t) && e.options.controls.polygon && l(p.DRAW_POLYGON);
    };
    r.keyup = function (e) {
        c(e) && s.keyup(e);
    };
    r.zoomend = function () {
        e.store.changeZoom();
    };
    r.data = function (t) {
        if (t.dataType === "style") {
            const { setup: t, map: o, options: n, store: r } = e;
            const i = n.styles.some((e) => o.getLayer(e.id));
            if (!i) {
                t.addLayers();
                r.setDirty();
                r.render();
            }
        }
    };
    function l(o, n, r = {}) {
        s.stop();
        const a = t[o];
        if (a === void 0) throw new Error(`${o} is not valid`);
        i = o;
        const c = a(e, n);
        s = ce(c, e);
        r.silent || e.map.fire(h.MODE_CHANGE, { mode: o });
        e.store.setDirty();
        e.store.render();
    }
    const d = { trash: false, combineFeatures: false, uncombineFeatures: false };
    function f(t) {
        let o = false;
        Object.keys(t).forEach((e) => {
            if (d[e] === void 0) throw new Error("Invalid action type");
            d[e] !== t[e] && (o = true);
            d[e] = t[e];
        });
        o && e.map.fire(h.ACTIONABLE, { actions: d });
    }
    const g = {
        start() {
            i = e.options.defaultMode;
            s = ce(t[i](e), e);
        },
        changeMode: l,
        actionable: f,
        currentModeName() {
            return i;
        },
        currentModeRender(e, t) {
            return s.render(e, t);
        },
        fire(t, o) {
            e.map && e.map.fire(t, o);
        },
        addEventListeners() {
            e.map.on("mousemove", r.mousemove);
            e.map.on("mousedown", r.mousedown);
            e.map.on("mouseup", r.mouseup);
            e.map.on("data", r.data);
            e.map.on("touchmove", r.touchmove);
            e.map.on("touchstart", r.touchstart);
            e.map.on("touchend", r.touchend);
            e.container.addEventListener("mouseout", r.mouseout);
            if (e.options.keybindings) {
                e.container.addEventListener("keydown", r.keydown);
                e.container.addEventListener("keyup", r.keyup);
            }
        },
        removeEventListeners() {
            e.map.off("mousemove", r.mousemove);
            e.map.off("mousedown", r.mousedown);
            e.map.off("mouseup", r.mouseup);
            e.map.off("data", r.data);
            e.map.off("touchmove", r.touchmove);
            e.map.off("touchstart", r.touchstart);
            e.map.off("touchend", r.touchend);
            e.container.removeEventListener("mouseout", r.mouseout);
            if (e.options.keybindings) {
                e.container.removeEventListener("keydown", r.keydown);
                e.container.removeEventListener("keyup", r.keyup);
            }
        },
        trash(e) {
            s.trash(e);
        },
        combineFeatures() {
            s.combineFeatures();
        },
        uncombineFeatures() {
            s.uncombineFeatures();
        },
        getMode() {
            return i;
        },
    };
    return g;
}
/**
 * Derive a dense array (no `undefined`s) from a single value or array.
 *
 * @param {any} x
 * @return {Array<any>}
 */ function _e(e) {
    return [].concat(e).filter((e) => e !== void 0);
}
function ve() {
    const e = this;
    const t = e.ctx.map && e.ctx.map.getSource(c.HOT) !== void 0;
    if (!t) return u();
    const o = e.ctx.events.currentModeName();
    e.ctx.ui.queueMapClasses({ mode: o });
    let n = [];
    let r = [];
    if (e.isDirty) r = e.getAllIds();
    else {
        n = e.getChangedIds().filter((t) => e.get(t) !== void 0);
        r = e.sources.hot
            .filter((t) => t.properties.id && n.indexOf(t.properties.id) === -1 && e.get(t.properties.id) !== void 0)
            .map((e) => e.properties.id);
    }
    e.sources.hot = [];
    const i = e.sources.cold.length;
    e.sources.cold = e.isDirty
        ? []
        : e.sources.cold.filter((e) => {
              const t = e.properties.id || e.properties.parent;
              return n.indexOf(t) === -1;
          });
    const s = i !== e.sources.cold.length || r.length > 0;
    n.forEach((e) => a(e, "hot"));
    r.forEach((e) => a(e, "cold"));
    function a(t, n) {
        const r = e.get(t);
        const i = r.internal(o);
        e.ctx.events.currentModeRender(i, (t) => {
            t.properties.mode = o;
            e.sources[n].push(t);
        });
    }
    s && e.ctx.map.getSource(c.COLD).setData({ type: d.FEATURE_COLLECTION, features: e.sources.cold });
    e.ctx.map.getSource(c.HOT).setData({ type: d.FEATURE_COLLECTION, features: e.sources.hot });
    u();
    function u() {
        e.isDirty = false;
        e.clearChangedIds();
    }
}
function Oe(e) {
    this._features = {};
    this._featureIds = new X();
    this._selectedFeatureIds = new X();
    this._selectedCoordinates = [];
    this._changedFeatureIds = new X();
    this._emitSelectionChange = false;
    this._mapInitialConfig = {};
    this.ctx = e;
    this.sources = { hot: [], cold: [] };
    let t;
    this.render = () => {
        t ||
            (t = requestAnimationFrame(() => {
                t = null;
                ve.call(this);
                if (this._emitSelectionChange) {
                    this.ctx.events.fire(h.SELECTION_CHANGE, {
                        features: this.getSelected().map((e) => e.toGeoJSON()),
                        points: this.getSelectedCoordinates().map((e) => ({
                            type: d.FEATURE,
                            properties: {},
                            geometry: { type: d.POINT, coordinates: e.coordinates },
                        })),
                    });
                    this._emitSelectionChange = false;
                }
                this.ctx.events.fire(h.RENDER, {});
            }));
    };
    this.isDirty = false;
}
Oe.prototype.createRenderBatch = function () {
    const e = this.render;
    let t = 0;
    this.render = function () {
        t++;
    };
    return () => {
        this.render = e;
        t > 0 && this.render();
    };
};
Oe.prototype.setDirty = function () {
    this.isDirty = true;
    return this;
};
/**
 * Sets a feature's state to changed.
 * @param {string} featureId
 * @return {Store} this
 */ Oe.prototype.featureCreated = function (e, t = {}) {
    this._changedFeatureIds.add(e);
    const o = t.silent != null ? t.silent : this.ctx.options.suppressAPIEvents;
    if (o !== true) {
        const t = this.get(e);
        this.ctx.events.fire(h.CREATE, { features: [t.toGeoJSON()] });
    }
    return this;
};
/**
 * Sets a feature's state to changed.
 * @param {string} featureId
 * @return {Store} this
 */ Oe.prototype.featureChanged = function (e, t = {}) {
    this._changedFeatureIds.add(e);
    const o = t.silent != null ? t.silent : this.ctx.options.suppressAPIEvents;
    o !== true &&
        this.ctx.events.fire(h.UPDATE, {
            action: t.action ? t.action : f.CHANGE_COORDINATES,
            features: [this.get(e).toGeoJSON()],
        });
    return this;
};
Oe.prototype.getChangedIds = function () {
    return this._changedFeatureIds.values();
};
Oe.prototype.clearChangedIds = function () {
    this._changedFeatureIds.clear();
    return this;
};
Oe.prototype.getAllIds = function () {
    return this._featureIds.values();
};
/**
 * Adds a feature to the store.
 * @param {Object} feature
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 *
 * @return {Store} this
 */ Oe.prototype.add = function (e, t = {}) {
    this._features[e.id] = e;
    this._featureIds.add(e.id);
    this.featureCreated(e.id, { silent: t.silent });
    return this;
};
/**
 * Deletes a feature or array of features from the store.
 * Cleans up after the deletion by deselecting the features.
 * If changes were made, sets the state to the dirty
 * and fires an event.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Oe.prototype.delete = function (e, t = {}) {
    const o = [];
    _e(e).forEach((e) => {
        if (this._featureIds.has(e)) {
            this._featureIds.delete(e);
            this._selectedFeatureIds.delete(e);
            t.silent || (o.indexOf(this._features[e]) === -1 && o.push(this._features[e].toGeoJSON()));
            delete this._features[e];
            this.isDirty = true;
        }
    });
    o.length && this.ctx.events.fire(h.DELETE, { features: o });
    Ne(this, t);
    return this;
};
Oe.prototype.get = function (e) {
    return this._features[e];
};
Oe.prototype.getAll = function () {
    return Object.keys(this._features).map((e) => this._features[e]);
};
/**
 * Adds features to the current selection.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Oe.prototype.select = function (e, t = {}) {
    _e(e).forEach((e) => {
        if (!this._selectedFeatureIds.has(e)) {
            this._selectedFeatureIds.add(e);
            this._changedFeatureIds.add(e);
            t.silent || (this._emitSelectionChange = true);
        }
    });
    return this;
};
/**
 * Deletes features from the current selection.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Oe.prototype.deselect = function (e, t = {}) {
    _e(e).forEach((e) => {
        if (this._selectedFeatureIds.has(e)) {
            this._selectedFeatureIds.delete(e);
            this._changedFeatureIds.add(e);
            t.silent || (this._emitSelectionChange = true);
        }
    });
    Ne(this, t);
    return this;
};
/**
 * Clears the current selection.
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Oe.prototype.clearSelected = function (e = {}) {
    this.deselect(this._selectedFeatureIds.values(), { silent: e.silent });
    return this;
};
/**
 * Sets the store's selection, clearing any prior values.
 * If no feature ids are passed, the store is just cleared.
 * @param {string | Array<string> | undefined} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Oe.prototype.setSelected = function (e, t = {}) {
    e = _e(e);
    this.deselect(
        this._selectedFeatureIds.values().filter((t) => e.indexOf(t) === -1),
        { silent: t.silent }
    );
    this.select(
        e.filter((e) => !this._selectedFeatureIds.has(e)),
        { silent: t.silent }
    );
    return this;
};
/**
 * Sets the store's coordinates selection, clearing any prior values.
 * @param {Array<Array<string>>} coordinates
 * @return {Store} this
 */ Oe.prototype.setSelectedCoordinates = function (e) {
    this._selectedCoordinates = e;
    this._emitSelectionChange = true;
    return this;
};
/**
 * Clears the current coordinates selection.
 * @param {Object} [options]
 * @return {Store} this
 */ Oe.prototype.clearSelectedCoordinates = function () {
    this._selectedCoordinates = [];
    this._emitSelectionChange = true;
    return this;
};
Oe.prototype.getSelectedIds = function () {
    return this._selectedFeatureIds.values();
};
Oe.prototype.getSelected = function () {
    return this.getSelectedIds().map((e) => this.get(e));
};
Oe.prototype.getSelectedCoordinates = function () {
    const e = this._selectedCoordinates.map((e) => {
        const t = this.get(e.feature_id);
        return { coordinates: t.getCoordinate(e.coord_path) };
    });
    return e;
};
/**
 * Indicates whether a feature is selected.
 * @param {string} featureId
 * @return {boolean} `true` if the feature is selected, `false` if not.
 */ Oe.prototype.isSelected = function (e) {
    return this._selectedFeatureIds.has(e);
};
/**
 * Sets a property on the given feature
 * @param {string} featureId
 * @param {string} property property
 * @param {string} property value
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 */ Oe.prototype.setFeatureProperty = function (e, t, o, n = {}) {
    this.get(e).setProperty(t, o);
    this.featureChanged(e, { silent: n.silent, action: f.CHANGE_PROPERTIES });
};
function Ne(e, t = {}) {
    const o = e._selectedCoordinates.filter((t) => e._selectedFeatureIds.has(t.feature_id));
    e._selectedCoordinates.length === o.length || t.silent || (e._emitSelectionChange = true);
    e._selectedCoordinates = o;
}
Oe.prototype.storeMapConfig = function () {
    y.forEach((e) => {
        const t = this.ctx.map[e];
        t && (this._mapInitialConfig[e] = this.ctx.map[e].isEnabled());
    });
};
Oe.prototype.restoreMapConfig = function () {
    Object.keys(this._mapInitialConfig).forEach((e) => {
        const t = this._mapInitialConfig[e];
        t ? this.ctx.map[e].enable() : this.ctx.map[e].disable();
    });
};
/**
 * Returns the initial state of an interaction setting.
 * @param {string} interaction
 * @return {boolean} `true` if the interaction is enabled, `false` if not.
 * Defaults to `true`. (Todo: include defaults.)
 */ Oe.prototype.getInitialConfigValue = function (e) {
    return this._mapInitialConfig[e] === void 0 || this._mapInitialConfig[e];
};
const Le = ["mode", "feature", "mouse"];
function Me(e) {
    const t = {};
    let o = null;
    let n = { mode: null, feature: null, mouse: null };
    let r = { mode: null, feature: null, mouse: null };
    function i() {
        s({ mode: null, feature: null, mouse: null });
        c();
    }
    function s(e) {
        r = Object.assign(r, e);
    }
    function c() {
        if (!e.container) return;
        const t = [];
        const o = [];
        Le.forEach((e) => {
            if (r[e] !== n[e]) {
                t.push(`${e}-${n[e]}`);
                r[e] !== null && o.push(`${e}-${r[e]}`);
            }
        });
        t.length > 0 && e.container.classList.remove(...t);
        o.length > 0 && e.container.classList.add(...o);
        n = Object.assign(n, r);
    }
    function u(e, t = {}) {
        const n = document.createElement("button");
        n.className = `${a.CONTROL_BUTTON} ${t.className}`;
        n.setAttribute("title", t.title);
        t.container.appendChild(n);
        n.addEventListener(
            "click",
            (n) => {
                n.preventDefault();
                n.stopPropagation();
                const r = n.target;
                if (r !== o) {
                    h(e);
                    t.onActivate();
                } else {
                    d();
                    t.onDeactivate();
                }
            },
            true
        );
        return n;
    }
    function d() {
        if (o) {
            o.classList.remove(a.ACTIVE_BUTTON);
            o = null;
        }
    }
    function h(e) {
        d();
        const n = t[e];
        if (n && n && e !== "trash") {
            n.classList.add(a.ACTIVE_BUTTON);
            o = n;
        }
    }
    function f() {
        const o = e.options.controls;
        const n = document.createElement("div");
        n.className = `${a.CONTROL_GROUP} ${a.CONTROL_BASE}`;
        if (!o) return n;
        o[l.POINT] &&
            (t[l.POINT] = u(l.POINT, {
                container: n,
                className: a.CONTROL_BUTTON_POINT,
                title: "Marker tool " + (e.options.keybindings ? "(1)" : ""),
                onActivate: () => e.events.changeMode(p.DRAW_POINT),
                onDeactivate: () => e.events.trash(),
            }));
        o[l.LINE] &&
            (t[l.LINE] = u(l.LINE, {
                container: n,
                className: a.CONTROL_BUTTON_LINE,
                title: "LineString tool " + (e.options.keybindings ? "(2)" : ""),
                onActivate: () => e.events.changeMode(p.DRAW_LINE_STRING),
                onDeactivate: () => e.events.trash(),
            }));
        o[l.POLYGON] &&
            (t[l.POLYGON] = u(l.POLYGON, {
                container: n,
                className: a.CONTROL_BUTTON_POLYGON,
                title: "Polygon tool " + (e.options.keybindings ? "(3)" : ""),
                onActivate: () => e.events.changeMode(p.DRAW_POLYGON),
                onDeactivate: () => e.events.trash(),
            }));
        o.trash &&
            (t.trash = u("trash", {
                container: n,
                className: a.CONTROL_BUTTON_TRASH,
                title: "Delete",
                onActivate: () => {
                    e.events.trash();
                },
            }));
        o.combine_features &&
            (t.combine_features = u("combineFeatures", {
                container: n,
                className: a.CONTROL_BUTTON_COMBINE_FEATURES,
                title: "Combine",
                onActivate: () => {
                    e.events.combineFeatures();
                },
            }));
        o.uncombine_features &&
            (t.uncombine_features = u("uncombineFeatures", {
                container: n,
                className: a.CONTROL_BUTTON_UNCOMBINE_FEATURES,
                title: "Uncombine",
                onActivate: () => {
                    e.events.uncombineFeatures();
                },
            }));
        return n;
    }
    function g() {
        Object.keys(t).forEach((e) => {
            const o = t[e];
            o.parentNode && o.parentNode.removeChild(o);
            delete t[e];
        });
    }
    return {
        setActiveButton: h,
        queueMapClasses: s,
        updateMapClasses: c,
        clearMapClasses: i,
        addButtons: f,
        removeButtons: g,
    };
}
function be(e) {
    let t = null;
    let o = null;
    const n = {
        onRemove() {
            e.map.off("load", n.connect);
            clearInterval(o);
            n.removeLayers();
            e.store.restoreMapConfig();
            e.ui.removeButtons();
            e.events.removeEventListeners();
            e.ui.clearMapClasses();
            e.boxZoomInitial && e.map.boxZoom.enable();
            e.map = null;
            e.container = null;
            e.store = null;
            t && t.parentNode && t.parentNode.removeChild(t);
            t = null;
            return this;
        },
        connect() {
            e.map.off("load", n.connect);
            clearInterval(o);
            n.addLayers();
            e.store.storeMapConfig();
            e.events.addEventListeners();
        },
        onAdd(r) {
            e.map = r;
            e.events = Se(e);
            e.ui = Me(e);
            e.container = r.getContainer();
            e.store = new Oe(e);
            t = e.ui.addButtons();
            if (e.options.boxSelect) {
                e.boxZoomInitial = r.boxZoom.isEnabled();
                r.boxZoom.disable();
                const t = r.dragPan.isEnabled();
                r.dragPan.disable();
                r.dragPan.enable();
                t || r.dragPan.disable();
            }
            if (r.loaded()) n.connect();
            else {
                r.on("load", n.connect);
                o = setInterval(() => {
                    r.loaded() && n.connect();
                }, 16);
            }
            e.events.start();
            return t;
        },
        addLayers() {
            e.map.addSource(c.COLD, { data: { type: d.FEATURE_COLLECTION, features: [] }, type: "geojson" });
            e.map.addSource(c.HOT, { data: { type: d.FEATURE_COLLECTION, features: [] }, type: "geojson" });
            e.options.styles.forEach((t) => {
                e.map.addLayer(t);
            });
            e.store.setDirty(true);
            e.store.render();
        },
        removeLayers() {
            e.options.styles.forEach((t) => {
                e.map.getLayer(t.id) && e.map.removeLayer(t.id);
            });
            e.map.getSource(c.COLD) && e.map.removeSource(c.COLD);
            e.map.getSource(c.HOT) && e.map.removeSource(c.HOT);
        },
    };
    e.setup = n;
    return n;
}
const Ae = "#3bb2d0";
const Pe = "#fbb03b";
const Fe = "#fff";
var xe = [
    {
        id: "gl-draw-polygon-fill",
        type: "fill",
        filter: ["all", ["==", "$type", "Polygon"]],
        paint: { "fill-color": ["case", ["==", ["get", "active"], "true"], Pe, Ae], "fill-opacity": 0.1 },
    },
    {
        id: "gl-draw-lines",
        type: "line",
        filter: ["any", ["==", "$type", "LineString"], ["==", "$type", "Polygon"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
            "line-color": ["case", ["==", ["get", "active"], "true"], Pe, Ae],
            "line-dasharray": ["case", ["==", ["get", "active"], "true"], [0.2, 2], [2, 0]],
            "line-width": 2,
        },
    },
    {
        id: "gl-draw-point-outer",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]],
        paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 7, 5], "circle-color": Fe },
    },
    {
        id: "gl-draw-point-inner",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]],
        paint: {
            "circle-radius": ["case", ["==", ["get", "active"], "true"], 5, 3],
            "circle-color": ["case", ["==", ["get", "active"], "true"], Pe, Ae],
        },
    },
    {
        id: "gl-draw-vertex-outer",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["!=", "mode", "simple_select"]],
        paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 7, 5], "circle-color": Fe },
    },
    {
        id: "gl-draw-vertex-inner",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["!=", "mode", "simple_select"]],
        paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 5, 3], "circle-color": Pe },
    },
    {
        id: "gl-draw-midpoint",
        type: "circle",
        filter: ["all", ["==", "meta", "midpoint"]],
        paint: { "circle-radius": 3, "circle-color": Pe },
    },
];
/**
 * Returns a Point representing a mouse event's position
 * relative to a containing element.
 *
 * @param {MouseEvent} mouseEvent
 * @param {Node} container
 * @returns {Point}
 */ function Re(e, t) {
    const n = t.getBoundingClientRect();
    return new o(e.clientX - n.left - (t.clientLeft || 0), e.clientY - n.top - (t.clientTop || 0));
}
/**
 * Returns GeoJSON for a Point representing the
 * vertex of another feature.
 *
 * @param {string} parentId
 * @param {Array<number>} coordinates
 * @param {string} path - Dot-separated numbers indicating exactly
 *   where the point exists within its parent feature's coordinates.
 * @param {boolean} selected
 * @return {GeoJSON} Point
 */ function De(e, t, o, n) {
    return {
        type: d.FEATURE,
        properties: { meta: g.VERTEX, parent: e, coord_path: o, active: n ? m.ACTIVE : m.INACTIVE },
        geometry: { type: d.POINT, coordinates: t },
    };
}
function we(e, t, o) {
    const i = t.geometry.coordinates;
    const s = o.geometry.coordinates;
    if (i[1] > I || i[1] < T || s[1] > I || s[1] < T) return null;
    const a = n(i);
    const c = n(s);
    const u = (e) => Number(e.toFixed(8));
    const l = (e, t) => (e + t) / 2;
    const p = r([l(a[0], c[0]), l(a[1], c[1])]);
    const h = [u(p[0]), u(p[1])];
    return {
        type: d.FEATURE,
        properties: { meta: g.MIDPOINT, parent: e, lng: h[0], lat: h[1], coord_path: o.properties.coord_path },
        geometry: { type: d.POINT, coordinates: h },
    };
}
function Ue(e, t = {}, o = null) {
    const { type: n, coordinates: r } = e.geometry;
    const i = e.properties && e.properties.id;
    let s = [];
    n === d.POINT
        ? s.push(De(i, r, o, c(o)))
        : n === d.POLYGON
          ? r.forEach((e, t) => {
                a(e, o !== null ? `${o}.${t}` : String(t));
            })
          : n === d.LINE_STRING
            ? a(r, o)
            : n.indexOf(d.MULTI_PREFIX) === 0 && u();
    function a(e, o) {
        let n = "";
        let r = null;
        e.forEach((e, a) => {
            const u = o !== void 0 && o !== null ? `${o}.${a}` : String(a);
            const l = De(i, e, u, c(u));
            if (t.midpoints && r) {
                const e = we(i, r, l);
                e && s.push(e);
            }
            r = l;
            const d = JSON.stringify(e);
            n !== d && s.push(l);
            a === 0 && (n = d);
        });
    }
    function c(e) {
        return !!t.selectedPaths && t.selectedPaths.indexOf(e) !== -1;
    }
    function u() {
        const o = n.replace(d.MULTI_PREFIX, "");
        r.forEach((n, r) => {
            const i = { type: d.FEATURE, properties: e.properties, geometry: { type: o, coordinates: n } };
            s = s.concat(Ue(i, t, r));
        });
    }
    return s;
}
var ke = {
    enable(e) {
        setTimeout(() => {
            e.map &&
                e.map.doubleClickZoom &&
                e._ctx &&
                e._ctx.store &&
                e._ctx.store.getInitialConfigValue &&
                e._ctx.store.getInitialConfigValue("doubleClickZoom") &&
                e.map.doubleClickZoom.enable();
        }, 0);
    },
    disable(e) {
        setTimeout(() => {
            e.map && e.map.doubleClickZoom && e.map.doubleClickZoom.disable();
        }, 0);
    },
};
const { LAT_MIN: Ve, LAT_MAX: Ge, LAT_RENDERED_MIN: Be, LAT_RENDERED_MAX: Je, LNG_MIN: $e, LNG_MAX: je } = v;
function Ye(e) {
    const t = { Point: 0, LineString: 1, Polygon: 2, MultiPoint: 1, MultiLineString: 2, MultiPolygon: 3 }[
        e.geometry.type
    ];
    const o = [e.geometry.coordinates].flat(t);
    const n = o.map((e) => e[0]);
    const r = o.map((e) => e[1]);
    const i = (e) => Math.min.apply(null, e);
    const s = (e) => Math.max.apply(null, e);
    return [i(n), i(r), s(n), s(r)];
}
function He(e, t) {
    let o = Ve;
    let n = Ge;
    let r = Ve;
    let i = Ge;
    let s = je;
    let a = $e;
    e.forEach((e) => {
        const t = Ye(e);
        const c = t[1];
        const u = t[3];
        const l = t[0];
        const d = t[2];
        c > o && (o = c);
        u < n && (n = u);
        u > r && (r = u);
        c < i && (i = c);
        l < s && (s = l);
        d > a && (a = d);
    });
    const c = t;
    o + c.lat > Je && (c.lat = Je - o);
    r + c.lat > Ge && (c.lat = Ge - r);
    n + c.lat < Be && (c.lat = Be - n);
    i + c.lat < Ve && (c.lat = Ve - i);
    s + c.lng <= $e && (c.lng += Math.ceil(Math.abs(c.lng) / 360) * 360);
    a + c.lng >= je && (c.lng -= Math.ceil(Math.abs(c.lng) / 360) * 360);
    return c;
}
function Xe(e, t) {
    const o = He(
        e.map((e) => e.toGeoJSON()),
        t
    );
    e.forEach((e) => {
        const t = e.getCoordinates();
        const n = (e) => {
            const t = { lng: e[0] + o.lng, lat: e[1] + o.lat };
            return [t.lng, t.lat];
        };
        const r = (e) => e.map((e) => n(e));
        const i = (e) => e.map((e) => r(e));
        let s;
        e.type === d.POINT
            ? (s = n(t))
            : e.type === d.LINE_STRING || e.type === d.MULTI_POINT
              ? (s = t.map(n))
              : e.type === d.POLYGON || e.type === d.MULTI_LINE_STRING
                ? (s = t.map(r))
                : e.type === d.MULTI_POLYGON && (s = t.map(i));
        e.incomingCoords(s);
    });
}
const Ke = {};
Ke.onSetup = function (e) {
    const t = {
        dragMoveLocation: null,
        boxSelectStartLocation: null,
        boxSelectElement: void 0,
        boxSelecting: false,
        canBoxSelect: false,
        dragMoving: false,
        canDragMove: false,
        initialDragPanState: this.map.dragPan.isEnabled(),
        initiallySelectedFeatureIds: e.featureIds || [],
    };
    this.setSelected(t.initiallySelectedFeatureIds.filter((e) => this.getFeature(e) !== void 0));
    this.fireActionable();
    this.setActionableState({ combineFeatures: true, uncombineFeatures: true, trash: true });
    return t;
};
Ke.fireUpdate = function () {
    this.fire(h.UPDATE, { action: f.MOVE, features: this.getSelected().map((e) => e.toGeoJSON()) });
};
Ke.fireActionable = function () {
    const e = this.getSelected();
    const t = e.filter((e) => this.isInstanceOf("MultiFeature", e));
    let o = false;
    if (e.length > 1) {
        o = true;
        const t = e[0].type.replace("Multi", "");
        e.forEach((e) => {
            e.type.replace("Multi", "") !== t && (o = false);
        });
    }
    const n = t.length > 0;
    const r = e.length > 0;
    this.setActionableState({ combineFeatures: o, uncombineFeatures: n, trash: r });
};
Ke.getUniqueIds = function (e) {
    if (!e.length) return [];
    const t = e
        .map((e) => e.properties.id)
        .filter((e) => e !== void 0)
        .reduce((e, t) => {
            e.add(t);
            return e;
        }, new X());
    return t.values();
};
Ke.stopExtendedInteractions = function (e) {
    if (e.boxSelectElement) {
        e.boxSelectElement.parentNode && e.boxSelectElement.parentNode.removeChild(e.boxSelectElement);
        e.boxSelectElement = null;
    }
    (e.canDragMove || e.canBoxSelect) && e.initialDragPanState === true && this.map.dragPan.enable();
    e.boxSelecting = false;
    e.canBoxSelect = false;
    e.dragMoving = false;
    e.canDragMove = false;
};
Ke.onStop = function () {
    ke.enable(this);
};
Ke.onMouseMove = function (e, t) {
    const o = A(t);
    o && e.dragMoving && this.fireUpdate();
    this.stopExtendedInteractions(e);
    return true;
};
Ke.onMouseOut = function (e) {
    return !e.dragMoving || this.fireUpdate();
};
Ke.onTap = Ke.onClick = function (e, t) {
    return b(t)
        ? this.clickAnywhere(e, t)
        : O(g.VERTEX)(t)
          ? this.clickOnVertex(e, t)
          : A(t)
            ? this.clickOnFeature(e, t)
            : void 0;
};
Ke.clickAnywhere = function (e) {
    const t = this.getSelectedIds();
    if (t.length) {
        this.clearSelectedFeatures();
        t.forEach((e) => this.doRender(e));
    }
    ke.enable(this);
    this.stopExtendedInteractions(e);
};
Ke.clickOnVertex = function (e, t) {
    this.changeMode(p.DIRECT_SELECT, {
        featureId: t.featureTarget.properties.parent,
        coordPath: t.featureTarget.properties.coord_path,
        startPos: t.lngLat,
    });
    this.updateUIClasses({ mouse: u.MOVE });
};
Ke.startOnActiveFeature = function (e, t) {
    this.stopExtendedInteractions(e);
    this.map.dragPan.disable();
    this.doRender(t.featureTarget.properties.id);
    e.canDragMove = true;
    e.dragMoveLocation = t.lngLat;
};
Ke.clickOnFeature = function (e, t) {
    ke.disable(this);
    this.stopExtendedInteractions(e);
    const o = F(t);
    const n = this.getSelectedIds();
    const r = t.featureTarget.properties.id;
    const i = this.isSelected(r);
    if (!o && i && this.getFeature(r).type !== d.POINT) return this.changeMode(p.DIRECT_SELECT, { featureId: r });
    if (i && o) {
        this.deselect(r);
        this.updateUIClasses({ mouse: u.POINTER });
        n.length === 1 && ke.enable(this);
    } else if (!i && o) {
        this.select(r);
        this.updateUIClasses({ mouse: u.MOVE });
    } else if (!i && !o) {
        n.forEach((e) => this.doRender(e));
        this.setSelected(r);
        this.updateUIClasses({ mouse: u.MOVE });
    }
    this.doRender(r);
};
Ke.onMouseDown = function (e, t) {
    e.initialDragPanState = this.map.dragPan.isEnabled();
    return L(t)
        ? this.startOnActiveFeature(e, t)
        : this.drawConfig.boxSelect && N(t)
          ? this.startBoxSelect(e, t)
          : void 0;
};
Ke.startBoxSelect = function (e, t) {
    this.stopExtendedInteractions(e);
    this.map.dragPan.disable();
    e.boxSelectStartLocation = Re(t.originalEvent, this.map.getContainer());
    e.canBoxSelect = true;
};
Ke.onTouchStart = function (e, t) {
    if (L(t)) return this.startOnActiveFeature(e, t);
};
Ke.onDrag = function (e, t) {
    return e.canDragMove
        ? this.dragMove(e, t)
        : this.drawConfig.boxSelect && e.canBoxSelect
          ? this.whileBoxSelect(e, t)
          : void 0;
};
Ke.whileBoxSelect = function (e, t) {
    e.boxSelecting = true;
    this.updateUIClasses({ mouse: u.ADD });
    if (!e.boxSelectElement) {
        e.boxSelectElement = document.createElement("div");
        e.boxSelectElement.classList.add(a.BOX_SELECT);
        this.map.getContainer().appendChild(e.boxSelectElement);
    }
    const o = Re(t.originalEvent, this.map.getContainer());
    const n = Math.min(e.boxSelectStartLocation.x, o.x);
    const r = Math.max(e.boxSelectStartLocation.x, o.x);
    const i = Math.min(e.boxSelectStartLocation.y, o.y);
    const s = Math.max(e.boxSelectStartLocation.y, o.y);
    const c = `translate(${n}px, ${i}px)`;
    e.boxSelectElement.style.transform = c;
    e.boxSelectElement.style.WebkitTransform = c;
    e.boxSelectElement.style.width = r - n + "px";
    e.boxSelectElement.style.height = s - i + "px";
};
Ke.dragMove = function (e, t) {
    e.dragMoving = true;
    t.originalEvent.stopPropagation();
    const o = { lng: t.lngLat.lng - e.dragMoveLocation.lng, lat: t.lngLat.lat - e.dragMoveLocation.lat };
    Xe(this.getSelected(), o);
    e.dragMoveLocation = t.lngLat;
};
Ke.onTouchEnd = Ke.onMouseUp = function (e, t) {
    if (e.dragMoving) this.fireUpdate();
    else if (e.boxSelecting) {
        const o = [e.boxSelectStartLocation, Re(t.originalEvent, this.map.getContainer())];
        const n = this.featuresAt(null, o, "click");
        const r = this.getUniqueIds(n).filter((e) => !this.isSelected(e));
        if (r.length) {
            this.select(r);
            r.forEach((e) => this.doRender(e));
            this.updateUIClasses({ mouse: u.MOVE });
        }
    }
    this.stopExtendedInteractions(e);
};
Ke.toDisplayFeatures = function (e, t, o) {
    t.properties.active = this.isSelected(t.properties.id) ? m.ACTIVE : m.INACTIVE;
    o(t);
    this.fireActionable();
    t.properties.active === m.ACTIVE && t.geometry.type !== d.POINT && Ue(t).forEach(o);
};
Ke.onTrash = function () {
    this.deleteFeature(this.getSelectedIds());
    this.fireActionable();
};
Ke.onCombineFeatures = function () {
    const e = this.getSelected();
    if (e.length === 0 || e.length < 2) return;
    const t = [],
        o = [];
    const n = e[0].type.replace("Multi", "");
    for (let r = 0; r < e.length; r++) {
        const i = e[r];
        if (i.type.replace("Multi", "") !== n) return;
        i.type.includes("Multi")
            ? i.getCoordinates().forEach((e) => {
                  t.push(e);
              })
            : t.push(i.getCoordinates());
        o.push(i.toGeoJSON());
    }
    if (o.length > 1) {
        const e = this.newFeature({
            type: d.FEATURE,
            properties: o[0].properties,
            geometry: { type: `Multi${n}`, coordinates: t },
        });
        this.addFeature(e);
        this.deleteFeature(this.getSelectedIds(), { silent: true });
        this.setSelected([e.id]);
        this.fire(h.COMBINE_FEATURES, { createdFeatures: [e.toGeoJSON()], deletedFeatures: o });
    }
    this.fireActionable();
};
Ke.onUncombineFeatures = function () {
    const e = this.getSelected();
    if (e.length === 0) return;
    const t = [];
    const o = [];
    for (let n = 0; n < e.length; n++) {
        const r = e[n];
        if (this.isInstanceOf("MultiFeature", r)) {
            r.getFeatures().forEach((e) => {
                this.addFeature(e);
                e.properties = r.properties;
                t.push(e.toGeoJSON());
                this.select([e.id]);
            });
            this.deleteFeature(r.id, { silent: true });
            o.push(r.toGeoJSON());
        }
    }
    t.length > 1 && this.fire(h.UNCOMBINE_FEATURES, { createdFeatures: t, deletedFeatures: o });
    this.fireActionable();
};
const Ze = O(g.VERTEX);
const qe = O(g.MIDPOINT);
const We = {};
We.fireUpdate = function () {
    this.fire(h.UPDATE, { action: f.CHANGE_COORDINATES, features: this.getSelected().map((e) => e.toGeoJSON()) });
};
We.fireActionable = function (e) {
    this.setActionableState({
        combineFeatures: false,
        uncombineFeatures: false,
        trash: e.selectedCoordPaths.length > 0,
    });
};
We.startDragging = function (e, t) {
    e.initialDragPanState == null && (e.initialDragPanState = this.map.dragPan.isEnabled());
    this.map.dragPan.disable();
    e.canDragMove = true;
    e.dragMoveLocation = t.lngLat;
};
We.stopDragging = function (e) {
    e.canDragMove && e.initialDragPanState === true && this.map.dragPan.enable();
    e.initialDragPanState = null;
    e.dragMoving = false;
    e.canDragMove = false;
    e.dragMoveLocation = null;
};
We.onVertex = function (e, t) {
    this.startDragging(e, t);
    const o = t.featureTarget.properties;
    const n = e.selectedCoordPaths.indexOf(o.coord_path);
    F(t) || n !== -1
        ? F(t) && n === -1 && e.selectedCoordPaths.push(o.coord_path)
        : (e.selectedCoordPaths = [o.coord_path]);
    const r = this.pathsToCoordinates(e.featureId, e.selectedCoordPaths);
    this.setSelectedCoordinates(r);
};
We.onMidpoint = function (e, t) {
    this.startDragging(e, t);
    const o = t.featureTarget.properties;
    e.feature.addCoordinate(o.coord_path, o.lng, o.lat);
    this.fireUpdate();
    e.selectedCoordPaths = [o.coord_path];
};
We.pathsToCoordinates = function (e, t) {
    return t.map((t) => ({ feature_id: e, coord_path: t }));
};
We.onFeature = function (e, t) {
    e.selectedCoordPaths.length === 0 ? this.startDragging(e, t) : this.stopDragging(e);
};
We.dragFeature = function (e, t, o) {
    Xe(this.getSelected(), o);
    e.dragMoveLocation = t.lngLat;
};
We.dragVertex = function (e, t, o) {
    const n = e.selectedCoordPaths.map((t) => e.feature.getCoordinate(t));
    const r = n.map((e) => ({ type: d.FEATURE, properties: {}, geometry: { type: d.POINT, coordinates: e } }));
    const i = He(r, o);
    for (let t = 0; t < n.length; t++) {
        const o = n[t];
        e.feature.updateCoordinate(e.selectedCoordPaths[t], o[0] + i.lng, o[1] + i.lat);
    }
};
We.clickNoTarget = function () {
    this.changeMode(p.SIMPLE_SELECT);
};
We.clickInactive = function () {
    this.changeMode(p.SIMPLE_SELECT);
};
We.clickActiveFeature = function (e) {
    e.selectedCoordPaths = [];
    this.clearSelectedCoordinates();
    e.feature.changed();
};
We.onSetup = function (e) {
    const t = e.featureId;
    const o = this.getFeature(t);
    if (!o) throw new Error("You must provide a featureId to enter direct_select mode");
    if (o.type === d.POINT) throw new TypeError("direct_select mode doesn't handle point features");
    const n = {
        featureId: t,
        feature: o,
        dragMoveLocation: e.startPos || null,
        dragMoving: false,
        canDragMove: false,
        selectedCoordPaths: e.coordPath ? [e.coordPath] : [],
    };
    this.setSelectedCoordinates(this.pathsToCoordinates(t, n.selectedCoordPaths));
    this.setSelected(t);
    ke.disable(this);
    this.setActionableState({ trash: true });
    return n;
};
We.onStop = function () {
    ke.enable(this);
    this.clearSelectedCoordinates();
};
We.toDisplayFeatures = function (e, t, o) {
    if (e.featureId === t.properties.id) {
        t.properties.active = m.ACTIVE;
        o(t);
        Ue(t, { map: this.map, midpoints: true, selectedPaths: e.selectedCoordPaths }).forEach(o);
    } else {
        t.properties.active = m.INACTIVE;
        o(t);
    }
    this.fireActionable(e);
};
We.onTrash = function (e) {
    e.selectedCoordPaths
        .sort((e, t) => t.localeCompare(e, "en", { numeric: true }))
        .forEach((t) => e.feature.removeCoordinate(t));
    this.fireUpdate();
    e.selectedCoordPaths = [];
    this.clearSelectedCoordinates();
    this.fireActionable(e);
    if (e.feature.isValid() === false) {
        this.deleteFeature([e.featureId]);
        this.changeMode(p.SIMPLE_SELECT, {});
    }
};
We.onMouseMove = function (e, t) {
    const o = L(t);
    const n = Ze(t);
    const r = qe(t);
    const i = e.selectedCoordPaths.length === 0;
    (o && i) || (n && !i) ? this.updateUIClasses({ mouse: u.MOVE }) : this.updateUIClasses({ mouse: u.NONE });
    const s = n || o || r;
    s && e.dragMoving && this.fireUpdate();
    this.stopDragging(e);
    return true;
};
We.onMouseOut = function (e) {
    e.dragMoving && this.fireUpdate();
    return true;
};
We.onTouchStart = We.onMouseDown = function (e, t) {
    return Ze(t) ? this.onVertex(e, t) : L(t) ? this.onFeature(e, t) : qe(t) ? this.onMidpoint(e, t) : void 0;
};
We.onDrag = function (e, t) {
    if (e.canDragMove !== true) return;
    e.dragMoving = true;
    t.originalEvent.stopPropagation();
    const o = { lng: t.lngLat.lng - e.dragMoveLocation.lng, lat: t.lngLat.lat - e.dragMoveLocation.lat };
    e.selectedCoordPaths.length > 0 ? this.dragVertex(e, t, o) : this.dragFeature(e, t, o);
    e.dragMoveLocation = t.lngLat;
};
We.onClick = function (e, t) {
    if (b(t)) return this.clickNoTarget(e, t);
    if (L(t)) return this.clickActiveFeature(e, t);
    if (M(t)) return this.clickInactive(e, t);
    this.stopDragging(e);
};
We.onTap = function (e, t) {
    return b(t)
        ? this.clickNoTarget(e, t)
        : L(t)
          ? this.clickActiveFeature(e, t)
          : M(t)
            ? this.clickInactive(e, t)
            : void 0;
};
We.onTouchEnd = We.onMouseUp = function (e) {
    e.dragMoving && this.fireUpdate();
    this.stopDragging(e);
};
const ze = {};
ze.onSetup = function () {
    const e = this.newFeature({ type: d.FEATURE, properties: {}, geometry: { type: d.POINT, coordinates: [] } });
    this.addFeature(e);
    this.clearSelectedFeatures();
    this.updateUIClasses({ mouse: u.ADD });
    this.activateUIButton(l.POINT);
    this.setActionableState({ trash: true });
    return { point: e };
};
ze.stopDrawingAndRemove = function (e) {
    this.deleteFeature([e.point.id], { silent: true });
    this.changeMode(p.SIMPLE_SELECT);
};
ze.onTap = ze.onClick = function (e, t) {
    this.updateUIClasses({ mouse: u.MOVE });
    e.point.updateCoordinate("", t.lngLat.lng, t.lngLat.lat);
    this.fire(h.CREATE, { features: [e.point.toGeoJSON()] });
    this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.point.id] });
};
ze.onStop = function (e) {
    this.activateUIButton();
    e.point.getCoordinate().length || this.deleteFeature([e.point.id], { silent: true });
};
ze.toDisplayFeatures = function (e, t, o) {
    const n = t.properties.id === e.point.id;
    t.properties.active = n ? m.ACTIVE : m.INACTIVE;
    if (!n) return o(t);
};
ze.onTrash = ze.stopDrawingAndRemove;
ze.onKeyUp = function (e, t) {
    if (x(t) || R(t)) return this.stopDrawingAndRemove(e, t);
};
function Qe(e, t) {
    return !!e.lngLat && e.lngLat.lng === t[0] && e.lngLat.lat === t[1];
}
const et = {};
et.onSetup = function () {
    const e = this.newFeature({ type: d.FEATURE, properties: {}, geometry: { type: d.POLYGON, coordinates: [[]] } });
    this.addFeature(e);
    this.clearSelectedFeatures();
    ke.disable(this);
    this.updateUIClasses({ mouse: u.ADD });
    this.activateUIButton(l.POLYGON);
    this.setActionableState({ trash: true });
    return { polygon: e, currentVertexPosition: 0 };
};
et.clickAnywhere = function (e, t) {
    if (e.currentVertexPosition > 0 && Qe(t, e.polygon.coordinates[0][e.currentVertexPosition - 1]))
        return this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
    this.updateUIClasses({ mouse: u.ADD });
    e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat);
    e.currentVertexPosition++;
    e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat);
};
et.clickOnVertex = function (e) {
    return this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
};
et.onMouseMove = function (e, t) {
    e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat);
    P(t) && this.updateUIClasses({ mouse: u.POINTER });
};
et.onTap = et.onClick = function (e, t) {
    return P(t) ? this.clickOnVertex(e, t) : this.clickAnywhere(e, t);
};
et.onKeyUp = function (e, t) {
    if (x(t)) {
        this.deleteFeature([e.polygon.id], { silent: true });
        this.changeMode(p.SIMPLE_SELECT);
    } else R(t) && this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
};
et.onStop = function (e) {
    this.updateUIClasses({ mouse: u.NONE });
    ke.enable(this);
    this.activateUIButton();
    if (this.getFeature(e.polygon.id) !== void 0) {
        e.polygon.removeCoordinate(`0.${e.currentVertexPosition}`);
        if (e.polygon.isValid()) this.fire(h.CREATE, { features: [e.polygon.toGeoJSON()] });
        else {
            this.deleteFeature([e.polygon.id], { silent: true });
            this.changeMode(p.SIMPLE_SELECT, {}, { silent: true });
        }
    }
};
et.toDisplayFeatures = function (e, t, o) {
    const n = t.properties.id === e.polygon.id;
    t.properties.active = n ? m.ACTIVE : m.INACTIVE;
    if (!n) return o(t);
    if (t.geometry.coordinates.length === 0) return;
    const r = t.geometry.coordinates[0].length;
    if (!(r < 3)) {
        t.properties.meta = g.FEATURE;
        o(De(e.polygon.id, t.geometry.coordinates[0][0], "0.0", false));
        if (r > 3) {
            const n = t.geometry.coordinates[0].length - 3;
            o(De(e.polygon.id, t.geometry.coordinates[0][n], `0.${n}`, false));
        }
        if (r <= 4) {
            const e = [
                [t.geometry.coordinates[0][0][0], t.geometry.coordinates[0][0][1]],
                [t.geometry.coordinates[0][1][0], t.geometry.coordinates[0][1][1]],
            ];
            o({ type: d.FEATURE, properties: t.properties, geometry: { coordinates: e, type: d.LINE_STRING } });
            if (r === 3) return;
        }
        return o(t);
    }
};
et.onTrash = function (e) {
    this.deleteFeature([e.polygon.id], { silent: true });
    this.changeMode(p.SIMPLE_SELECT);
};
const tt = {};
tt.onSetup = function (e) {
    e = e || {};
    const t = e.featureId;
    let o, n;
    let r = "forward";
    if (t) {
        o = this.getFeature(t);
        if (!o) throw new Error("Could not find a feature with the provided featureId");
        let i = e.from;
        i && i.type === "Feature" && i.geometry && i.geometry.type === "Point" && (i = i.geometry);
        i && i.type === "Point" && i.coordinates && i.coordinates.length === 2 && (i = i.coordinates);
        if (!i || !Array.isArray(i))
            throw new Error("Please use the `from` property to indicate which point to continue the line from");
        const s = o.coordinates.length - 1;
        if (o.coordinates[s][0] === i[0] && o.coordinates[s][1] === i[1]) {
            n = s + 1;
            o.addCoordinate(n, ...o.coordinates[s]);
        } else {
            if (o.coordinates[0][0] !== i[0] || o.coordinates[0][1] !== i[1])
                throw new Error(
                    "`from` should match the point at either the start or the end of the provided LineString"
                );
            r = "backwards";
            n = 0;
            o.addCoordinate(n, ...o.coordinates[0]);
        }
    } else {
        o = this.newFeature({ type: d.FEATURE, properties: {}, geometry: { type: d.LINE_STRING, coordinates: [] } });
        n = 0;
        this.addFeature(o);
    }
    this.clearSelectedFeatures();
    ke.disable(this);
    this.updateUIClasses({ mouse: u.ADD });
    this.activateUIButton(l.LINE);
    this.setActionableState({ trash: true });
    return { line: o, currentVertexPosition: n, direction: r };
};
tt.clickAnywhere = function (e, t) {
    if (
        (e.currentVertexPosition > 0 && Qe(t, e.line.coordinates[e.currentVertexPosition - 1])) ||
        (e.direction === "backwards" && Qe(t, e.line.coordinates[e.currentVertexPosition + 1]))
    )
        return this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.line.id] });
    this.updateUIClasses({ mouse: u.ADD });
    e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat);
    if (e.direction === "forward") {
        e.currentVertexPosition++;
        e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat);
    } else e.line.addCoordinate(0, t.lngLat.lng, t.lngLat.lat);
};
tt.clickOnVertex = function (e) {
    return this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.line.id] });
};
tt.onMouseMove = function (e, t) {
    e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat);
    P(t) && this.updateUIClasses({ mouse: u.POINTER });
};
tt.onTap = tt.onClick = function (e, t) {
    if (P(t)) return this.clickOnVertex(e, t);
    this.clickAnywhere(e, t);
};
tt.onKeyUp = function (e, t) {
    if (R(t)) this.changeMode(p.SIMPLE_SELECT, { featureIds: [e.line.id] });
    else if (x(t)) {
        this.deleteFeature([e.line.id], { silent: true });
        this.changeMode(p.SIMPLE_SELECT);
    }
};
tt.onStop = function (e) {
    ke.enable(this);
    this.activateUIButton();
    if (this.getFeature(e.line.id) !== void 0) {
        e.line.removeCoordinate(`${e.currentVertexPosition}`);
        if (e.line.isValid()) this.fire(h.CREATE, { features: [e.line.toGeoJSON()] });
        else {
            this.deleteFeature([e.line.id], { silent: true });
            this.changeMode(p.SIMPLE_SELECT, {}, { silent: true });
        }
    }
};
tt.onTrash = function (e) {
    this.deleteFeature([e.line.id], { silent: true });
    this.changeMode(p.SIMPLE_SELECT);
};
tt.toDisplayFeatures = function (e, t, o) {
    const n = t.properties.id === e.line.id;
    t.properties.active = n ? m.ACTIVE : m.INACTIVE;
    if (!n) return o(t);
    if (!(t.geometry.coordinates.length < 2)) {
        t.properties.meta = g.FEATURE;
        o(
            De(
                e.line.id,
                t.geometry.coordinates[e.direction === "forward" ? t.geometry.coordinates.length - 2 : 1],
                "" + (e.direction === "forward" ? t.geometry.coordinates.length - 2 : 1),
                false
            )
        );
        o(t);
    }
};
var ot = { simple_select: Ke, direct_select: We, draw_point: ze, draw_polygon: et, draw_line_string: tt };
const nt = {
    defaultMode: p.SIMPLE_SELECT,
    keybindings: true,
    touchEnabled: true,
    clickBuffer: 2,
    touchBuffer: 25,
    boxSelect: true,
    displayControlsDefault: true,
    styles: xe,
    modes: ot,
    controls: {},
    userProperties: false,
    suppressAPIEvents: true,
};
const rt = {
    point: true,
    line_string: true,
    polygon: true,
    trash: true,
    combine_features: true,
    uncombine_features: true,
};
const it = {
    point: false,
    line_string: false,
    polygon: false,
    trash: false,
    combine_features: false,
    uncombine_features: false,
};
function st(e, t) {
    return e.map((e) =>
        e.source ? e : Object.assign({}, e, { id: `${e.id}.${t}`, source: t === "hot" ? c.HOT : c.COLD })
    );
}
function at(e = {}) {
    let t = Object.assign({}, e);
    e.controls || (t.controls = {});
    e.displayControlsDefault === false
        ? (t.controls = Object.assign({}, it, e.controls))
        : (t.controls = Object.assign({}, rt, e.controls));
    t = Object.assign({}, nt, t);
    t.styles = st(t.styles, "cold").concat(st(t.styles, "hot"));
    return t;
}
function ct(e, t) {
    return e.length === t.length && JSON.stringify(e.map((e) => e).sort()) === JSON.stringify(t.map((e) => e).sort());
}
const ut = { Polygon: fe, LineString: he, Point: pe, MultiPolygon: ye, MultiLineString: ye, MultiPoint: ye };
function lt(e, t) {
    t.modes = p;
    const o = e.options.suppressAPIEvents === void 0 || !!e.options.suppressAPIEvents;
    t.getFeatureIdsAt = function (t) {
        const o = Z.click({ point: t }, null, e);
        return o.map((e) => e.properties.id);
    };
    t.getSelectedIds = function () {
        return e.store.getSelectedIds();
    };
    t.getSelected = function () {
        return {
            type: d.FEATURE_COLLECTION,
            features: e.store
                .getSelectedIds()
                .map((t) => e.store.get(t))
                .map((e) => e.toGeoJSON()),
        };
    };
    t.getSelectedPoints = function () {
        return {
            type: d.FEATURE_COLLECTION,
            features: e.store
                .getSelectedCoordinates()
                .map((e) => ({
                    type: d.FEATURE,
                    properties: {},
                    geometry: { type: d.POINT, coordinates: e.coordinates },
                })),
        };
    };
    t.set = function (o) {
        if (o.type === void 0 || o.type !== d.FEATURE_COLLECTION || !Array.isArray(o.features))
            throw new Error("Invalid FeatureCollection");
        const n = e.store.createRenderBatch();
        let r = e.store.getAllIds().slice();
        const i = t.add(o);
        const s = new X(i);
        r = r.filter((e) => !s.has(e));
        r.length && t.delete(r);
        n();
        return i;
    };
    t.add = function (t) {
        const n = JSON.parse(JSON.stringify(s(t)));
        const r = n.features.map((t) => {
            t.id = t.id || le();
            if (t.geometry === null) throw new Error("Invalid geometry: null");
            if (e.store.get(t.id) === void 0 || e.store.get(t.id).type !== t.geometry.type) {
                const n = ut[t.geometry.type];
                if (n === void 0) throw new Error(`Invalid geometry type: ${t.geometry.type}.`);
                const r = new n(e, t);
                e.store.add(r, { silent: o });
            } else {
                const n = e.store.get(t.id);
                const r = n.properties;
                n.properties = t.properties;
                i(r, t.properties) || e.store.featureChanged(n.id, { silent: o });
                i(n.getCoordinates(), t.geometry.coordinates) || n.incomingCoords(t.geometry.coordinates);
            }
            return t.id;
        });
        e.store.render();
        return r;
    };
    t.get = function (t) {
        const o = e.store.get(t);
        if (o) return o.toGeoJSON();
    };
    t.getAll = function () {
        return { type: d.FEATURE_COLLECTION, features: e.store.getAll().map((e) => e.toGeoJSON()) };
    };
    t.delete = function (n) {
        e.store.delete(n, { silent: o });
        t.getMode() !== p.DIRECT_SELECT || e.store.getSelectedIds().length
            ? e.store.render()
            : e.events.changeMode(p.SIMPLE_SELECT, void 0, { silent: o });
        return t;
    };
    t.deleteAll = function () {
        e.store.delete(e.store.getAllIds(), { silent: o });
        t.getMode() === p.DIRECT_SELECT
            ? e.events.changeMode(p.SIMPLE_SELECT, void 0, { silent: o })
            : e.store.render();
        return t;
    };
    t.changeMode = function (n, r = {}) {
        if (n === p.SIMPLE_SELECT && t.getMode() === p.SIMPLE_SELECT) {
            if (ct(r.featureIds || [], e.store.getSelectedIds())) return t;
            e.store.setSelected(r.featureIds, { silent: o });
            e.store.render();
            return t;
        }
        if (n === p.DIRECT_SELECT && t.getMode() === p.DIRECT_SELECT && r.featureId === e.store.getSelectedIds()[0])
            return t;
        e.events.changeMode(n, r, { silent: o });
        return t;
    };
    t.getMode = function () {
        return e.events.getMode();
    };
    t.trash = function () {
        e.events.trash({ silent: o });
        return t;
    };
    t.combineFeatures = function () {
        e.events.combineFeatures({ silent: o });
        return t;
    };
    t.uncombineFeatures = function () {
        e.events.uncombineFeatures({ silent: o });
        return t;
    };
    t.setFeatureProperty = function (n, r, i) {
        e.store.setFeatureProperty(n, r, i, { silent: o });
        return t;
    };
    return t;
}
var dt = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            CommonSelectors: J,
            ModeHandler: ce,
            StringSet: X,
            constrainFeatureMovement: He,
            createMidPoint: we,
            createSupplementaryPoints: Ue,
            createVertex: De,
            doubleClickZoom: ke,
            euclideanDistance: ee,
            featuresAt: Z,
            getFeatureAtAndSetCursors: Q,
            isClick: re,
            isEventAtCoordinates: Qe,
            isTap: ae,
            mapEventToBoundingBox: H,
            moveFeatures: Xe,
            sortFeatures: Y,
            stringSetsAreEqual: ct,
            theme: xe,
            toDenseArray: _e,
        },
        Symbol.toStringTag,
        { value: "Module" }
    )
);
const pt = function (e, t) {
    e = at(e);
    const o = { options: e };
    t = lt(o, t);
    o.api = t;
    const n = be(o);
    t.onAdd = n.onAdd;
    t.onRemove = n.onRemove;
    t.types = l;
    t.options = e;
    return t;
};
function ht(e) {
    pt(e, this);
}
ht.modes = ot;
ht.constants = v;
ht.lib = dt;
export { ht as default };
//# sourceMappingURL=index.js.map
