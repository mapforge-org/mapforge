// @mapbox/mapbox-gl-draw@1.5.0 downloaded from https://ga.jspm.io/npm:@mapbox/mapbox-gl-draw@1.5.0/index.js

import e from "@mapbox/geojson-area";
import { customAlphabet as t } from "nanoid/non-secure";
import o from "@mapbox/point-geometry";
import n from "fast-deep-equal";
import r from "@mapbox/geojson-normalize";
const ModeHandler = function (e, t) {
    const o = { drag: [], click: [], mousemove: [], mousedown: [], mouseup: [], mouseout: [], keydown: [], keyup: [], touchstart: [], touchmove: [], touchend: [], tap: [] };
    const n = {
        on(e, t, n) {
            if (o[e] === void 0) throw new Error(`Invalid event type: ${e}`);
            o[e].push({ selector: t, fn: n });
        },
        render(e) {
            t.store.featureChanged(e);
        },
    };
    const delegate = function (e, r) {
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
            delegate("drag", e);
        },
        click(e) {
            delegate("click", e);
        },
        mousemove(e) {
            delegate("mousemove", e);
        },
        mousedown(e) {
            delegate("mousedown", e);
        },
        mouseup(e) {
            delegate("mouseup", e);
        },
        mouseout(e) {
            delegate("mouseout", e);
        },
        keydown(e) {
            delegate("keydown", e);
        },
        keyup(e) {
            delegate("keyup", e);
        },
        touchstart(e) {
            delegate("touchstart", e);
        },
        touchmove(e) {
            delegate("touchmove", e);
        },
        touchend(e) {
            delegate("touchend", e);
        },
        tap(e) {
            delegate("tap", e);
        },
    };
};
const i = {
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
const s = { HOT: "mapbox-gl-draw-hot", COLD: "mapbox-gl-draw-cold" };
const a = { ADD: "add", MOVE: "move", DRAG: "drag", POINTER: "pointer", NONE: "none" };
const c = { POLYGON: "polygon", LINE: "line_string", POINT: "point" };
const u = {
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
const l = { DRAW_LINE_STRING: "draw_line_string", DRAW_POLYGON: "draw_polygon", DRAW_POINT: "draw_point", SIMPLE_SELECT: "simple_select", DIRECT_SELECT: "direct_select" };
const d = {
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
const p = { MOVE: "move", CHANGE_PROPERTIES: "change_properties", CHANGE_COORDINATES: "change_coordinates" };
const h = { FEATURE: "feature", MIDPOINT: "midpoint", VERTEX: "vertex" };
const f = { ACTIVE: "true", INACTIVE: "false" };
const g = ["scrollZoom", "boxZoom", "dragRotate", "dragPan", "keyboard", "doubleClickZoom", "touchZoomRotate"];
const m = -90;
const y = -85;
const E = 90;
const S = 85;
const C = -270;
const I = 270;
var T = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            LAT_MAX: E,
            LAT_MIN: m,
            LAT_RENDERED_MAX: S,
            LAT_RENDERED_MIN: y,
            LNG_MAX: I,
            LNG_MIN: C,
            activeStates: f,
            classes: i,
            cursors: a,
            events: d,
            geojsonTypes: u,
            interactions: g,
            meta: h,
            modes: l,
            sources: s,
            types: c,
            updateActions: p,
        },
        Symbol.toStringTag,
        { value: "Module" }
    )
);
const v = { Point: 0, LineString: 1, MultiLineString: 1, Polygon: 2 };
function comparator(e, t) {
    const o = v[e.geometry.type] - v[t.geometry.type];
    return o === 0 && e.geometry.type === u.POLYGON ? e.area - t.area : o;
}
function sortFeatures(t) {
    return t
        .map((t) => {
            t.geometry.type === u.POLYGON && (t.area = e.geometry({ type: u.FEATURE, property: {}, geometry: t.geometry }));
            return t;
        })
        .sort(comparator)
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
 */ function mapEventToBoundingBox(e, t = 0) {
    return [
        [e.point.x - t, e.point.y - t],
        [e.point.x + t, e.point.y + t],
    ];
}
function StringSet(e) {
    this._items = {};
    this._nums = {};
    this._length = e ? e.length : 0;
    if (e)
        for (let t = 0, o = e.length; t < o; t++) {
            this.add(e[t]);
            e[t] !== void 0 && (typeof e[t] === "string" ? (this._items[e[t]] = t) : (this._nums[e[t]] = t));
        }
}
StringSet.prototype.add = function (e) {
    if (this.has(e)) return this;
    this._length++;
    typeof e === "string" ? (this._items[e] = this._length) : (this._nums[e] = this._length);
    return this;
};
StringSet.prototype.delete = function (e) {
    if (this.has(e) === false) return this;
    this._length--;
    delete this._items[e];
    delete this._nums[e];
    return this;
};
StringSet.prototype.has = function (e) {
    return (typeof e === "string" || typeof e === "number") && (this._items[e] !== void 0 || this._nums[e] !== void 0);
};
StringSet.prototype.values = function () {
    const e = [];
    Object.keys(this._items).forEach((t) => {
        e.push({ k: t, v: this._items[t] });
    });
    Object.keys(this._nums).forEach((t) => {
        e.push({ k: JSON.parse(t), v: this._nums[t] });
    });
    return e.sort((e, t) => e.v - t.v).map((e) => e.k);
};
StringSet.prototype.clear = function () {
    this._length = 0;
    this._items = {};
    this._nums = {};
    return this;
};
const _ = [h.FEATURE, h.MIDPOINT, h.VERTEX];
var M = { click: featuresAtClick, touch: featuresAtTouch };
function featuresAtClick(e, t, o) {
    return featuresAt$1(e, t, o, o.options.clickBuffer);
}
function featuresAtTouch(e, t, o) {
    return featuresAt$1(e, t, o, o.options.touchBuffer);
}
function featuresAt$1(e, t, o, n) {
    if (o.map === null) return [];
    const r = e ? mapEventToBoundingBox(e, n) : t;
    const i = {};
    o.options.styles && (i.layers = o.options.styles.map((e) => e.id).filter((e) => o.map.getLayer(e) != null));
    const s = o.map.queryRenderedFeatures(r, i).filter((e) => _.indexOf(e.properties.meta) !== -1);
    const a = new StringSet();
    const c = [];
    s.forEach((e) => {
        const t = e.properties.id;
        if (!a.has(t)) {
            a.add(t);
            c.push(e);
        }
    });
    return sortFeatures(c);
}
function getFeatureAtAndSetCursors(e, t) {
    const o = M.click(e, null, t);
    const n = { mouse: a.NONE };
    if (o[0]) {
        n.mouse = o[0].properties.active === f.ACTIVE ? a.MOVE : a.POINTER;
        n.feature = o[0].properties.meta;
    }
    t.events.currentModeName().indexOf("draw") !== -1 && (n.mouse = a.ADD);
    t.ui.queueMapClasses(n);
    t.ui.updateMapClasses();
    return o[0];
}
function euclideanDistance(e, t) {
    const o = e.x - t.x;
    const n = e.y - t.y;
    return Math.sqrt(o * o + n * n);
}
const O = 4;
const L = 12;
const N = 500;
function isClick(e, t, o = {}) {
    const n = o.fineTolerance != null ? o.fineTolerance : O;
    const r = o.grossTolerance != null ? o.grossTolerance : L;
    const i = o.interval != null ? o.interval : N;
    e.point = e.point || t.point;
    e.time = e.time || t.time;
    const s = euclideanDistance(e.point, t.point);
    return s < n || (s < r && t.time - e.time < i);
}
const A = 25;
const b = 250;
function isTap(e, t, o = {}) {
    const n = o.tolerance != null ? o.tolerance : A;
    const r = o.interval != null ? o.interval : b;
    e.point = e.point || t.point;
    e.time = e.time || t.time;
    const i = euclideanDistance(e.point, t.point);
    return i < n && t.time - e.time < r;
}
const F = t("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 32);
function generateID() {
    return F();
}
const Feature = function (e, t) {
    this.ctx = e;
    this.properties = t.properties || {};
    this.coordinates = t.geometry.coordinates;
    this.id = t.id || generateID();
    this.type = t.geometry.type;
};
Feature.prototype.changed = function () {
    this.ctx.store.featureChanged(this.id);
};
Feature.prototype.incomingCoords = function (e) {
    this.setCoordinates(e);
};
Feature.prototype.setCoordinates = function (e) {
    this.coordinates = e;
    this.changed();
};
Feature.prototype.getCoordinates = function () {
    return JSON.parse(JSON.stringify(this.coordinates));
};
Feature.prototype.setProperty = function (e, t) {
    this.properties[e] = t;
};
Feature.prototype.toGeoJSON = function () {
    return JSON.parse(JSON.stringify({ id: this.id, type: u.FEATURE, properties: this.properties, geometry: { coordinates: this.getCoordinates(), type: this.type } }));
};
Feature.prototype.internal = function (e) {
    const t = { id: this.id, meta: h.FEATURE, "meta:type": this.type, active: f.INACTIVE, mode: e };
    if (this.ctx.options.userProperties) for (const e in this.properties) t[`user_${e}`] = this.properties[e];
    return { type: u.FEATURE, properties: t, geometry: { coordinates: this.getCoordinates(), type: this.type } };
};
const Point = function (e, t) {
    Feature.call(this, e, t);
};
Point.prototype = Object.create(Feature.prototype);
Point.prototype.isValid = function () {
    return typeof this.coordinates[0] === "number" && typeof this.coordinates[1] === "number";
};
Point.prototype.updateCoordinate = function (e, t, o) {
    arguments.length === 3 ? (this.coordinates = [t, o]) : (this.coordinates = [e, t]);
    this.changed();
};
Point.prototype.getCoordinate = function () {
    return this.getCoordinates();
};
const LineString = function (e, t) {
    Feature.call(this, e, t);
};
LineString.prototype = Object.create(Feature.prototype);
LineString.prototype.isValid = function () {
    return this.coordinates.length > 1;
};
LineString.prototype.addCoordinate = function (e, t, o) {
    this.changed();
    const n = parseInt(e, 10);
    this.coordinates.splice(n, 0, [t, o]);
};
LineString.prototype.getCoordinate = function (e) {
    const t = parseInt(e, 10);
    return JSON.parse(JSON.stringify(this.coordinates[t]));
};
LineString.prototype.removeCoordinate = function (e) {
    this.changed();
    this.coordinates.splice(parseInt(e, 10), 1);
};
LineString.prototype.updateCoordinate = function (e, t, o) {
    const n = parseInt(e, 10);
    this.coordinates[n] = [t, o];
    this.changed();
};
const Polygon = function (e, t) {
    Feature.call(this, e, t);
    this.coordinates = this.coordinates.map((e) => e.slice(0, -1));
};
Polygon.prototype = Object.create(Feature.prototype);
Polygon.prototype.isValid = function () {
    return this.coordinates.length !== 0 && this.coordinates.every((e) => e.length > 2);
};
Polygon.prototype.incomingCoords = function (e) {
    this.coordinates = e.map((e) => e.slice(0, -1));
    this.changed();
};
Polygon.prototype.setCoordinates = function (e) {
    this.coordinates = e;
    this.changed();
};
Polygon.prototype.addCoordinate = function (e, t, o) {
    this.changed();
    const n = e.split(".").map((e) => parseInt(e, 10));
    const r = this.coordinates[n[0]];
    r.splice(n[1], 0, [t, o]);
};
Polygon.prototype.removeCoordinate = function (e) {
    this.changed();
    const t = e.split(".").map((e) => parseInt(e, 10));
    const o = this.coordinates[t[0]];
    if (o) {
        o.splice(t[1], 1);
        o.length < 3 && this.coordinates.splice(t[0], 1);
    }
};
Polygon.prototype.getCoordinate = function (e) {
    const t = e.split(".").map((e) => parseInt(e, 10));
    const o = this.coordinates[t[0]];
    return JSON.parse(JSON.stringify(o[t[1]]));
};
Polygon.prototype.getCoordinates = function () {
    return this.coordinates.map((e) => e.concat([e[0]]));
};
Polygon.prototype.updateCoordinate = function (e, t, o) {
    this.changed();
    const n = e.split(".");
    const r = parseInt(n[0], 10);
    const i = parseInt(n[1], 10);
    this.coordinates[r] === void 0 && (this.coordinates[r] = []);
    this.coordinates[r][i] = [t, o];
};
const P = { MultiPoint: Point, MultiLineString: LineString, MultiPolygon: Polygon };
const takeAction = (e, t, o, n, r) => {
    const i = o.split(".");
    const s = parseInt(i[0], 10);
    const a = i[1] ? i.slice(1).join(".") : null;
    return e[s][t](a, n, r);
};
const MultiFeature = function (e, t) {
    Feature.call(this, e, t);
    delete this.coordinates;
    this.model = P[t.geometry.type];
    if (this.model === void 0) throw new TypeError(`${t.geometry.type} is not a valid type`);
    this.features = this._coordinatesToFeatures(t.geometry.coordinates);
};
MultiFeature.prototype = Object.create(Feature.prototype);
MultiFeature.prototype._coordinatesToFeatures = function (e) {
    const t = this.model.bind(this);
    return e.map((e) => new t(this.ctx, { id: generateID(), type: u.FEATURE, properties: {}, geometry: { coordinates: e, type: this.type.replace("Multi", "") } }));
};
MultiFeature.prototype.isValid = function () {
    return this.features.every((e) => e.isValid());
};
MultiFeature.prototype.setCoordinates = function (e) {
    this.features = this._coordinatesToFeatures(e);
    this.changed();
};
MultiFeature.prototype.getCoordinate = function (e) {
    return takeAction(this.features, "getCoordinate", e);
};
MultiFeature.prototype.getCoordinates = function () {
    return JSON.parse(JSON.stringify(this.features.map((e) => (e.type === u.POLYGON ? e.getCoordinates() : e.coordinates))));
};
MultiFeature.prototype.updateCoordinate = function (e, t, o) {
    takeAction(this.features, "updateCoordinate", e, t, o);
    this.changed();
};
MultiFeature.prototype.addCoordinate = function (e, t, o) {
    takeAction(this.features, "addCoordinate", e, t, o);
    this.changed();
};
MultiFeature.prototype.removeCoordinate = function (e) {
    takeAction(this.features, "removeCoordinate", e);
    this.changed();
};
MultiFeature.prototype.getFeatures = function () {
    return this.features;
};
function ModeInterface(e) {
    this.map = e.map;
    this.drawConfig = JSON.parse(JSON.stringify(e.options || {}));
    this._ctx = e;
}
/**
 * Sets Draw's interal selected state
 * @name this.setSelected
 * @param {DrawFeature[]} - whats selected as a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js)
 */ ModeInterface.prototype.setSelected = function (e) {
    return this._ctx.store.setSelected(e);
};
/**
 * Sets Draw's internal selected coordinate state
 * @name this.setSelectedCoordinates
 * @param {Object[]} coords - a array of {coord_path: 'string', feature_id: 'string'}
 */ ModeInterface.prototype.setSelectedCoordinates = function (e) {
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
 */ ModeInterface.prototype.getSelected = function () {
    return this._ctx.store.getSelected();
};
/**
 * Get the ids of all currently selected features
 * @name this.getSelectedIds
 * @returns {String[]}
 */ ModeInterface.prototype.getSelectedIds = function () {
    return this._ctx.store.getSelectedIds();
};
/**
 * Check if a feature is selected
 * @name this.isSelected
 * @param {String} id - a feature id
 * @returns {Boolean}
 */ ModeInterface.prototype.isSelected = function (e) {
    return this._ctx.store.isSelected(e);
};
/**
 * Get a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js) by its id
 * @name this.getFeature
 * @param {String} id - a feature id
 * @returns {DrawFeature}
 */ ModeInterface.prototype.getFeature = function (e) {
    return this._ctx.store.get(e);
};
/**
 * Add a feature to draw's internal selected state
 * @name this.select
 * @param {String} id
 */ ModeInterface.prototype.select = function (e) {
    return this._ctx.store.select(e);
};
/**
 * Remove a feature from draw's internal selected state
 * @name this.delete
 * @param {String} id
 */ ModeInterface.prototype.deselect = function (e) {
    return this._ctx.store.deselect(e);
};
/**
 * Delete a feature from draw
 * @name this.deleteFeature
 * @param {String} id - a feature id
 */ ModeInterface.prototype.deleteFeature = function (e, t = {}) {
    return this._ctx.store.delete(e, t);
};
/**
 * Add a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js) to draw.
 * See `this.newFeature` for converting geojson into a DrawFeature
 * @name this.addFeature
 * @param {DrawFeature} feature - the feature to add
 */ ModeInterface.prototype.addFeature = function (e, t = {}) {
    return this._ctx.store.add(e, t);
};
ModeInterface.prototype.clearSelectedFeatures = function () {
    return this._ctx.store.clearSelected();
};
ModeInterface.prototype.clearSelectedCoordinates = function () {
    return this._ctx.store.clearSelectedCoordinates();
};
/**
 * Indicate if the different action are currently possible with your mode
 * See [draw.actionalbe](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#drawactionable) for a list of possible actions. All undefined actions are set to **false** by default
 * @name this.setActionableState
 * @param {Object} actions
 */ ModeInterface.prototype.setActionableState = function (e = {}) {
    const t = { trash: e.trash || false, combineFeatures: e.combineFeatures || false, uncombineFeatures: e.uncombineFeatures || false };
    return this._ctx.events.actionable(t);
};
/**
 * Trigger a mode change
 * @name this.changeMode
 * @param {String} mode - the mode to transition into
 * @param {Object} opts - the options object to pass to the new mode
 * @param {Object} eventOpts - used to control what kind of events are emitted.
 */ ModeInterface.prototype.changeMode = function (e, t = {}, o = {}) {
    return this._ctx.events.changeMode(e, t, o);
};
/**
 * Fire a map event
 * @name this.fire
 * @param {String} eventName - the event name.
 * @param {Object} eventData - the event data object.
 */ ModeInterface.prototype.fire = function (e, t) {
    return this._ctx.events.fire(e, t);
};
/**
 * Update the state of draw map classes
 * @name this.updateUIClasses
 * @param {Object} opts
 */ ModeInterface.prototype.updateUIClasses = function (e) {
    return this._ctx.ui.queueMapClasses(e);
};
/**
 * If a name is provided it makes that button active, else if makes all buttons inactive
 * @name this.activateUIButton
 * @param {String?} name - name of the button to make active, leave as undefined to set buttons to be inactive
 */ ModeInterface.prototype.activateUIButton = function (e) {
    return this._ctx.ui.setActiveButton(e);
};
/**
 * Get the features at the location of an event object or in a bbox
 * @name this.featuresAt
 * @param {Event||NULL} event - a mapbox-gl event object
 * @param {BBOX||NULL} bbox - the area to get features from
 * @param {String} bufferType - is this `click` or `tap` event, defaults to click
 */ ModeInterface.prototype.featuresAt = function (e, t, o = "click") {
    if (o !== "click" && o !== "touch") throw new Error("invalid buffer type");
    return M[o](e, t, this._ctx);
};
/**
 * Create a new [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js) from geojson
 * @name this.newFeature
 * @param {GeoJSONFeature} geojson
 * @returns {DrawFeature}
 */ ModeInterface.prototype.newFeature = function (e) {
    const t = e.geometry.type;
    return t === u.POINT ? new Point(this._ctx, e) : t === u.LINE_STRING ? new LineString(this._ctx, e) : t === u.POLYGON ? new Polygon(this._ctx, e) : new MultiFeature(this._ctx, e);
};
/**
 * Check is an object is an instance of a [DrawFeature](https://github.com/mapbox/mapbox-gl-draw/blob/main/src/feature_types/feature.js)
 * @name this.isInstanceOf
 * @param {String} type - `Point`, `LineString`, `Polygon`, `MultiFeature`
 * @param {Object} feature - the object that needs to be checked
 * @returns {Boolean}
 */ ModeInterface.prototype.isInstanceOf = function (e, t) {
    if (e === u.POINT) return t instanceof Point;
    if (e === u.LINE_STRING) return t instanceof LineString;
    if (e === u.POLYGON) return t instanceof Polygon;
    if (e === "MultiFeature") return t instanceof MultiFeature;
    throw new Error(`Unknown feature class: ${e}`);
};
/**
 * Force draw to rerender the feature of the provided id
 * @name this.doRender
 * @param {String} id - a feature id
 */ ModeInterface.prototype.doRender = function (e) {
    return this._ctx.store.featureChanged(e);
};
/**
 * Triggered while a mode is being transitioned into.
 * @param opts {Object} - this is the object passed via `draw.changeMode('mode', opts)`;
 * @name MODE.onSetup
 * @returns {Object} - this object will be passed to all other life cycle functions
 */ ModeInterface.prototype.onSetup = function () {};
/**
 * Triggered when a drag event is detected on the map
 * @name MODE.onDrag
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onDrag = function () {};
/**
 * Triggered when the mouse is clicked
 * @name MODE.onClick
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onClick = function () {};
/**
 * Triggered with the mouse is moved
 * @name MODE.onMouseMove
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onMouseMove = function () {};
/**
 * Triggered when the mouse button is pressed down
 * @name MODE.onMouseDown
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onMouseDown = function () {};
/**
 * Triggered when the mouse button is released
 * @name MODE.onMouseUp
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onMouseUp = function () {};
/**
 * Triggered when the mouse leaves the map's container
 * @name MODE.onMouseOut
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onMouseOut = function () {};
/**
 * Triggered when a key up event is detected
 * @name MODE.onKeyUp
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onKeyUp = function () {};
/**
 * Triggered when a key down event is detected
 * @name MODE.onKeyDown
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onKeyDown = function () {};
/**
 * Triggered when a touch event is started
 * @name MODE.onTouchStart
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onTouchStart = function () {};
/**
 * Triggered when one drags thier finger on a mobile device
 * @name MODE.onTouchMove
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onTouchMove = function () {};
/**
 * Triggered when one removes their finger from the map
 * @name MODE.onTouchEnd
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onTouchEnd = function () {};
/**
 * Triggered when one quicly taps the map
 * @name MODE.onTap
 * @param state {Object} - a mutible state object created by onSetup
 * @param e {Object} - the captured event that is triggering this life cycle event
 */ ModeInterface.prototype.onTap = function () {};
/**
 * Triggered when the mode is being exited, to be used for cleaning up artifacts such as invalid features
 * @name MODE.onStop
 * @param state {Object} - a mutible state object created by onSetup
 */ ModeInterface.prototype.onStop = function () {};
/**
 * Triggered when [draw.trash()](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#trash-draw) is called.
 * @name MODE.onTrash
 * @param state {Object} - a mutible state object created by onSetup
 */ ModeInterface.prototype.onTrash = function () {};
/**
 * Triggered when [draw.combineFeatures()](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#combinefeatures-draw) is called.
 * @name MODE.onCombineFeature
 * @param state {Object} - a mutible state object created by onSetup
 */ ModeInterface.prototype.onCombineFeature = function () {};
/**
 * Triggered when [draw.uncombineFeatures()](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#uncombinefeatures-draw) is called.
 * @name MODE.onUncombineFeature
 * @param state {Object} - a mutible state object created by onSetup
 */ ModeInterface.prototype.onUncombineFeature = function () {};
/**
 * Triggered per feature on render to convert raw features into set of features for display on the map
 * See [styling draw](https://github.com/mapbox/mapbox-gl-draw/blob/main/API.md#styling-draw) for information about what geojson properties Draw uses as part of rendering.
 * @name MODE.toDisplayFeatures
 * @param state {Object} - a mutible state object created by onSetup
 * @param geojson {Object} - a geojson being evaulated. To render, pass to `display`.
 * @param display {Function} - all geojson objects passed to this be rendered onto the map
 */ ModeInterface.prototype.toDisplayFeatures = function () {
    throw new Error("You must overwrite toDisplayFeatures");
};
const x = {
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
const D = Object.keys(x);
function objectToMode(e) {
    const t = Object.keys(e);
    return function (o, n = {}) {
        let r = {};
        const i = t.reduce((t, o) => {
            t[o] = e[o];
            return t;
        }, new ModeInterface(o));
        function wrapper(e) {
            return (t) => i[e](r, t);
        }
        return {
            start() {
                r = i.onSetup(n);
                D.forEach((t) => {
                    const o = x[t];
                    let selector = () => false;
                    e[o] && (selector = () => true);
                    this.on(t, selector, wrapper(o));
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
function events(e) {
    const t = Object.keys(e.options.modes).reduce((t, o) => {
        t[o] = objectToMode(e.options.modes[o]);
        return t;
    }, {});
    let o = {};
    let n = {};
    const r = {};
    let s = null;
    let c = null;
    r.drag = function (t, o) {
        if (o({ point: t.point, time: new Date().getTime() })) {
            e.ui.queueMapClasses({ mouse: a.DRAG });
            c.drag(t);
        } else t.originalEvent.stopPropagation();
    };
    r.mousedrag = function (e) {
        r.drag(e, (e) => !isClick(o, e));
    };
    r.touchdrag = function (e) {
        r.drag(e, (e) => !isTap(n, e));
    };
    r.mousemove = function (t) {
        const o = t.originalEvent.buttons !== void 0 ? t.originalEvent.buttons : t.originalEvent.which;
        if (o === 1) return r.mousedrag(t);
        const n = getFeatureAtAndSetCursors(t, e);
        t.featureTarget = n;
        c.mousemove(t);
    };
    r.mousedown = function (t) {
        o = { time: new Date().getTime(), point: t.point };
        const n = getFeatureAtAndSetCursors(t, e);
        t.featureTarget = n;
        c.mousedown(t);
    };
    r.mouseup = function (t) {
        const n = getFeatureAtAndSetCursors(t, e);
        t.featureTarget = n;
        isClick(o, { point: t.point, time: new Date().getTime() }) ? c.click(t) : c.mouseup(t);
    };
    r.mouseout = function (e) {
        c.mouseout(e);
    };
    r.touchstart = function (t) {
        if (!e.options.touchEnabled) return;
        n = { time: new Date().getTime(), point: t.point };
        const o = M.touch(t, null, e)[0];
        t.featureTarget = o;
        c.touchstart(t);
    };
    r.touchmove = function (t) {
        if (e.options.touchEnabled) {
            c.touchmove(t);
            return r.touchdrag(t);
        }
    };
    r.touchend = function (t) {
        t.originalEvent.preventDefault();
        if (!e.options.touchEnabled) return;
        const o = M.touch(t, null, e)[0];
        t.featureTarget = o;
        isTap(n, { time: new Date().getTime(), point: t.point }) ? c.tap(t) : c.touchend(t);
    };
    const isKeyModeValid = (e) => !(e === 8 || e === 46 || (e >= 48 && e <= 57));
    r.keydown = function (t) {
        const o = (t.srcElement || t.target).classList.contains(i.CANVAS);
        if (o)
            if ((t.keyCode !== 8 && t.keyCode !== 46) || !e.options.controls.trash)
                isKeyModeValid(t.keyCode)
                    ? c.keydown(t)
                    : t.keyCode === 49 && e.options.controls.point
                    ? changeMode(l.DRAW_POINT)
                    : t.keyCode === 50 && e.options.controls.line_string
                    ? changeMode(l.DRAW_LINE_STRING)
                    : t.keyCode === 51 && e.options.controls.polygon && changeMode(l.DRAW_POLYGON);
            else {
                t.preventDefault();
                c.trash();
            }
    };
    r.keyup = function (e) {
        isKeyModeValid(e.keyCode) && c.keyup(e);
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
    function changeMode(o, n, r = {}) {
        c.stop();
        const i = t[o];
        if (i === void 0) throw new Error(`${o} is not valid`);
        s = o;
        const a = i(e, n);
        c = ModeHandler(a, e);
        r.silent || e.map.fire(d.MODE_CHANGE, { mode: o });
        e.store.setDirty();
        e.store.render();
    }
    const u = { trash: false, combineFeatures: false, uncombineFeatures: false };
    function actionable(t) {
        let o = false;
        Object.keys(t).forEach((e) => {
            if (u[e] === void 0) throw new Error("Invalid action type");
            u[e] !== t[e] && (o = true);
            u[e] = t[e];
        });
        o && e.map.fire(d.ACTIONABLE, { actions: u });
    }
    const p = {
        start() {
            s = e.options.defaultMode;
            c = ModeHandler(t[s](e), e);
        },
        changeMode: changeMode,
        actionable: actionable,
        currentModeName() {
            return s;
        },
        currentModeRender(e, t) {
            return c.render(e, t);
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
            c.trash(e);
        },
        combineFeatures() {
            c.combineFeatures();
        },
        uncombineFeatures() {
            c.uncombineFeatures();
        },
        getMode() {
            return s;
        },
    };
    return p;
}
/**
 * Derive a dense array (no `undefined`s) from a single value or array.
 *
 * @param {any} x
 * @return {Array<any>}
 */ function toDenseArray(e) {
    return [].concat(e).filter((e) => e !== void 0);
}
function render() {
    const e = this;
    const t = e.ctx.map && e.ctx.map.getSource(s.HOT) !== void 0;
    if (!t) return cleanup();
    const o = e.ctx.events.currentModeName();
    e.ctx.ui.queueMapClasses({ mode: o });
    let n = [];
    let r = [];
    if (e.isDirty) r = e.getAllIds();
    else {
        n = e.getChangedIds().filter((t) => e.get(t) !== void 0);
        r = e.sources.hot.filter((t) => t.properties.id && n.indexOf(t.properties.id) === -1 && e.get(t.properties.id) !== void 0).map((e) => e.properties.id);
    }
    e.sources.hot = [];
    const i = e.sources.cold.length;
    e.sources.cold = e.isDirty
        ? []
        : e.sources.cold.filter((e) => {
              const t = e.properties.id || e.properties.parent;
              return n.indexOf(t) === -1;
          });
    const a = i !== e.sources.cold.length || r.length > 0;
    n.forEach((e) => renderFeature(e, "hot"));
    r.forEach((e) => renderFeature(e, "cold"));
    function renderFeature(t, n) {
        const r = e.get(t);
        const i = r.internal(o);
        e.ctx.events.currentModeRender(i, (t) => {
            t.properties.mode = o;
            e.sources[n].push(t);
        });
    }
    a && e.ctx.map.getSource(s.COLD).setData({ type: u.FEATURE_COLLECTION, features: e.sources.cold });
    e.ctx.map.getSource(s.HOT).setData({ type: u.FEATURE_COLLECTION, features: e.sources.hot });
    cleanup();
    function cleanup() {
        e.isDirty = false;
        e.clearChangedIds();
    }
}
function Store(e) {
    this._features = {};
    this._featureIds = new StringSet();
    this._selectedFeatureIds = new StringSet();
    this._selectedCoordinates = [];
    this._changedFeatureIds = new StringSet();
    this._emitSelectionChange = false;
    this._mapInitialConfig = {};
    this.ctx = e;
    this.sources = { hot: [], cold: [] };
    let t;
    this.render = () => {
        t ||
            (t = requestAnimationFrame(() => {
                t = null;
                render.call(this);
                if (this._emitSelectionChange) {
                    this.ctx.events.fire(d.SELECTION_CHANGE, {
                        features: this.getSelected().map((e) => e.toGeoJSON()),
                        points: this.getSelectedCoordinates().map((e) => ({ type: u.FEATURE, properties: {}, geometry: { type: u.POINT, coordinates: e.coordinates } })),
                    });
                    this._emitSelectionChange = false;
                }
                this.ctx.events.fire(d.RENDER, {});
            }));
    };
    this.isDirty = false;
}
Store.prototype.createRenderBatch = function () {
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
Store.prototype.setDirty = function () {
    this.isDirty = true;
    return this;
};
/**
 * Sets a feature's state to changed.
 * @param {string} featureId
 * @return {Store} this
 */ Store.prototype.featureCreated = function (e, t = {}) {
    this._changedFeatureIds.add(e);
    const o = t.silent != null ? t.silent : this.ctx.options.suppressAPIEvents;
    if (o !== true) {
        const t = this.get(e);
        this.ctx.events.fire(d.CREATE, { features: [t.toGeoJSON()] });
    }
    return this;
};
/**
 * Sets a feature's state to changed.
 * @param {string} featureId
 * @return {Store} this
 */ Store.prototype.featureChanged = function (e, t = {}) {
    this._changedFeatureIds.add(e);
    const o = t.silent != null ? t.silent : this.ctx.options.suppressAPIEvents;
    o !== true && this.ctx.events.fire(d.UPDATE, { action: t.action ? t.action : p.CHANGE_COORDINATES, features: [this.get(e).toGeoJSON()] });
    return this;
};
Store.prototype.getChangedIds = function () {
    return this._changedFeatureIds.values();
};
Store.prototype.clearChangedIds = function () {
    this._changedFeatureIds.clear();
    return this;
};
Store.prototype.getAllIds = function () {
    return this._featureIds.values();
};
/**
 * Adds a feature to the store.
 * @param {Object} feature
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 *
 * @return {Store} this
 */ Store.prototype.add = function (e, t = {}) {
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
 */ Store.prototype.delete = function (e, t = {}) {
    const o = [];
    toDenseArray(e).forEach((e) => {
        if (this._featureIds.has(e)) {
            this._featureIds.delete(e);
            this._selectedFeatureIds.delete(e);
            t.silent || (o.indexOf(this._features[e]) === -1 && o.push(this._features[e].toGeoJSON()));
            delete this._features[e];
            this.isDirty = true;
        }
    });
    o.length && this.ctx.events.fire(d.DELETE, { features: o });
    refreshSelectedCoordinates(this, t);
    return this;
};
Store.prototype.get = function (e) {
    return this._features[e];
};
Store.prototype.getAll = function () {
    return Object.keys(this._features).map((e) => this._features[e]);
};
/**
 * Adds features to the current selection.
 * @param {string | Array<string>} featureIds
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Store.prototype.select = function (e, t = {}) {
    toDenseArray(e).forEach((e) => {
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
 */ Store.prototype.deselect = function (e, t = {}) {
    toDenseArray(e).forEach((e) => {
        if (this._selectedFeatureIds.has(e)) {
            this._selectedFeatureIds.delete(e);
            this._changedFeatureIds.add(e);
            t.silent || (this._emitSelectionChange = true);
        }
    });
    refreshSelectedCoordinates(this, t);
    return this;
};
/**
 * Clears the current selection.
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 * @return {Store} this
 */ Store.prototype.clearSelected = function (e = {}) {
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
 */ Store.prototype.setSelected = function (e, t = {}) {
    e = toDenseArray(e);
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
 */ Store.prototype.setSelectedCoordinates = function (e) {
    this._selectedCoordinates = e;
    this._emitSelectionChange = true;
    return this;
};
/**
 * Clears the current coordinates selection.
 * @param {Object} [options]
 * @return {Store} this
 */ Store.prototype.clearSelectedCoordinates = function () {
    this._selectedCoordinates = [];
    this._emitSelectionChange = true;
    return this;
};
Store.prototype.getSelectedIds = function () {
    return this._selectedFeatureIds.values();
};
Store.prototype.getSelected = function () {
    return this.getSelectedIds().map((e) => this.get(e));
};
Store.prototype.getSelectedCoordinates = function () {
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
 */ Store.prototype.isSelected = function (e) {
    return this._selectedFeatureIds.has(e);
};
/**
 * Sets a property on the given feature
 * @param {string} featureId
 * @param {string} property property
 * @param {string} property value
 * @param {Object} [options]
 * @param {Object} [options.silent] - If `true`, this invocation will not fire an event.
 */ Store.prototype.setFeatureProperty = function (e, t, o, n = {}) {
    this.get(e).setProperty(t, o);
    this.featureChanged(e, { silent: n.silent, action: p.CHANGE_PROPERTIES });
};
function refreshSelectedCoordinates(e, t = {}) {
    const o = e._selectedCoordinates.filter((t) => e._selectedFeatureIds.has(t.feature_id));
    e._selectedCoordinates.length === o.length || t.silent || (e._emitSelectionChange = true);
    e._selectedCoordinates = o;
}
Store.prototype.storeMapConfig = function () {
    g.forEach((e) => {
        const t = this.ctx.map[e];
        t && (this._mapInitialConfig[e] = this.ctx.map[e].isEnabled());
    });
};
Store.prototype.restoreMapConfig = function () {
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
 */ Store.prototype.getInitialConfigValue = function (e) {
    return this._mapInitialConfig[e] === void 0 || this._mapInitialConfig[e];
};
const w = ["mode", "feature", "mouse"];
function ui(e) {
    const t = {};
    let o = null;
    let n = { mode: null, feature: null, mouse: null };
    let r = { mode: null, feature: null, mouse: null };
    function clearMapClasses() {
        queueMapClasses({ mode: null, feature: null, mouse: null });
        updateMapClasses();
    }
    function queueMapClasses(e) {
        r = Object.assign(r, e);
    }
    function updateMapClasses() {
        if (!e.container) return;
        const t = [];
        const o = [];
        w.forEach((e) => {
            if (r[e] !== n[e]) {
                t.push(`${e}-${n[e]}`);
                r[e] !== null && o.push(`${e}-${r[e]}`);
            }
        });
        t.length > 0 && e.container.classList.remove(...t);
        o.length > 0 && e.container.classList.add(...o);
        n = Object.assign(n, r);
    }
    function createControlButton(e, t = {}) {
        const n = document.createElement("button");
        n.className = `${i.CONTROL_BUTTON} ${t.className}`;
        n.setAttribute("title", t.title);
        t.container.appendChild(n);
        n.addEventListener(
            "click",
            (n) => {
                n.preventDefault();
                n.stopPropagation();
                const r = n.target;
                if (r !== o) {
                    setActiveButton(e);
                    t.onActivate();
                } else {
                    deactivateButtons();
                    t.onDeactivate();
                }
            },
            true
        );
        return n;
    }
    function deactivateButtons() {
        if (o) {
            o.classList.remove(i.ACTIVE_BUTTON);
            o = null;
        }
    }
    function setActiveButton(e) {
        deactivateButtons();
        const n = t[e];
        if (n && n && e !== "trash") {
            n.classList.add(i.ACTIVE_BUTTON);
            o = n;
        }
    }
    function addButtons() {
        const o = e.options.controls;
        const n = document.createElement("div");
        n.className = `${i.CONTROL_GROUP} ${i.CONTROL_BASE}`;
        if (!o) return n;
        o[c.LINE] &&
            (t[c.LINE] = createControlButton(c.LINE, {
                container: n,
                className: i.CONTROL_BUTTON_LINE,
                title: "LineString tool " + (e.options.keybindings ? "(l)" : ""),
                onActivate: () => e.events.changeMode(l.DRAW_LINE_STRING),
                onDeactivate: () => e.events.trash(),
            }));
        o[c.POLYGON] &&
            (t[c.POLYGON] = createControlButton(c.POLYGON, {
                container: n,
                className: i.CONTROL_BUTTON_POLYGON,
                title: "Polygon tool " + (e.options.keybindings ? "(p)" : ""),
                onActivate: () => e.events.changeMode(l.DRAW_POLYGON),
                onDeactivate: () => e.events.trash(),
            }));
        o[c.POINT] &&
            (t[c.POINT] = createControlButton(c.POINT, {
                container: n,
                className: i.CONTROL_BUTTON_POINT,
                title: "Marker tool " + (e.options.keybindings ? "(m)" : ""),
                onActivate: () => e.events.changeMode(l.DRAW_POINT),
                onDeactivate: () => e.events.trash(),
            }));
        o.trash &&
            (t.trash = createControlButton("trash", {
                container: n,
                className: i.CONTROL_BUTTON_TRASH,
                title: "Delete",
                onActivate: () => {
                    e.events.trash();
                },
            }));
        o.combine_features &&
            (t.combine_features = createControlButton("combineFeatures", {
                container: n,
                className: i.CONTROL_BUTTON_COMBINE_FEATURES,
                title: "Combine",
                onActivate: () => {
                    e.events.combineFeatures();
                },
            }));
        o.uncombine_features &&
            (t.uncombine_features = createControlButton("uncombineFeatures", {
                container: n,
                className: i.CONTROL_BUTTON_UNCOMBINE_FEATURES,
                title: "Uncombine",
                onActivate: () => {
                    e.events.uncombineFeatures();
                },
            }));
        return n;
    }
    function removeButtons() {
        Object.keys(t).forEach((e) => {
            const o = t[e];
            o.parentNode && o.parentNode.removeChild(o);
            delete t[e];
        });
    }
    return { setActiveButton: setActiveButton, queueMapClasses: queueMapClasses, updateMapClasses: updateMapClasses, clearMapClasses: clearMapClasses, addButtons: addButtons, removeButtons: removeButtons };
}
function runSetup(e) {
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
            e.events = events(e);
            e.ui = ui(e);
            e.container = r.getContainer();
            e.store = new Store(e);
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
            e.map.addSource(s.COLD, { data: { type: u.FEATURE_COLLECTION, features: [] }, type: "geojson" });
            e.map.addSource(s.HOT, { data: { type: u.FEATURE_COLLECTION, features: [] }, type: "geojson" });
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
            e.map.getSource(s.COLD) && e.map.removeSource(s.COLD);
            e.map.getSource(s.HOT) && e.map.removeSource(s.HOT);
        },
    };
    e.setup = n;
    return n;
}
const R = "#3bb2d0";
const U = "#fbb03b";
const k = "#fff";
var V = [
    { id: "gl-draw-polygon-fill", type: "fill", filter: ["all", ["==", "$type", "Polygon"]], paint: { "fill-color": ["case", ["==", ["get", "active"], "true"], U, R], "fill-opacity": 0.1 } },
    {
        id: "gl-draw-lines",
        type: "line",
        filter: ["any", ["==", "$type", "LineString"], ["==", "$type", "Polygon"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["case", ["==", ["get", "active"], "true"], U, R], "line-dasharray": ["case", ["==", ["get", "active"], "true"], [0.2, 2], [2, 0]], "line-width": 2 },
    },
    { id: "gl-draw-point-outer", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]], paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 7, 5], "circle-color": k } },
    {
        id: "gl-draw-point-inner",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "feature"]],
        paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 5, 3], "circle-color": ["case", ["==", ["get", "active"], "true"], U, R] },
    },
    {
        id: "gl-draw-vertex-outer",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["!=", "mode", "simple_select"]],
        paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 7, 5], "circle-color": k },
    },
    {
        id: "gl-draw-vertex-inner",
        type: "circle",
        filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"], ["!=", "mode", "simple_select"]],
        paint: { "circle-radius": ["case", ["==", ["get", "active"], "true"], 5, 3], "circle-color": U },
    },
    { id: "gl-draw-midpoint", type: "circle", filter: ["all", ["==", "meta", "midpoint"]], paint: { "circle-radius": 3, "circle-color": U } },
];
function isOfMetaType(e) {
    return function (t) {
        const o = t.featureTarget;
        return !!o && !!o.properties && o.properties.meta === e;
    };
}
function isShiftMousedown(e) {
    return !!e.originalEvent && !!e.originalEvent.shiftKey && e.originalEvent.button === 0;
}
function isActiveFeature(e) {
    return !!e.featureTarget && !!e.featureTarget.properties && e.featureTarget.properties.active === f.ACTIVE && e.featureTarget.properties.meta === h.FEATURE;
}
function isInactiveFeature(e) {
    return !!e.featureTarget && !!e.featureTarget.properties && e.featureTarget.properties.active === f.INACTIVE && e.featureTarget.properties.meta === h.FEATURE;
}
function noTarget(e) {
    return e.featureTarget === void 0;
}
function isFeature(e) {
    return !!e.featureTarget && !!e.featureTarget.properties && e.featureTarget.properties.meta === h.FEATURE;
}
function isVertex$1(e) {
    const t = e.featureTarget;
    return !!t && !!t.properties && t.properties.meta === h.VERTEX;
}
function isShiftDown(e) {
    return !!e.originalEvent && e.originalEvent.shiftKey === true;
}
function isEscapeKey(e) {
    return e.keyCode === 27;
}
function isEnterKey(e) {
    return e.keyCode === 13;
}
function isTrue() {
    return true;
}
var B = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            isActiveFeature: isActiveFeature,
            isEnterKey: isEnterKey,
            isEscapeKey: isEscapeKey,
            isFeature: isFeature,
            isInactiveFeature: isInactiveFeature,
            isOfMetaType: isOfMetaType,
            isShiftDown: isShiftDown,
            isShiftMousedown: isShiftMousedown,
            isTrue: isTrue,
            isVertex: isVertex$1,
            noTarget: noTarget,
        },
        Symbol.toStringTag,
        { value: "Module" }
    )
);
/**
 * Returns a Point representing a mouse event's position
 * relative to a containing element.
 *
 * @param {MouseEvent} mouseEvent
 * @param {Node} container
 * @returns {Point}
 */ function mouseEventPoint(e, t) {
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
 */
function createVertex(parent, coordinates, path, selected) {  //(e, t, o, n) {
//     return { type: u.FEATURE, properties: { meta: h.VERTEX, parent: e, coord_path: o, active: n ? f.ACTIVE : f.INACTIVE }, geometry: { type: u.POINT, coordinates: t } };
    const vertex = {
      type: u.FEATURE,
      properties: {
        ...parent.properties,
        meta: h.VERTEX,
        parent: parent.properties && parent.properties.id,
        coord_path: path,
        active: selected ?
          f.ACTIVE :
          f.INACTIVE
      },
      geometry: {
        type: u.POINT,
        coordinates
      }
    };
    delete vertex.properties.id;
    return vertex;
}

function createMidpoint(parent, startVertex, endVertex) { // e, t, o
    //const n = t.geometry.coordinates;
    //const r = o.geometry.coordinates;
    //if (n[1] > S || n[1] < y || r[1] > S || r[1] < y) return null;
    //const i = { lng: (n[0] + r[0]) / 2, lat: (n[1] + r[1]) / 2 };
    //return { type: u.FEATURE, properties: { meta: h.MIDPOINT, parent: e, lng: i.lng, lat: i.lat, coord_path: o.properties.coord_path }, geometry: { type: u.POINT, coordinates: [i.lng, i.lat] } };
    
    
    const startCoord = startVertex.geometry.coordinates;
    const endCoord = endVertex.geometry.coordinates;

    // If a coordinate exceeds the projection, we can't calculate a midpoint,
    // so run away
    if (
        startCoord[1] > h.LAT_RENDERED_MAX ||
        startCoord[1] < h.LAT_RENDERED_MIN ||
        endCoord[1] > h.LAT_RENDERED_MAX ||
        endCoord[1] < h.LAT_RENDERED_MIN
    ) {
        return null;
    }

    const ptA = map.project([startCoord[0], startCoord[1]]);
    const ptB = map.project([endCoord[0], endCoord[1]]);
    const mid = map.unproject([(ptA.x + ptB.x) / 2, (ptA.y + ptB.y) / 2]);

    const midpoint = {
        type: u.FEATURE,
        properties: {
        ...parent.properties,
        meta: h.MIDPOINT,
        parent: parent.properties && parent.properties.id,
        lng: mid.lng,
        lat: mid.lat,
        coord_path: endVertex.properties.coord_path
        },
        geometry: {
        type: u.POINT,
        coordinates: [mid.lng, mid.lat]
        }
    };

    // console.log(midpoint)

    delete midpoint.properties.id;
    return midpoint;
}

function createSupplementaryPoints(e, t = {}, o = null) {
    const { type: n, coordinates: r } = e.geometry;
    const i = e;
    let s = [];
    n === u.POINT
        ? s.push(createVertex(i, r, o, isSelectedPath(o)))
        : n === u.POLYGON
        ? r.forEach((e, t) => {
              processLine(e, o !== null ? `${o}.${t}` : String(t));
          })
        : n === u.LINE_STRING
        ? processLine(r, o)
        : n.indexOf(u.MULTI_PREFIX) === 0 && processMultiGeometry();
    function processLine(e, o) {
        let n = "";
        let r = null;
        e.forEach((e, a) => {
            const c = o !== void 0 && o !== null ? `${o}.${a}` : String(a);
            const u = createVertex(i, e, c, isSelectedPath(c));
            if (t.midpoints && r) {
                const e = createMidpoint(i, r, u);
                e && s.push(e);
            }
            r = u;
            const l = JSON.stringify(e);
            n !== l && s.push(u);
            a === 0 && (n = l);
        });
    }
    function isSelectedPath(e) {
        return !!t.selectedPaths && t.selectedPaths.indexOf(e) !== -1;
    }
    function processMultiGeometry() {
        const o = n.replace(u.MULTI_PREFIX, "");
        r.forEach((n, r) => {
            const i = { type: u.FEATURE, properties: e.properties, geometry: { type: o, coordinates: n } };
            s = s.concat(createSupplementaryPoints(i, t, r));
        });
    }
    return s;
}
var G = {
    enable(e) {
        setTimeout(() => {
            e.map && e.map.doubleClickZoom && e._ctx && e._ctx.store && e._ctx.store.getInitialConfigValue && e._ctx.store.getInitialConfigValue("doubleClickZoom") && e.map.doubleClickZoom.enable();
        }, 0);
    },
    disable(e) {
        setTimeout(() => {
            e.map && e.map.doubleClickZoom && e.map.doubleClickZoom.disable();
        }, 0);
    },
};
const { LAT_MIN: $, LAT_MAX: J, LAT_RENDERED_MIN: j, LAT_RENDERED_MAX: Y, LNG_MIN: K, LNG_MAX: H } = T;
function extent(e) {
    const t = { Point: 0, LineString: 1, Polygon: 2, MultiPoint: 1, MultiLineString: 2, MultiPolygon: 3 }[e.geometry.type];
    const o = [e.geometry.coordinates].flat(t);
    const n = o.map((e) => e[0]);
    const r = o.map((e) => e[1]);
    const min = (e) => Math.min.apply(null, e);
    const max = (e) => Math.max.apply(null, e);
    return [min(n), min(r), max(n), max(r)];
}
function constrainFeatureMovement(e, t) {
    let o = $;
    let n = J;
    let r = $;
    let i = J;
    let s = H;
    let a = K;
    e.forEach((e) => {
        const t = extent(e);
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
    o + c.lat > Y && (c.lat = Y - o);
    r + c.lat > J && (c.lat = J - r);
    n + c.lat < j && (c.lat = j - n);
    i + c.lat < $ && (c.lat = $ - i);
    s + c.lng <= K && (c.lng += Math.ceil(Math.abs(c.lng) / 360) * 360);
    a + c.lng >= H && (c.lng -= Math.ceil(Math.abs(c.lng) / 360) * 360);
    return c;
}
function moveFeatures(e, t) {
    const o = constrainFeatureMovement(
        e.map((e) => e.toGeoJSON()),
        t
    );
    e.forEach((e) => {
        const t = e.getCoordinates();
        const moveCoordinate = (e) => {
            const t = { lng: e[0] + o.lng, lat: e[1] + o.lat };
            return [t.lng, t.lat];
        };
        const moveRing = (e) => e.map((e) => moveCoordinate(e));
        const moveMultiPolygon = (e) => e.map((e) => moveRing(e));
        let n;
        e.type === u.POINT
            ? (n = moveCoordinate(t))
            : e.type === u.LINE_STRING || e.type === u.MULTI_POINT
            ? (n = t.map(moveCoordinate))
            : e.type === u.POLYGON || e.type === u.MULTI_LINE_STRING
            ? (n = t.map(moveRing))
            : e.type === u.MULTI_POLYGON && (n = t.map(moveMultiPolygon));
        e.incomingCoords(n);
    });
}
const X = {};
X.onSetup = function (e) {
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
X.fireUpdate = function () {
    this.fire(d.UPDATE, { action: p.MOVE, features: this.getSelected().map((e) => e.toGeoJSON()) });
};
X.fireActionable = function () {
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
X.getUniqueIds = function (e) {
    if (!e.length) return [];
    const t = e
        .map((e) => e.properties.id)
        .filter((e) => e !== void 0)
        .reduce((e, t) => {
            e.add(t);
            return e;
        }, new StringSet());
    return t.values();
};
X.stopExtendedInteractions = function (e) {
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
X.onStop = function () {
    G.enable(this);
};
X.onMouseMove = function (e, t) {
    const o = isFeature(t);
    o && e.dragMoving && this.fireUpdate();
    this.stopExtendedInteractions(e);
    return true;
};
X.onMouseOut = function (e) {
    return !e.dragMoving || this.fireUpdate();
};
X.onTap = X.onClick = function (e, t) {
    return noTarget(t) ? this.clickAnywhere(e, t) : isOfMetaType(h.VERTEX)(t) ? this.clickOnVertex(e, t) : isFeature(t) ? this.clickOnFeature(e, t) : void 0;
};
X.clickAnywhere = function (e) {
    const t = this.getSelectedIds();
    if (t.length) {
        this.clearSelectedFeatures();
        t.forEach((e) => this.doRender(e));
    }
    G.enable(this);
    this.stopExtendedInteractions(e);
};
X.clickOnVertex = function (e, t) {
    this.changeMode(l.DIRECT_SELECT, { featureId: t.featureTarget.properties.parent, coordPath: t.featureTarget.properties.coord_path, startPos: t.lngLat });
    this.updateUIClasses({ mouse: a.MOVE });
};
X.startOnActiveFeature = function (e, t) {
    this.stopExtendedInteractions(e);
    this.map.dragPan.disable();
    this.doRender(t.featureTarget.properties.id);
    e.canDragMove = true;
    e.dragMoveLocation = t.lngLat;
};
X.clickOnFeature = function (e, t) {
    G.disable(this);
    this.stopExtendedInteractions(e);
    const o = isShiftDown(t);
    const n = this.getSelectedIds();
    const r = t.featureTarget.properties.id;
    const i = this.isSelected(r);
    if (!o && i && this.getFeature(r).type !== u.POINT) return this.changeMode(l.DIRECT_SELECT, { featureId: r });
    if (i && o) {
        this.deselect(r);
        this.updateUIClasses({ mouse: a.POINTER });
        n.length === 1 && G.enable(this);
    } else if (!i && o) {
        this.select(r);
        this.updateUIClasses({ mouse: a.MOVE });
    } else if (!i && !o) {
        n.forEach((e) => this.doRender(e));
        this.setSelected(r);
        this.updateUIClasses({ mouse: a.MOVE });
    }
    this.doRender(r);
};
X.onMouseDown = function (e, t) {
    e.initialDragPanState = this.map.dragPan.isEnabled();
    return isActiveFeature(t) ? this.startOnActiveFeature(e, t) : this.drawConfig.boxSelect && isShiftMousedown(t) ? this.startBoxSelect(e, t) : void 0;
};
X.startBoxSelect = function (e, t) {
    this.stopExtendedInteractions(e);
    this.map.dragPan.disable();
    e.boxSelectStartLocation = mouseEventPoint(t.originalEvent, this.map.getContainer());
    e.canBoxSelect = true;
};
X.onTouchStart = function (e, t) {
    if (isActiveFeature(t)) return this.startOnActiveFeature(e, t);
};
X.onDrag = function (e, t) {
    return e.canDragMove ? this.dragMove(e, t) : this.drawConfig.boxSelect && e.canBoxSelect ? this.whileBoxSelect(e, t) : void 0;
};
X.whileBoxSelect = function (e, t) {
    e.boxSelecting = true;
    this.updateUIClasses({ mouse: a.ADD });
    if (!e.boxSelectElement) {
        e.boxSelectElement = document.createElement("div");
        e.boxSelectElement.classList.add(i.BOX_SELECT);
        this.map.getContainer().appendChild(e.boxSelectElement);
    }
    const o = mouseEventPoint(t.originalEvent, this.map.getContainer());
    const n = Math.min(e.boxSelectStartLocation.x, o.x);
    const r = Math.max(e.boxSelectStartLocation.x, o.x);
    const s = Math.min(e.boxSelectStartLocation.y, o.y);
    const c = Math.max(e.boxSelectStartLocation.y, o.y);
    const u = `translate(${n}px, ${s}px)`;
    e.boxSelectElement.style.transform = u;
    e.boxSelectElement.style.WebkitTransform = u;
    e.boxSelectElement.style.width = r - n + "px";
    e.boxSelectElement.style.height = c - s + "px";
};
X.dragMove = function (e, t) {
    e.dragMoving = true;
    t.originalEvent.stopPropagation();
    const o = { lng: t.lngLat.lng - e.dragMoveLocation.lng, lat: t.lngLat.lat - e.dragMoveLocation.lat };
    moveFeatures(this.getSelected(), o);
    e.dragMoveLocation = t.lngLat;
};
X.onTouchEnd = X.onMouseUp = function (e, t) {
    if (e.dragMoving) this.fireUpdate();
    else if (e.boxSelecting) {
        const o = [e.boxSelectStartLocation, mouseEventPoint(t.originalEvent, this.map.getContainer())];
        const n = this.featuresAt(null, o, "click");
        const r = this.getUniqueIds(n).filter((e) => !this.isSelected(e));
        if (r.length) {
            this.select(r);
            r.forEach((e) => this.doRender(e));
            this.updateUIClasses({ mouse: a.MOVE });
        }
    }
    this.stopExtendedInteractions(e);
};
X.toDisplayFeatures = function (e, t, o) {
    t.properties.active = this.isSelected(t.properties.id) ? f.ACTIVE : f.INACTIVE;
    o(t);
    this.fireActionable();
    t.properties.active === f.ACTIVE && t.geometry.type !== u.POINT && createSupplementaryPoints(t).forEach(o);
};
X.onTrash = function () {
    this.deleteFeature(this.getSelectedIds());
    this.fireActionable();
};
X.onCombineFeatures = function () {
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
        const e = this.newFeature({ type: u.FEATURE, properties: o[0].properties, geometry: { type: `Multi${n}`, coordinates: t } });
        this.addFeature(e);
        this.deleteFeature(this.getSelectedIds(), { silent: true });
        this.setSelected([e.id]);
        this.fire(d.COMBINE_FEATURES, { createdFeatures: [e.toGeoJSON()], deletedFeatures: o });
    }
    this.fireActionable();
};
X.onUncombineFeatures = function () {
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
    t.length > 1 && this.fire(d.UNCOMBINE_FEATURES, { createdFeatures: t, deletedFeatures: o });
    this.fireActionable();
};
const q = isOfMetaType(h.VERTEX);
const Z = isOfMetaType(h.MIDPOINT);
const W = {};
W.fireUpdate = function () {
    this.fire(d.UPDATE, { action: p.CHANGE_COORDINATES, features: this.getSelected().map((e) => e.toGeoJSON()) });
};
W.fireActionable = function (e) {
    this.setActionableState({ combineFeatures: false, uncombineFeatures: false, trash: e.selectedCoordPaths.length > 0 });
};
W.startDragging = function (e, t) {
    e.initialDragPanState = this.map.dragPan.isEnabled();
    this.map.dragPan.disable();
    e.canDragMove = true;
    e.dragMoveLocation = t.lngLat;
};
W.stopDragging = function (e) {
    e.canDragMove && e.initialDragPanState === true && this.map.dragPan.enable();
    e.dragMoving = false;
    e.canDragMove = false;
    e.dragMoveLocation = null;
};
W.onVertex = function (e, t) {
    this.startDragging(e, t);
    const o = t.featureTarget.properties;
    const n = e.selectedCoordPaths.indexOf(o.coord_path);
    isShiftDown(t) || n !== -1 ? isShiftDown(t) && n === -1 && e.selectedCoordPaths.push(o.coord_path) : (e.selectedCoordPaths = [o.coord_path]);
    const r = this.pathsToCoordinates(e.featureId, e.selectedCoordPaths);
    this.setSelectedCoordinates(r);
};
W.onMidpoint = function (e, t) {
    this.startDragging(e, t);
    const o = t.featureTarget.properties;
    e.feature.addCoordinate(o.coord_path, o.lng, o.lat);
    this.fireUpdate();
    e.selectedCoordPaths = [o.coord_path];
};
W.pathsToCoordinates = function (e, t) {
    return t.map((t) => ({ feature_id: e, coord_path: t }));
};
W.onFeature = function (e, t) {
    e.selectedCoordPaths.length === 0 ? this.startDragging(e, t) : this.stopDragging(e);
};
W.dragFeature = function (e, t, o) {
    moveFeatures(this.getSelected(), o);
    e.dragMoveLocation = t.lngLat;
};
W.dragVertex = function (e, t, o) {
    const n = e.selectedCoordPaths.map((t) => e.feature.getCoordinate(t));
    const r = n.map((e) => ({ type: u.FEATURE, properties: {}, geometry: { type: u.POINT, coordinates: e } }));
    const i = constrainFeatureMovement(r, o);
    for (let t = 0; t < n.length; t++) {
        const o = n[t];
        e.feature.updateCoordinate(e.selectedCoordPaths[t], o[0] + i.lng, o[1] + i.lat);
    }
};
W.clickNoTarget = function () {
    this.changeMode(l.SIMPLE_SELECT);
};
W.clickInactive = function () {
    this.changeMode(l.SIMPLE_SELECT);
};
W.clickActiveFeature = function (e) {
    e.selectedCoordPaths = [];
    this.clearSelectedCoordinates();
    e.feature.changed();
};
W.onSetup = function (e) {
    const t = e.featureId;
    const o = this.getFeature(t);
    if (!o) throw new Error("You must provide a featureId to enter direct_select mode");
    if (o.type === u.POINT) throw new TypeError("direct_select mode doesn't handle point features");
    const n = { featureId: t, feature: o, dragMoveLocation: e.startPos || null, dragMoving: false, canDragMove: false, selectedCoordPaths: e.coordPath ? [e.coordPath] : [] };
    this.setSelectedCoordinates(this.pathsToCoordinates(t, n.selectedCoordPaths));
    this.setSelected(t);
    G.disable(this);
    this.setActionableState({ trash: true });
    return n;
};
W.onStop = function () {
    G.enable(this);
    this.clearSelectedCoordinates();
};
W.toDisplayFeatures = function (e, t, o) {
    if (e.featureId === t.properties.id) {
        t.properties.active = f.ACTIVE;
        o(t);
        createSupplementaryPoints(t, { map: this.map, midpoints: true, selectedPaths: e.selectedCoordPaths }).forEach(o);
    } else {
        t.properties.active = f.INACTIVE;
        o(t);
    }
    this.fireActionable(e);
};
W.onTrash = function (e) {
    e.selectedCoordPaths.sort((e, t) => t.localeCompare(e, "en", { numeric: true })).forEach((t) => e.feature.removeCoordinate(t));
    this.fireUpdate();
    e.selectedCoordPaths = [];
    this.clearSelectedCoordinates();
    this.fireActionable(e);
    if (e.feature.isValid() === false) {
        this.deleteFeature([e.featureId]);
        this.changeMode(l.SIMPLE_SELECT, {});
    }
};
W.onMouseMove = function (e, t) {
    const o = isActiveFeature(t);
    const n = q(t);
    const r = Z(t);
    const i = e.selectedCoordPaths.length === 0;
    (o && i) || (n && !i) ? this.updateUIClasses({ mouse: a.MOVE }) : this.updateUIClasses({ mouse: a.NONE });
    const s = n || o || r;
    s && e.dragMoving && this.fireUpdate();
    this.stopDragging(e);
    return true;
};
W.onMouseOut = function (e) {
    e.dragMoving && this.fireUpdate();
    return true;
};
W.onTouchStart = W.onMouseDown = function (e, t) {
    return q(t) ? this.onVertex(e, t) : isActiveFeature(t) ? this.onFeature(e, t) : Z(t) ? this.onMidpoint(e, t) : void 0;
};
W.onDrag = function (e, t) {
    if (e.canDragMove !== true) return;
    e.dragMoving = true;
    t.originalEvent.stopPropagation();
    const o = { lng: t.lngLat.lng - e.dragMoveLocation.lng, lat: t.lngLat.lat - e.dragMoveLocation.lat };
    e.selectedCoordPaths.length > 0 ? this.dragVertex(e, t, o) : this.dragFeature(e, t, o);
    e.dragMoveLocation = t.lngLat;
};
W.onClick = function (e, t) {
    if (noTarget(t)) return this.clickNoTarget(e, t);
    if (isActiveFeature(t)) return this.clickActiveFeature(e, t);
    if (isInactiveFeature(t)) return this.clickInactive(e, t);
    this.stopDragging(e);
};
W.onTap = function (e, t) {
    return noTarget(t) ? this.clickNoTarget(e, t) : isActiveFeature(t) ? this.clickActiveFeature(e, t) : isInactiveFeature(t) ? this.clickInactive(e, t) : void 0;
};
W.onTouchEnd = W.onMouseUp = function (e) {
    e.dragMoving && this.fireUpdate();
    this.stopDragging(e);
};
const z = {};
z.onSetup = function () {
    const e = this.newFeature({ type: u.FEATURE, properties: {}, geometry: { type: u.POINT, coordinates: [] } });
    this.addFeature(e);
    this.clearSelectedFeatures();
    this.updateUIClasses({ mouse: a.ADD });
    this.activateUIButton(c.POINT);
    this.setActionableState({ trash: true });
    return { point: e };
};
z.stopDrawingAndRemove = function (e) {
    this.deleteFeature([e.point.id], { silent: true });
    this.changeMode(l.SIMPLE_SELECT);
};
z.onTap = z.onClick = function (e, t) {
    this.updateUIClasses({ mouse: a.MOVE });
    e.point.updateCoordinate("", t.lngLat.lng, t.lngLat.lat);
    this.fire(d.CREATE, { features: [e.point.toGeoJSON()] });
    this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.point.id] });
};
z.onStop = function (e) {
    this.activateUIButton();
    e.point.getCoordinate().length || this.deleteFeature([e.point.id], { silent: true });
};
z.toDisplayFeatures = function (e, t, o) {
    const n = t.properties.id === e.point.id;
    t.properties.active = n ? f.ACTIVE : f.INACTIVE;
    if (!n) return o(t);
};
z.onTrash = z.stopDrawingAndRemove;
z.onKeyUp = function (e, t) {
    if (isEscapeKey(t) || isEnterKey(t)) return this.stopDrawingAndRemove(e, t);
};
function isEventAtCoordinates(e, t) {
    return !!e.lngLat && e.lngLat.lng === t[0] && e.lngLat.lat === t[1];
}
const Q = {};
Q.onSetup = function () {
    const e = this.newFeature({ type: u.FEATURE, properties: {}, geometry: { type: u.POLYGON, coordinates: [[]] } });
    this.addFeature(e);
    this.clearSelectedFeatures();
    G.disable(this);
    this.updateUIClasses({ mouse: a.ADD });
    this.activateUIButton(c.POLYGON);
    this.setActionableState({ trash: true });
    return { polygon: e, currentVertexPosition: 0 };
};
Q.clickAnywhere = function (e, t) {
    if (e.currentVertexPosition > 0 && isEventAtCoordinates(t, e.polygon.coordinates[0][e.currentVertexPosition - 1])) return this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
    this.updateUIClasses({ mouse: a.ADD });
    e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat);
    e.currentVertexPosition++;
    e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat);
};
Q.clickOnVertex = function (e) {
    return this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
};
Q.onMouseMove = function (e, t) {
    e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat);
    isVertex$1(t) && this.updateUIClasses({ mouse: a.POINTER });
};
Q.onTap = Q.onClick = function (e, t) {
    return isVertex$1(t) ? this.clickOnVertex(e, t) : this.clickAnywhere(e, t);
};
Q.onKeyUp = function (e, t) {
    if (isEscapeKey(t)) {
        this.deleteFeature([e.polygon.id], { silent: true });
        this.changeMode(l.SIMPLE_SELECT);
    } else isEnterKey(t) && this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
};
Q.onStop = function (e) {
    this.updateUIClasses({ mouse: a.NONE });
    G.enable(this);
    this.activateUIButton();
    if (this.getFeature(e.polygon.id) !== void 0) {
        e.polygon.removeCoordinate(`0.${e.currentVertexPosition}`);
        if (e.polygon.isValid()) this.fire(d.CREATE, { features: [e.polygon.toGeoJSON()] });
        else {
            this.deleteFeature([e.polygon.id], { silent: true });
            this.changeMode(l.SIMPLE_SELECT, {}, { silent: true });
        }
    }
};
Q.toDisplayFeatures = function (e, t, o) {
    const n = t.properties.id === e.polygon.id;
    t.properties.active = n ? f.ACTIVE : f.INACTIVE;
    if (!n) return o(t);
    if (t.geometry.coordinates.length === 0) return;
    const r = t.geometry.coordinates[0].length;
    if (!(r < 3)) {
        t.properties.meta = h.FEATURE;
        o(createVertex(e.polygon, t.geometry.coordinates[0][0], "0.0", false));
        if (r > 3) {
            const n = t.geometry.coordinates[0].length - 3;
            o(createVertex(e.polygon, t.geometry.coordinates[0][n], `0.${n}`, false));
        }
        if (r <= 4) {
            const e = [
                [t.geometry.coordinates[0][0][0], t.geometry.coordinates[0][0][1]],
                [t.geometry.coordinates[0][1][0], t.geometry.coordinates[0][1][1]],
            ];
            o({ type: u.FEATURE, properties: t.properties, geometry: { coordinates: e, type: u.LINE_STRING } });
            if (r === 3) return;
        }
        return o(t);
    }
};
Q.onTrash = function (e) {
    this.deleteFeature([e.polygon.id], { silent: true });
    this.changeMode(l.SIMPLE_SELECT);
};
const ee = {};
ee.onSetup = function (e) {
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
        if (!i || !Array.isArray(i)) throw new Error("Please use the `from` property to indicate which point to continue the line from");
        const s = o.coordinates.length - 1;
        if (o.coordinates[s][0] === i[0] && o.coordinates[s][1] === i[1]) {
            n = s + 1;
            o.addCoordinate(n, ...o.coordinates[s]);
        } else {
            if (o.coordinates[0][0] !== i[0] || o.coordinates[0][1] !== i[1]) throw new Error("`from` should match the point at either the start or the end of the provided LineString");
            r = "backwards";
            n = 0;
            o.addCoordinate(n, ...o.coordinates[0]);
        }
    } else {
        o = this.newFeature({ type: u.FEATURE, properties: {}, geometry: { type: u.LINE_STRING, coordinates: [] } });
        n = 0;
        this.addFeature(o);
    }
    this.clearSelectedFeatures();
    G.disable(this);
    this.updateUIClasses({ mouse: a.ADD });
    this.activateUIButton(c.LINE);
    this.setActionableState({ trash: true });
    return { line: o, currentVertexPosition: n, direction: r };
};
ee.clickAnywhere = function (e, t) {
    if ((e.currentVertexPosition > 0 && isEventAtCoordinates(t, e.line.coordinates[e.currentVertexPosition - 1])) || (e.direction === "backwards" && isEventAtCoordinates(t, e.line.coordinates[e.currentVertexPosition + 1])))
        return this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.line.id] });
    this.updateUIClasses({ mouse: a.ADD });
    e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat);
    if (e.direction === "forward") {
        e.currentVertexPosition++;
        e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat);
    } else e.line.addCoordinate(0, t.lngLat.lng, t.lngLat.lat);
};
ee.clickOnVertex = function (e) {
    return this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.line.id] });
};
ee.onMouseMove = function (e, t) {
    e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat);
    isVertex$1(t) && this.updateUIClasses({ mouse: a.POINTER });
};
ee.onTap = ee.onClick = function (e, t) {
    if (isVertex$1(t)) return this.clickOnVertex(e, t);
    this.clickAnywhere(e, t);
};
ee.onKeyUp = function (e, t) {
    if (isEnterKey(t)) this.changeMode(l.SIMPLE_SELECT, { featureIds: [e.line.id] });
    else if (isEscapeKey(t)) {
        this.deleteFeature([e.line.id], { silent: true });
        this.changeMode(l.SIMPLE_SELECT);
    }
};
ee.onStop = function (e) {
    G.enable(this);
    this.activateUIButton();
    if (this.getFeature(e.line.id) !== void 0) {
        e.line.removeCoordinate(`${e.currentVertexPosition}`);
        if (e.line.isValid()) this.fire(d.CREATE, { features: [e.line.toGeoJSON()] });
        else {
            this.deleteFeature([e.line.id], { silent: true });
            this.changeMode(l.SIMPLE_SELECT, {}, { silent: true });
        }
    }
};
ee.onTrash = function (e) {
    this.deleteFeature([e.line.id], { silent: true });
    this.changeMode(l.SIMPLE_SELECT);
};
ee.toDisplayFeatures = function (e, t, o) {
    const n = t.properties.id === e.line.id;
    t.properties.active = n ? f.ACTIVE : f.INACTIVE;
    if (!n) return o(t);
    if (!(t.geometry.coordinates.length < 2)) {
        t.properties.meta = h.FEATURE;
        o(createVertex(e.line, t.geometry.coordinates[e.direction === "forward" ? t.geometry.coordinates.length - 2 : 1], "" + (e.direction === "forward" ? t.geometry.coordinates.length - 2 : 1), false));
        o(t);
    }
};
var te = { simple_select: X, direct_select: W, draw_point: z, draw_polygon: Q, draw_line_string: ee };
const oe = {
    defaultMode: l.SIMPLE_SELECT,
    keybindings: true,
    touchEnabled: true,
    clickBuffer: 2,
    touchBuffer: 25,
    boxSelect: true,
    displayControlsDefault: true,
    styles: V,
    modes: te,
    controls: {},
    userProperties: false,
    suppressAPIEvents: true,
};
const ne = { point: true, line_string: true, polygon: true, trash: true, combine_features: true, uncombine_features: true };
const re = { point: false, line_string: false, polygon: false, trash: false, combine_features: false, uncombine_features: false };
function addSources(e, t) {
    return e.map((e) => (e.source ? e : Object.assign({}, e, { id: `${e.id}.${t}`, source: t === "hot" ? s.HOT : s.COLD })));
}
function setupOptions(e = {}) {
    let t = Object.assign({}, e);
    e.controls || (t.controls = {});
    e.displayControlsDefault === false ? (t.controls = Object.assign({}, re, e.controls)) : (t.controls = Object.assign({}, ne, e.controls));
    t = Object.assign({}, oe, t);
    t.styles = addSources(t.styles, "cold").concat(addSources(t.styles, "hot"));
    return t;
}
function stringSetsAreEqual(e, t) {
    return e.length === t.length && JSON.stringify(e.map((e) => e).sort()) === JSON.stringify(t.map((e) => e).sort());
}
const ie = { Polygon: Polygon, LineString: LineString, Point: Point, MultiPolygon: MultiFeature, MultiLineString: MultiFeature, MultiPoint: MultiFeature };
function setupAPI(e, t) {
    t.modes = l;
    const o = e.options.suppressAPIEvents === void 0 || !!e.options.suppressAPIEvents;
    t.getFeatureIdsAt = function (t) {
        const o = M.click({ point: t }, null, e);
        return o.map((e) => e.properties.id);
    };
    t.getSelectedIds = function () {
        return e.store.getSelectedIds();
    };
    t.getSelected = function () {
        return {
            type: u.FEATURE_COLLECTION,
            features: e.store
                .getSelectedIds()
                .map((t) => e.store.get(t))
                .map((e) => e.toGeoJSON()),
        };
    };
    t.getSelectedPoints = function () {
        return { type: u.FEATURE_COLLECTION, features: e.store.getSelectedCoordinates().map((e) => ({ type: u.FEATURE, properties: {}, geometry: { type: u.POINT, coordinates: e.coordinates } })) };
    };
    t.set = function (o) {
        if (o.type === void 0 || o.type !== u.FEATURE_COLLECTION || !Array.isArray(o.features)) throw new Error("Invalid FeatureCollection");
        const n = e.store.createRenderBatch();
        let r = e.store.getAllIds().slice();
        const i = t.add(o);
        const s = new StringSet(i);
        r = r.filter((e) => !s.has(e));
        r.length && t.delete(r);
        n();
        return i;
    };
    t.add = function (t) {
        const i = JSON.parse(JSON.stringify(r(t)));
        const s = i.features.map((t) => {
            t.id = t.id || generateID();
            if (t.geometry === null) throw new Error("Invalid geometry: null");
            if (e.store.get(t.id) === void 0 || e.store.get(t.id).type !== t.geometry.type) {
                const n = ie[t.geometry.type];
                if (n === void 0) throw new Error(`Invalid geometry type: ${t.geometry.type}.`);
                const r = new n(e, t);
                e.store.add(r, { silent: o });
            } else {
                const r = e.store.get(t.id);
                const i = r.properties;
                r.properties = t.properties;
                n(i, t.properties) || e.store.featureChanged(r.id, { silent: o });
                n(r.getCoordinates(), t.geometry.coordinates) || r.incomingCoords(t.geometry.coordinates);
            }
            return t.id;
        });
        e.store.render();
        return s;
    };
    t.get = function (t) {
        const o = e.store.get(t);
        if (o) return o.toGeoJSON();
    };
    t.getAll = function () {
        return { type: u.FEATURE_COLLECTION, features: e.store.getAll().map((e) => e.toGeoJSON()) };
    };
    t.delete = function (n) {
        e.store.delete(n, { silent: o });
        t.getMode() !== l.DIRECT_SELECT || e.store.getSelectedIds().length ? e.store.render() : e.events.changeMode(l.SIMPLE_SELECT, void 0, { silent: o });
        return t;
    };
    t.deleteAll = function () {
        e.store.delete(e.store.getAllIds(), { silent: o });
        t.getMode() === l.DIRECT_SELECT ? e.events.changeMode(l.SIMPLE_SELECT, void 0, { silent: o }) : e.store.render();
        return t;
    };
    t.changeMode = function (n, r = {}) {
        if (n === l.SIMPLE_SELECT && t.getMode() === l.SIMPLE_SELECT) {
            if (stringSetsAreEqual(r.featureIds || [], e.store.getSelectedIds())) return t;
            e.store.setSelected(r.featureIds, { silent: o });
            e.store.render();
            return t;
        }
        if (n === l.DIRECT_SELECT && t.getMode() === l.DIRECT_SELECT && r.featureId === e.store.getSelectedIds()[0]) return t;
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
var se = Object.freeze(
    Object.defineProperty(
        {
            __proto__: null,
            CommonSelectors: B,
            ModeHandler: ModeHandler,
            StringSet: StringSet,
            constrainFeatureMovement: constrainFeatureMovement,
            createMidPoint: createMidpoint,
            createSupplementaryPoints: createSupplementaryPoints,
            createVertex: createVertex,
            doubleClickZoom: G,
            euclideanDistance: euclideanDistance,
            featuresAt: M,
            getFeatureAtAndSetCursors: getFeatureAtAndSetCursors,
            isClick: isClick,
            isEventAtCoordinates: isEventAtCoordinates,
            isTap: isTap,
            mapEventToBoundingBox: mapEventToBoundingBox,
            moveFeatures: moveFeatures,
            sortFeatures: sortFeatures,
            stringSetsAreEqual: stringSetsAreEqual,
            theme: V,
            toDenseArray: toDenseArray,
        },
        Symbol.toStringTag,
        { value: "Module" }
    )
);
const setupDraw = function (e, t) {
    e = setupOptions(e);
    const o = { options: e };
    t = setupAPI(o, t);
    o.api = t;
    const n = runSetup(o);
    t.onAdd = n.onAdd;
    t.onRemove = n.onRemove;
    t.types = c;
    t.options = e;
    return t;
};
function MapboxDraw(e) {
    setupDraw(e, this);
}
MapboxDraw.modes = te;
MapboxDraw.constants = T;
MapboxDraw.lib = se;
export { MapboxDraw as default };
