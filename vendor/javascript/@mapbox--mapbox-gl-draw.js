// @mapbox/mapbox-gl-draw@1.5.2
// from https://ga.jspm.io/npm:@mapbox/mapbox-gl-draw@1.5.2/index.js
// formatted with: npx prettier@3 --parser babel --print-width 120
//
// Local patch, re-apply on every update:
// * isLeftClick guard in the mousedown / mouseup dispatcher. Without it a right click on a
//   vertex starts a drag and the context menu never opens. Not upstream as of 1.5.2.
//
// Dropped at the 1.5.1 update and not coming back: the patch that merged parent properties
// into vertex and midpoint features (shape of upstream PR #964).

import e from "@mapbox/geojson-area";
import { customAlphabet as t } from "nanoid/non-secure";
import n from "@mapbox/point-geometry";
import { toMercator as r, toWgs84 as i } from "@turf/projection";
import a from "fast-deep-equal";
import o from "@mapbox/geojson-normalize";
const s = {
    CANVAS: `mapboxgl-canvas`,
    CONTROL_BASE: `mapboxgl-ctrl`,
    CONTROL_PREFIX: `mapboxgl-ctrl-`,
    CONTROL_BUTTON: `mapbox-gl-draw_ctrl-draw-btn`,
    CONTROL_BUTTON_LINE: `mapbox-gl-draw_line`,
    CONTROL_BUTTON_POLYGON: `mapbox-gl-draw_polygon`,
    CONTROL_BUTTON_POINT: `mapbox-gl-draw_point`,
    CONTROL_BUTTON_TRASH: `mapbox-gl-draw_trash`,
    CONTROL_BUTTON_COMBINE_FEATURES: `mapbox-gl-draw_combine`,
    CONTROL_BUTTON_UNCOMBINE_FEATURES: `mapbox-gl-draw_uncombine`,
    CONTROL_GROUP: `mapboxgl-ctrl-group`,
    ATTRIBUTION: `mapboxgl-ctrl-attrib`,
    ACTIVE_BUTTON: `active`,
    BOX_SELECT: `mapbox-gl-draw_boxselect`,
  },
  c = { HOT: `mapbox-gl-draw-hot`, COLD: `mapbox-gl-draw-cold` },
  l = { ADD: `add`, MOVE: `move`, DRAG: `drag`, POINTER: `pointer`, NONE: `none` },
  u = { POLYGON: `polygon`, LINE: `line_string`, POINT: `point` },
  d = {
    FEATURE: `Feature`,
    POLYGON: `Polygon`,
    LINE_STRING: `LineString`,
    POINT: `Point`,
    FEATURE_COLLECTION: `FeatureCollection`,
    MULTI_PREFIX: `Multi`,
    MULTI_POINT: `MultiPoint`,
    MULTI_LINE_STRING: `MultiLineString`,
    MULTI_POLYGON: `MultiPolygon`,
  },
  f = {
    DRAW_LINE_STRING: `draw_line_string`,
    DRAW_POLYGON: `draw_polygon`,
    DRAW_POINT: `draw_point`,
    SIMPLE_SELECT: `simple_select`,
    DIRECT_SELECT: `direct_select`,
  },
  p = {
    CREATE: `draw.create`,
    DELETE: `draw.delete`,
    UPDATE: `draw.update`,
    SELECTION_CHANGE: `draw.selectionchange`,
    MODE_CHANGE: `draw.modechange`,
    ACTIONABLE: `draw.actionable`,
    RENDER: `draw.render`,
    COMBINE_FEATURES: `draw.combine`,
    UNCOMBINE_FEATURES: `draw.uncombine`,
  },
  m = { MOVE: `move`, CHANGE_PROPERTIES: `change_properties`, CHANGE_COORDINATES: `change_coordinates` },
  h = { FEATURE: `feature`, MIDPOINT: `midpoint`, VERTEX: `vertex` },
  g = { ACTIVE: `true`, INACTIVE: `false` },
  ee = [`scrollZoom`, `boxZoom`, `dragRotate`, `dragPan`, `keyboard`, `doubleClickZoom`, `touchZoomRotate`],
  te = -90,
  ne = -85,
  re = 90,
  ie = 85,
  ae = -270,
  oe = 270;
var se = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.defineProperty(
    {
      __proto__: null,
      LAT_MAX: 90,
      LAT_MIN: -90,
      LAT_RENDERED_MAX: 85,
      LAT_RENDERED_MIN: -85,
      LNG_MAX: 270,
      LNG_MIN: -270,
      activeStates: g,
      classes: s,
      cursors: l,
      events: p,
      geojsonTypes: d,
      interactions: ee,
      meta: h,
      modes: f,
      sources: c,
      types: u,
      updateActions: m,
    },
    Symbol.toStringTag,
    { value: `Module` },
  ),
);
function _(e) {
  return function (t) {
    let n = t.featureTarget;
    return !n || !n.properties ? !1 : n.properties.meta === e;
  };
}
function ce(e) {
  return !e.originalEvent || !e.originalEvent.shiftKey ? !1 : e.originalEvent.button === 0;
}
function v(e) {
  return !e.featureTarget || !e.featureTarget.properties
    ? !1
    : e.featureTarget.properties.active === g.ACTIVE && e.featureTarget.properties.meta === h.FEATURE;
}
function le(e) {
  return !e.featureTarget || !e.featureTarget.properties
    ? !1
    : e.featureTarget.properties.active === g.INACTIVE && e.featureTarget.properties.meta === h.FEATURE;
}
function y(e) {
  return e.featureTarget === void 0;
}
function ue(e) {
  return !e.featureTarget || !e.featureTarget.properties ? !1 : e.featureTarget.properties.meta === h.FEATURE;
}
function b(e) {
  let t = e.featureTarget;
  return !t || !t.properties ? !1 : t.properties.meta === h.VERTEX;
}
function x(e) {
  return e.originalEvent ? e.originalEvent.shiftKey === !0 : !1;
}
function S(e) {
  return e.key === `Escape` || e.keyCode === 27;
}
function C(e) {
  return e.key === `Enter` || e.keyCode === 13;
}
function w(e) {
  return e.key === `Backspace` || e.keyCode === 8;
}
function T(e) {
  return e.key === `Delete` || e.keyCode === 46;
}
function de(e) {
  return e.key === `1` || e.keyCode === 49;
}
function fe(e) {
  return e.key === `2` || e.keyCode === 50;
}
function pe(e) {
  return e.key === `3` || e.keyCode === 51;
}
function me(e) {
  let t = e.key || String.fromCharCode(e.keyCode);
  return t >= `0` && t <= `9`;
}
function he() {
  return !0;
}
var ge = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.defineProperty(
    {
      __proto__: null,
      isActiveFeature: v,
      isBackspaceKey: w,
      isDeleteKey: T,
      isDigit1Key: de,
      isDigit2Key: fe,
      isDigit3Key: pe,
      isDigitKey: me,
      isEnterKey: C,
      isEscapeKey: S,
      isFeature: ue,
      isInactiveFeature: le,
      isOfMetaType: _,
      isShiftDown: x,
      isShiftMousedown: ce,
      isTrue: he,
      isVertex: b,
      noTarget: y,
    },
    Symbol.toStringTag,
    { value: `Module` },
  ),
);
const _e = { Point: 0, LineString: 1, MultiLineString: 1, Polygon: 2 },
  ve = { vertex: 0, midpoint: 1, feature: 2 };
function ye(e, t) {
  let n = _e[e.geometry.type] - _e[t.geometry.type];
  return n === 0 && e.geometry.type === d.POLYGON
    ? e.area - t.area
    : n === 0 && e.geometry.type === d.POINT
      ? ve[e.properties.meta] - ve[t.properties.meta]
      : n;
}
function be(t) {
  return t
    .map(
      (t) => (
        t.geometry.type === d.POLYGON && (t.area = e.geometry({ type: d.FEATURE, property: {}, geometry: t.geometry })),
        t
      ),
    )
    .sort(ye)
    .map((e) => (delete e.area, e));
}
function xe(e, t = 0) {
  return [
    [e.point.x - t, e.point.y - t],
    [e.point.x + t, e.point.y + t],
  ];
}
function E(e) {
  if (((this._items = {}), (this._nums = {}), (this._length = e ? e.length : 0), e))
    for (let t = 0, n = e.length; t < n; t++)
      (this.add(e[t]), e[t] !== void 0 && (typeof e[t] == `string` ? (this._items[e[t]] = t) : (this._nums[e[t]] = t)));
}
((E.prototype.add = function (e) {
  return this.has(e)
    ? this
    : (this._length++, typeof e == `string` ? (this._items[e] = this._length) : (this._nums[e] = this._length), this);
}),
  (E.prototype.delete = function (e) {
    return this.has(e) === !1 ? this : (this._length--, delete this._items[e], delete this._nums[e], this);
  }),
  (E.prototype.has = function (e) {
    return typeof e != `string` && typeof e != `number` ? !1 : this._items[e] !== void 0 || this._nums[e] !== void 0;
  }),
  (E.prototype.values = function () {
    let e = [];
    return (
      Object.keys(this._items).forEach((t) => {
        e.push({ k: t, v: this._items[t] });
      }),
      Object.keys(this._nums).forEach((t) => {
        e.push({ k: JSON.parse(t), v: this._nums[t] });
      }),
      e.sort((e, t) => e.v - t.v).map((e) => e.k)
    );
  }),
  (E.prototype.clear = function () {
    return ((this._length = 0), (this._items = {}), (this._nums = {}), this);
  }));
const Se = [h.FEATURE, h.MIDPOINT, h.VERTEX];
var D = { click: Ce, touch: we };
function Ce(e, t, n) {
  return Te(e, t, n, n.options.clickBuffer);
}
function we(e, t, n) {
  return Te(e, t, n, n.options.touchBuffer);
}
function Te(e, t, n, r) {
  if (n.map === null) return [];
  let i = e ? xe(e, r) : t,
    a = {};
  n.options.styles && (a.layers = n.options.styles.map((e) => e.id).filter((e) => n.map.getLayer(e) != null));
  let o = n.map.queryRenderedFeatures(i, a).filter((e) => Se.indexOf(e.properties.meta) !== -1),
    s = new E(),
    c = [];
  return (
    o.forEach((e) => {
      let t = e.properties.id;
      s.has(t) || (s.add(t), c.push(e));
    }),
    be(c)
  );
}
function O(e, t) {
  let n = D.click(e, null, t),
    r = { mouse: l.NONE };
  return (
    n[0] && ((r.mouse = n[0].properties.active === g.ACTIVE ? l.MOVE : l.POINTER), (r.feature = n[0].properties.meta)),
    t.events.currentModeName().indexOf(`draw`) !== -1 && (r.mouse = l.ADD),
    t.ui.queueMapClasses(r),
    t.ui.updateMapClasses(),
    n[0]
  );
}
function Ee(e, t) {
  let n = e.x - t.x,
    r = e.y - t.y;
  return Math.sqrt(n * n + r * r);
}
const De = 4,
  Oe = 12,
  ke = 500;
function k(e, t, n = {}) {
  let r = n.fineTolerance == null ? 4 : n.fineTolerance,
    i = n.grossTolerance == null ? 12 : n.grossTolerance,
    a = n.interval == null ? 500 : n.interval;
  ((e.point = e.point || t.point), (e.time = e.time || t.time));
  let o = Ee(e.point, t.point);
  return o < r || (o < i && t.time - e.time < a);
}
const Ae = 25,
  je = 250;
function Me(e, t, n = {}) {
  let r = n.tolerance == null ? 25 : n.tolerance,
    i = n.interval == null ? 250 : n.interval;
  return ((e.point = e.point || t.point), (e.time = e.time || t.time), Ee(e.point, t.point) < r && t.time - e.time < i);
}
const Ne = function (e, t) {
    let n = {
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
      },
      r = {
        on(e, t, r) {
          if (n[e] === void 0) throw Error(`Invalid event type: ${e}`);
          n[e].push({ selector: t, fn: r });
        },
        render(e) {
          t.store.featureChanged(e);
        },
      },
      i = function (e, i) {
        let a = n[e],
          o = a.length;
        for (; o--;) {
          let e = a[o];
          if (e.selector(i)) {
            (e.fn.call(r, i) || t.store.render(), t.ui.updateMapClasses());
            break;
          }
        }
      };
    return (
      e.start.call(r),
      {
        render: e.render,
        stop() {
          e.stop && e.stop();
        },
        trash() {
          e.trash && (e.trash(), t.store.render());
        },
        combineFeatures() {
          e.combineFeatures && e.combineFeatures();
        },
        uncombineFeatures() {
          e.uncombineFeatures && e.uncombineFeatures();
        },
        drag(e) {
          i(`drag`, e);
        },
        click(e) {
          i(`click`, e);
        },
        mousemove(e) {
          i(`mousemove`, e);
        },
        mousedown(e) {
          i(`mousedown`, e);
        },
        mouseup(e) {
          i(`mouseup`, e);
        },
        mouseout(e) {
          i(`mouseout`, e);
        },
        keydown(e) {
          i(`keydown`, e);
        },
        keyup(e) {
          i(`keyup`, e);
        },
        touchstart(e) {
          i(`touchstart`, e);
        },
        touchmove(e) {
          i(`touchmove`, e);
        },
        touchend(e) {
          i(`touchend`, e);
        },
        tap(e) {
          i(`tap`, e);
        },
      }
    );
  },
  Pe = t(`0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`, 32);
function Fe() {
  return Pe();
}
const A = function (e, t) {
  ((this.ctx = e),
    (this.properties = t.properties || {}),
    (this.coordinates = t.geometry.coordinates),
    (this.id = t.id || Fe()),
    (this.type = t.geometry.type));
};
((A.prototype.changed = function () {
  this.ctx.store.featureChanged(this.id);
}),
  (A.prototype.incomingCoords = function (e) {
    this.setCoordinates(e);
  }),
  (A.prototype.setCoordinates = function (e) {
    ((this.coordinates = e), this.changed());
  }),
  (A.prototype.getCoordinates = function () {
    return JSON.parse(JSON.stringify(this.coordinates));
  }),
  (A.prototype.setProperty = function (e, t) {
    this.properties[e] = t;
  }),
  (A.prototype.toGeoJSON = function () {
    return JSON.parse(
      JSON.stringify({
        id: this.id,
        type: d.FEATURE,
        properties: this.properties,
        geometry: { coordinates: this.getCoordinates(), type: this.type },
      }),
    );
  }),
  (A.prototype.internal = function (e) {
    let t = { id: this.id, meta: h.FEATURE, "meta:type": this.type, active: g.INACTIVE, mode: e };
    if (this.ctx.options.userProperties) for (let e in this.properties) t[`user_${e}`] = this.properties[e];
    return { type: d.FEATURE, properties: t, geometry: { coordinates: this.getCoordinates(), type: this.type } };
  }));
const j = function (e, t) {
  A.call(this, e, t);
};
((j.prototype = Object.create(A.prototype)),
  (j.prototype.isValid = function () {
    return typeof this.coordinates[0] == `number` && typeof this.coordinates[1] == `number`;
  }),
  (j.prototype.updateCoordinate = function (e, t, n) {
    (arguments.length === 3 ? (this.coordinates = [t, n]) : (this.coordinates = [e, t]), this.changed());
  }),
  (j.prototype.getCoordinate = function () {
    return this.getCoordinates();
  }));
const M = function (e, t) {
  A.call(this, e, t);
};
((M.prototype = Object.create(A.prototype)),
  (M.prototype.isValid = function () {
    return this.coordinates.length > 1;
  }),
  (M.prototype.addCoordinate = function (e, t, n) {
    this.changed();
    let r = parseInt(e, 10);
    this.coordinates.splice(r, 0, [t, n]);
  }),
  (M.prototype.getCoordinate = function (e) {
    let t = parseInt(e, 10);
    return JSON.parse(JSON.stringify(this.coordinates[t]));
  }),
  (M.prototype.removeCoordinate = function (e) {
    (this.changed(), this.coordinates.splice(parseInt(e, 10), 1));
  }),
  (M.prototype.updateCoordinate = function (e, t, n) {
    let r = parseInt(e, 10);
    ((this.coordinates[r] = [t, n]), this.changed());
  }));
const N = function (e, t) {
  (A.call(this, e, t), (this.coordinates = this.coordinates.map((e) => e.slice(0, -1))));
};
((N.prototype = Object.create(A.prototype)),
  (N.prototype.isValid = function () {
    return this.coordinates.length === 0 ? !1 : this.coordinates.every((e) => e.length > 2);
  }),
  (N.prototype.incomingCoords = function (e) {
    ((this.coordinates = e.map((e) => e.slice(0, -1))), this.changed());
  }),
  (N.prototype.setCoordinates = function (e) {
    ((this.coordinates = e), this.changed());
  }),
  (N.prototype.addCoordinate = function (e, t, n) {
    this.changed();
    let r = e.split(`.`).map((e) => parseInt(e, 10));
    this.coordinates[r[0]].splice(r[1], 0, [t, n]);
  }),
  (N.prototype.removeCoordinate = function (e) {
    this.changed();
    let t = e.split(`.`).map((e) => parseInt(e, 10)),
      n = this.coordinates[t[0]];
    n && (n.splice(t[1], 1), n.length < 3 && this.coordinates.splice(t[0], 1));
  }),
  (N.prototype.getCoordinate = function (e) {
    let t = e.split(`.`).map((e) => parseInt(e, 10)),
      n = this.coordinates[t[0]];
    return JSON.parse(JSON.stringify(n[t[1]]));
  }),
  (N.prototype.getCoordinates = function () {
    return this.coordinates.map((e) => e.concat([e[0]]));
  }),
  (N.prototype.updateCoordinate = function (e, t, n) {
    this.changed();
    let r = e.split(`.`),
      i = parseInt(r[0], 10),
      a = parseInt(r[1], 10);
    (this.coordinates[i] === void 0 && (this.coordinates[i] = []), (this.coordinates[i][a] = [t, n]));
  }));
const Ie = { MultiPoint: j, MultiLineString: M, MultiPolygon: N },
  P = (e, t, n, r, i) => {
    let a = n.split(`.`),
      o = parseInt(a[0], 10),
      s = a[1] ? a.slice(1).join(`.`) : null;
    return e[o][t](s, r, i);
  },
  F = function (e, t) {
    if ((A.call(this, e, t), delete this.coordinates, (this.model = Ie[t.geometry.type]), this.model === void 0))
      throw TypeError(`${t.geometry.type} is not a valid type`);
    this.features = this._coordinatesToFeatures(t.geometry.coordinates);
  };
((F.prototype = Object.create(A.prototype)),
  (F.prototype._coordinatesToFeatures = function (e) {
    let t = this.model.bind(this);
    return e.map(
      (e) =>
        new t(this.ctx, {
          id: Fe(),
          type: d.FEATURE,
          properties: {},
          geometry: { coordinates: e, type: this.type.replace(`Multi`, ``) },
        }),
    );
  }),
  (F.prototype.isValid = function () {
    return this.features.every((e) => e.isValid());
  }),
  (F.prototype.setCoordinates = function (e) {
    ((this.features = this._coordinatesToFeatures(e)), this.changed());
  }),
  (F.prototype.getCoordinate = function (e) {
    return P(this.features, `getCoordinate`, e);
  }),
  (F.prototype.getCoordinates = function () {
    return JSON.parse(
      JSON.stringify(this.features.map((e) => (e.type === d.POLYGON ? e.getCoordinates() : e.coordinates))),
    );
  }),
  (F.prototype.updateCoordinate = function (e, t, n) {
    (P(this.features, `updateCoordinate`, e, t, n), this.changed());
  }),
  (F.prototype.addCoordinate = function (e, t, n) {
    (P(this.features, `addCoordinate`, e, t, n), this.changed());
  }),
  (F.prototype.removeCoordinate = function (e) {
    (P(this.features, `removeCoordinate`, e), this.changed());
  }),
  (F.prototype.getFeatures = function () {
    return this.features;
  }));
function I(e) {
  ((this.map = e.map), (this.drawConfig = JSON.parse(JSON.stringify(e.options || {}))), (this._ctx = e));
}
((I.prototype.setSelected = function (e) {
  return this._ctx.store.setSelected(e);
}),
  (I.prototype.setSelectedCoordinates = function (e) {
    (this._ctx.store.setSelectedCoordinates(e),
      e.reduce(
        (e, t) => (
          e[t.feature_id] === void 0 && ((e[t.feature_id] = !0), this._ctx.store.get(t.feature_id).changed()),
          e
        ),
        {},
      ));
  }),
  (I.prototype.getSelected = function () {
    return this._ctx.store.getSelected();
  }),
  (I.prototype.getSelectedIds = function () {
    return this._ctx.store.getSelectedIds();
  }),
  (I.prototype.isSelected = function (e) {
    return this._ctx.store.isSelected(e);
  }),
  (I.prototype.getFeature = function (e) {
    return this._ctx.store.get(e);
  }),
  (I.prototype.select = function (e) {
    return this._ctx.store.select(e);
  }),
  (I.prototype.deselect = function (e) {
    return this._ctx.store.deselect(e);
  }),
  (I.prototype.deleteFeature = function (e, t = {}) {
    return this._ctx.store.delete(e, t);
  }),
  (I.prototype.addFeature = function (e, t = {}) {
    return this._ctx.store.add(e, t);
  }),
  (I.prototype.clearSelectedFeatures = function () {
    return this._ctx.store.clearSelected();
  }),
  (I.prototype.clearSelectedCoordinates = function () {
    return this._ctx.store.clearSelectedCoordinates();
  }),
  (I.prototype.setActionableState = function (e = {}) {
    let t = {
      trash: e.trash || !1,
      combineFeatures: e.combineFeatures || !1,
      uncombineFeatures: e.uncombineFeatures || !1,
    };
    return this._ctx.events.actionable(t);
  }),
  (I.prototype.changeMode = function (e, t = {}, n = {}) {
    return this._ctx.events.changeMode(e, t, n);
  }),
  (I.prototype.fire = function (e, t) {
    return this._ctx.events.fire(e, t);
  }),
  (I.prototype.updateUIClasses = function (e) {
    return this._ctx.ui.queueMapClasses(e);
  }),
  (I.prototype.activateUIButton = function (e) {
    return this._ctx.ui.setActiveButton(e);
  }),
  (I.prototype.featuresAt = function (e, t, n = `click`) {
    if (n !== `click` && n !== `touch`) throw Error(`invalid buffer type`);
    return D[n](e, t, this._ctx);
  }),
  (I.prototype.newFeature = function (e) {
    let t = e.geometry.type;
    return t === d.POINT
      ? new j(this._ctx, e)
      : t === d.LINE_STRING
        ? new M(this._ctx, e)
        : t === d.POLYGON
          ? new N(this._ctx, e)
          : new F(this._ctx, e);
  }),
  (I.prototype.isInstanceOf = function (e, t) {
    if (e === d.POINT) return t instanceof j;
    if (e === d.LINE_STRING) return t instanceof M;
    if (e === d.POLYGON) return t instanceof N;
    if (e === `MultiFeature`) return t instanceof F;
    throw Error(`Unknown feature class: ${e}`);
  }),
  (I.prototype.doRender = function (e) {
    return this._ctx.store.featureChanged(e);
  }),
  (I.prototype.onSetup = function () {}),
  (I.prototype.onDrag = function () {}),
  (I.prototype.onClick = function () {}),
  (I.prototype.onMouseMove = function () {}),
  (I.prototype.onMouseDown = function () {}),
  (I.prototype.onMouseUp = function () {}),
  (I.prototype.onMouseOut = function () {}),
  (I.prototype.onKeyUp = function () {}),
  (I.prototype.onKeyDown = function () {}),
  (I.prototype.onTouchStart = function () {}),
  (I.prototype.onTouchMove = function () {}),
  (I.prototype.onTouchEnd = function () {}),
  (I.prototype.onTap = function () {}),
  (I.prototype.onStop = function () {}),
  (I.prototype.onTrash = function () {}),
  (I.prototype.onCombineFeature = function () {}),
  (I.prototype.onUncombineFeature = function () {}),
  (I.prototype.toDisplayFeatures = function () {
    throw Error(`You must overwrite toDisplayFeatures`);
  }));
const Le = {
    drag: `onDrag`,
    click: `onClick`,
    mousemove: `onMouseMove`,
    mousedown: `onMouseDown`,
    mouseup: `onMouseUp`,
    mouseout: `onMouseOut`,
    keyup: `onKeyUp`,
    keydown: `onKeyDown`,
    touchstart: `onTouchStart`,
    touchmove: `onTouchMove`,
    touchend: `onTouchEnd`,
    tap: `onTap`,
  },
  Re = Object.keys(Le);
function ze(e) {
  let t = Object.keys(e);
  return function (n, r = {}) {
    let i = {},
      a = t.reduce((t, n) => ((t[n] = e[n]), t), new I(n));
    function o(e) {
      return (t) => a[e](i, t);
    }
    return {
      start() {
        ((i = a.onSetup(r)),
          Re.forEach((t) => {
            let n = Le[t],
              r = () => !1;
            (e[n] && (r = () => !0), this.on(t, r, o(n)));
          }));
      },
      stop() {
        a.onStop(i);
      },
      trash() {
        a.onTrash(i);
      },
      combineFeatures() {
        a.onCombineFeatures(i);
      },
      uncombineFeatures() {
        a.onUncombineFeatures(i);
      },
      render(e, t) {
        a.toDisplayFeatures(i, e, t);
      },
    };
  };
}
function Be(e) {
  let t = Object.keys(e.options.modes).reduce((t, n) => ((t[n] = ze(e.options.modes[n])), t), {}),
    n = {},
    r = {},
    i = {},
    a = null,
    o = null;
  const isLeftClick = (e) => {
    const originalEvent = e?.originalEvent;
    if (!originalEvent) { return true; }
    if ('button' in originalEvent) { return originalEvent.button === 0; }
    if ('buttons' in originalEvent) { return originalEvent.buttons === 1; }
    return true;
  };
  ((i.drag = function (t, n) {
    n({ point: t.point, time: /* @__PURE__ */ new Date().getTime() })
      ? (e.ui.queueMapClasses({ mouse: l.DRAG }), o.drag(t))
      : t.originalEvent.stopPropagation();
  }),
    (i.mousedrag = function (e) {
      i.drag(e, (e) => !k(n, e));
    }),
    (i.touchdrag = function (e) {
      i.drag(e, (e) => !Me(r, e));
    }),
    (i.mousemove = function (t) {
      if ((t.originalEvent.buttons === void 0 ? t.originalEvent.which : t.originalEvent.buttons) === 1)
        return i.mousedrag(t);
      ((t.featureTarget = O(t, e)), o.mousemove(t));
    }),
    (i.mousedown = function (t) {
      if (!isLeftClick(t)) return;
      ((n = { time: /* @__PURE__ */ new Date().getTime(), point: t.point }),
        (t.featureTarget = O(t, e)),
        o.mousedown(t));
    }),
    (i.mouseup = function (t) {
      if (!isLeftClick(t)) return;
      ((t.featureTarget = O(t, e)),
        k(n, { point: t.point, time: /* @__PURE__ */ new Date().getTime() }) ? o.click(t) : o.mouseup(t));
    }),
    (i.mouseout = function (e) {
      o.mouseout(e);
    }),
    (i.touchstart = function (t) {
      e.options.touchEnabled &&
        ((r = { time: /* @__PURE__ */ new Date().getTime(), point: t.point }),
        (t.featureTarget = D.touch(t, null, e)[0]),
        o.touchstart(t));
    }),
    (i.touchmove = function (t) {
      if (e.options.touchEnabled) return (o.touchmove(t), i.touchdrag(t));
    }),
    (i.touchend = function (t) {
      (t.originalEvent.preventDefault(),
        e.options.touchEnabled &&
          ((t.featureTarget = D.touch(t, null, e)[0]),
          Me(r, { time: /* @__PURE__ */ new Date().getTime(), point: t.point }) ? o.tap(t) : o.touchend(t)));
    }));
  let c = (e) => {
    let t = w(e),
      n = T(e),
      r = me(e);
    return !(t || n || r);
  };
  ((i.keydown = function (t) {
    (t.srcElement || t.target).classList.contains(s.CANVAS) &&
      ((w(t) || T(t)) && e.options.controls.trash
        ? (t.preventDefault(), o.trash())
        : c(t)
          ? o.keydown(t)
          : de(t) && e.options.controls.point
            ? u(f.DRAW_POINT)
            : fe(t) && e.options.controls.line_string
              ? u(f.DRAW_LINE_STRING)
              : pe(t) && e.options.controls.polygon && u(f.DRAW_POLYGON));
  }),
    (i.keyup = function (e) {
      c(e) && o.keyup(e);
    }),
    (i.zoomend = function () {
      e.store.changeZoom();
    }),
    (i.data = function (t) {
      if (t.dataType === `style`) {
        let { setup: t, map: n, options: r, store: i } = e;
        r.styles.some((e) => n.getLayer(e.id)) || (t.addLayers(), i.setDirty(), i.render());
      }
    }));
  function u(n, r, i = {}) {
    o.stop();
    let s = t[n];
    if (s === void 0) throw Error(`${n} is not valid`);
    ((a = n),
      (o = Ne(s(e, r), e)),
      i.silent || e.map.fire(p.MODE_CHANGE, { mode: n }),
      e.store.setDirty(),
      e.store.render());
  }
  let d = { trash: !1, combineFeatures: !1, uncombineFeatures: !1 };
  function m(t) {
    let n = !1;
    (Object.keys(t).forEach((e) => {
      if (d[e] === void 0) throw Error(`Invalid action type`);
      (d[e] !== t[e] && (n = !0), (d[e] = t[e]));
    }),
      n && e.map.fire(p.ACTIONABLE, { actions: d }));
  }
  return {
    start() {
      ((a = e.options.defaultMode), (o = Ne(t[a](e), e)));
    },
    changeMode: u,
    actionable: m,
    currentModeName() {
      return a;
    },
    currentModeRender(e, t) {
      return o.render(e, t);
    },
    fire(t, n) {
      e.map && e.map.fire(t, n);
    },
    addEventListeners() {
      (e.map.on(`mousemove`, i.mousemove),
        e.map.on(`mousedown`, i.mousedown),
        e.map.on(`mouseup`, i.mouseup),
        e.map.on(`data`, i.data),
        e.map.on(`touchmove`, i.touchmove),
        e.map.on(`touchstart`, i.touchstart),
        e.map.on(`touchend`, i.touchend),
        e.container.addEventListener(`mouseout`, i.mouseout),
        e.options.keybindings &&
          (e.container.addEventListener(`keydown`, i.keydown), e.container.addEventListener(`keyup`, i.keyup)));
    },
    removeEventListeners() {
      (e.map.off(`mousemove`, i.mousemove),
        e.map.off(`mousedown`, i.mousedown),
        e.map.off(`mouseup`, i.mouseup),
        e.map.off(`data`, i.data),
        e.map.off(`touchmove`, i.touchmove),
        e.map.off(`touchstart`, i.touchstart),
        e.map.off(`touchend`, i.touchend),
        e.container.removeEventListener(`mouseout`, i.mouseout),
        e.options.keybindings &&
          (e.container.removeEventListener(`keydown`, i.keydown), e.container.removeEventListener(`keyup`, i.keyup)));
    },
    trash(e) {
      o.trash(e);
    },
    combineFeatures() {
      o.combineFeatures();
    },
    uncombineFeatures() {
      o.uncombineFeatures();
    },
    getMode() {
      return a;
    },
  };
}
function L(e) {
  return [].concat(e).filter((e) => e !== void 0);
}
function Ve() {
  let e = this;
  if (!(e.ctx.map && e.ctx.map.getSource(c.HOT) !== void 0)) return s();
  let t = e.ctx.events.currentModeName();
  e.ctx.ui.queueMapClasses({ mode: t });
  let n = [],
    r = [];
  (e.isDirty
    ? (r = e.getAllIds())
    : ((n = e.getChangedIds().filter((t) => e.get(t) !== void 0)),
      (r = e.sources.hot
        .filter((t) => t.properties.id && n.indexOf(t.properties.id) === -1 && e.get(t.properties.id) !== void 0)
        .map((e) => e.properties.id))),
    (e.sources.hot = []));
  let i = e.sources.cold.length;
  e.sources.cold = e.isDirty
    ? []
    : e.sources.cold.filter((e) => {
        let t = e.properties.id || e.properties.parent;
        return n.indexOf(t) === -1;
      });
  let a = i !== e.sources.cold.length || r.length > 0;
  (n.forEach((e) => o(e, `hot`)), r.forEach((e) => o(e, `cold`)));
  function o(n, r) {
    let i = e.get(n).internal(t);
    e.ctx.events.currentModeRender(i, (n) => {
      ((n.properties.mode = t), e.sources[r].push(n));
    });
  }
  (a && e.ctx.map.getSource(c.COLD).setData({ type: d.FEATURE_COLLECTION, features: e.sources.cold }),
    e.ctx.map.getSource(c.HOT).setData({ type: d.FEATURE_COLLECTION, features: e.sources.hot }),
    s());
  function s() {
    ((e.isDirty = !1), e.clearChangedIds());
  }
}
function R(e) {
  ((this._features = {}),
    (this._featureIds = new E()),
    (this._selectedFeatureIds = new E()),
    (this._selectedCoordinates = []),
    (this._changedFeatureIds = new E()),
    (this._emitSelectionChange = !1),
    (this._mapInitialConfig = {}),
    (this.ctx = e),
    (this.sources = { hot: [], cold: [] }));
  let t;
  ((this.render = () => {
    t ||
      (t = requestAnimationFrame(() => {
        ((t = null),
          Ve.call(this),
          this._emitSelectionChange &&
            (this.ctx.events.fire(p.SELECTION_CHANGE, {
              features: this.getSelected().map((e) => e.toGeoJSON()),
              points: this.getSelectedCoordinates().map((e) => ({
                type: d.FEATURE,
                properties: {},
                geometry: { type: d.POINT, coordinates: e.coordinates },
              })),
            }),
            (this._emitSelectionChange = !1)),
          this.ctx.events.fire(p.RENDER, {}));
      }));
  }),
    (this.isDirty = !1));
}
((R.prototype.createRenderBatch = function () {
  let e = this.render,
    t = 0;
  return (
    (this.render = function () {
      t++;
    }),
    () => {
      ((this.render = e), t > 0 && this.render());
    }
  );
}),
  (R.prototype.setDirty = function () {
    return ((this.isDirty = !0), this);
  }),
  (R.prototype.featureCreated = function (e, t = {}) {
    if ((this._changedFeatureIds.add(e), (t.silent == null ? this.ctx.options.suppressAPIEvents : t.silent) !== !0)) {
      let t = this.get(e);
      this.ctx.events.fire(p.CREATE, { features: [t.toGeoJSON()] });
    }
    return this;
  }),
  (R.prototype.featureChanged = function (e, t = {}) {
    return (
      this._changedFeatureIds.add(e),
      (t.silent == null ? this.ctx.options.suppressAPIEvents : t.silent) !== !0 &&
        this.ctx.events.fire(p.UPDATE, {
          action: t.action ? t.action : m.CHANGE_COORDINATES,
          features: [this.get(e).toGeoJSON()],
        }),
      this
    );
  }),
  (R.prototype.getChangedIds = function () {
    return this._changedFeatureIds.values();
  }),
  (R.prototype.clearChangedIds = function () {
    return (this._changedFeatureIds.clear(), this);
  }),
  (R.prototype.getAllIds = function () {
    return this._featureIds.values();
  }),
  (R.prototype.add = function (e, t = {}) {
    return (
      (this._features[e.id] = e),
      this._featureIds.add(e.id),
      this.featureCreated(e.id, { silent: t.silent }),
      this
    );
  }),
  (R.prototype.delete = function (e, t = {}) {
    let n = [];
    return (
      L(e).forEach((e) => {
        this._featureIds.has(e) &&
          (this._featureIds.delete(e),
          this._selectedFeatureIds.delete(e),
          t.silent || (n.indexOf(this._features[e]) === -1 && n.push(this._features[e].toGeoJSON())),
          delete this._features[e],
          (this.isDirty = !0));
      }),
      n.length && this.ctx.events.fire(p.DELETE, { features: n }),
      He(this, t),
      this
    );
  }),
  (R.prototype.get = function (e) {
    return this._features[e];
  }),
  (R.prototype.getAll = function () {
    return Object.keys(this._features).map((e) => this._features[e]);
  }),
  (R.prototype.select = function (e, t = {}) {
    return (
      L(e).forEach((e) => {
        this._selectedFeatureIds.has(e) ||
          (this._selectedFeatureIds.add(e),
          this._changedFeatureIds.add(e),
          t.silent || (this._emitSelectionChange = !0));
      }),
      this
    );
  }),
  (R.prototype.deselect = function (e, t = {}) {
    return (
      L(e).forEach((e) => {
        this._selectedFeatureIds.has(e) &&
          (this._selectedFeatureIds.delete(e),
          this._changedFeatureIds.add(e),
          t.silent || (this._emitSelectionChange = !0));
      }),
      He(this, t),
      this
    );
  }),
  (R.prototype.clearSelected = function (e = {}) {
    return (this.deselect(this._selectedFeatureIds.values(), { silent: e.silent }), this);
  }),
  (R.prototype.setSelected = function (e, t = {}) {
    return (
      (e = L(e)),
      this.deselect(
        this._selectedFeatureIds.values().filter((t) => e.indexOf(t) === -1),
        { silent: t.silent },
      ),
      this.select(
        e.filter((e) => !this._selectedFeatureIds.has(e)),
        { silent: t.silent },
      ),
      this
    );
  }),
  (R.prototype.setSelectedCoordinates = function (e) {
    return ((this._selectedCoordinates = e), (this._emitSelectionChange = !0), this);
  }),
  (R.prototype.clearSelectedCoordinates = function () {
    return ((this._selectedCoordinates = []), (this._emitSelectionChange = !0), this);
  }),
  (R.prototype.getSelectedIds = function () {
    return this._selectedFeatureIds.values();
  }),
  (R.prototype.getSelected = function () {
    return this.getSelectedIds().map((e) => this.get(e));
  }),
  (R.prototype.getSelectedCoordinates = function () {
    return this._selectedCoordinates.map((e) => ({ coordinates: this.get(e.feature_id).getCoordinate(e.coord_path) }));
  }),
  (R.prototype.isSelected = function (e) {
    return this._selectedFeatureIds.has(e);
  }),
  (R.prototype.setFeatureProperty = function (e, t, n, r = {}) {
    (this.get(e).setProperty(t, n), this.featureChanged(e, { silent: r.silent, action: m.CHANGE_PROPERTIES }));
  }));
function He(e, t = {}) {
  let n = e._selectedCoordinates.filter((t) => e._selectedFeatureIds.has(t.feature_id));
  (e._selectedCoordinates.length !== n.length && !t.silent && (e._emitSelectionChange = !0),
    (e._selectedCoordinates = n));
}
((R.prototype.storeMapConfig = function () {
  ee.forEach((e) => {
    this.ctx.map[e] && (this._mapInitialConfig[e] = this.ctx.map[e].isEnabled());
  });
}),
  (R.prototype.restoreMapConfig = function () {
    Object.keys(this._mapInitialConfig).forEach((e) => {
      this._mapInitialConfig[e] ? this.ctx.map[e].enable() : this.ctx.map[e].disable();
    });
  }),
  (R.prototype.getInitialConfigValue = function (e) {
    return this._mapInitialConfig[e] === void 0 ? !0 : this._mapInitialConfig[e];
  }));
const Ue = [`mode`, `feature`, `mouse`];
function We(e) {
  let t = {},
    n = null,
    r = { mode: null, feature: null, mouse: null },
    i = { mode: null, feature: null, mouse: null };
  function a() {
    (o({ mode: null, feature: null, mouse: null }), c());
  }
  function o(e) {
    i = Object.assign(i, e);
  }
  function c() {
    if (!e.container) return;
    let t = [],
      n = [];
    (Ue.forEach((e) => {
      i[e] !== r[e] && (t.push(`${e}-${r[e]}`), i[e] !== null && n.push(`${e}-${i[e]}`));
    }),
      t.length > 0 && e.container.classList.remove(...t),
      n.length > 0 && e.container.classList.add(...n),
      (r = Object.assign(r, i)));
  }
  function l(e, t = {}) {
    let r = document.createElement(`button`);
    return (
      (r.className = `${s.CONTROL_BUTTON} ${t.className}`),
      r.setAttribute(`title`, t.title),
      t.container.appendChild(r),
      r.addEventListener(
        `click`,
        (r) => {
          if ((r.preventDefault(), r.stopPropagation(), r.target === n)) {
            (d(), t.onDeactivate());
            return;
          }
          (p(e), t.onActivate());
        },
        !0,
      ),
      r
    );
  }
  function d() {
    n && (n.classList.remove(s.ACTIVE_BUTTON), (n = null));
  }
  function p(e) {
    d();
    let r = t[e];
    r && r && e !== `trash` && (r.classList.add(s.ACTIVE_BUTTON), (n = r));
  }
  function m() {
    let n = e.options.controls,
      r = document.createElement(`div`);
    return (
      (r.className = `${s.CONTROL_GROUP} ${s.CONTROL_BASE}`),
      n
        ? (n[u.POINT] &&
            (t[u.POINT] = l(u.POINT, {
              container: r,
              className: s.CONTROL_BUTTON_POINT,
              title: `Marker tool ${e.options.keybindings ? `(1)` : ``}`,
              onActivate: () => e.events.changeMode(f.DRAW_POINT),
              onDeactivate: () => e.events.trash(),
            })),
          n[u.LINE] &&
            (t[u.LINE] = l(u.LINE, {
              container: r,
              className: s.CONTROL_BUTTON_LINE,
              title: `LineString tool ${e.options.keybindings ? `(2)` : ``}`,
              onActivate: () => e.events.changeMode(f.DRAW_LINE_STRING),
              onDeactivate: () => e.events.trash(),
            })),
          n[u.POLYGON] &&
            (t[u.POLYGON] = l(u.POLYGON, {
              container: r,
              className: s.CONTROL_BUTTON_POLYGON,
              title: `Polygon tool ${e.options.keybindings ? `(3)` : ``}`,
              onActivate: () => e.events.changeMode(f.DRAW_POLYGON),
              onDeactivate: () => e.events.trash(),
            })),
          n.trash &&
            (t.trash = l(`trash`, {
              container: r,
              className: s.CONTROL_BUTTON_TRASH,
              title: `Delete`,
              onActivate: () => {
                e.events.trash();
              },
            })),
          n.combine_features &&
            (t.combine_features = l(`combineFeatures`, {
              container: r,
              className: s.CONTROL_BUTTON_COMBINE_FEATURES,
              title: `Combine`,
              onActivate: () => {
                e.events.combineFeatures();
              },
            })),
          n.uncombine_features &&
            (t.uncombine_features = l(`uncombineFeatures`, {
              container: r,
              className: s.CONTROL_BUTTON_UNCOMBINE_FEATURES,
              title: `Uncombine`,
              onActivate: () => {
                e.events.uncombineFeatures();
              },
            })),
          r)
        : r
    );
  }
  function h() {
    Object.keys(t).forEach((e) => {
      let n = t[e];
      (n.parentNode && n.parentNode.removeChild(n), delete t[e]);
    });
  }
  return {
    setActiveButton: p,
    queueMapClasses: o,
    updateMapClasses: c,
    clearMapClasses: a,
    addButtons: m,
    removeButtons: h,
  };
}
function Ge(e) {
  let t = null,
    n = null,
    r = {
      onRemove() {
        return (
          e.map.off(`load`, r.connect),
          clearInterval(n),
          r.removeLayers(),
          e.store.restoreMapConfig(),
          e.ui.removeButtons(),
          e.events.removeEventListeners(),
          e.ui.clearMapClasses(),
          e.boxZoomInitial && e.map.boxZoom.enable(),
          (e.map = null),
          (e.container = null),
          (e.store = null),
          t && t.parentNode && t.parentNode.removeChild(t),
          (t = null),
          this
        );
      },
      connect() {
        (e.map.off(`load`, r.connect),
          clearInterval(n),
          r.addLayers(),
          e.store.storeMapConfig(),
          e.events.addEventListeners());
      },
      onAdd(i) {
        if (
          ((e.map = i),
          (e.events = Be(e)),
          (e.ui = We(e)),
          (e.container = i.getContainer()),
          (e.store = new R(e)),
          (t = e.ui.addButtons()),
          e.options.boxSelect)
        ) {
          ((e.boxZoomInitial = i.boxZoom.isEnabled()), i.boxZoom.disable());
          let t = i.dragPan.isEnabled();
          (i.dragPan.disable(), i.dragPan.enable(), t || i.dragPan.disable());
        }
        return (
          i.loaded()
            ? r.connect()
            : (i.on(`load`, r.connect),
              (n = setInterval(() => {
                i.loaded() && r.connect();
              }, 16))),
          e.events.start(),
          t
        );
      },
      addLayers() {
        (e.map.addSource(c.COLD, { data: { type: d.FEATURE_COLLECTION, features: [] }, type: `geojson` }),
          e.map.addSource(c.HOT, { data: { type: d.FEATURE_COLLECTION, features: [] }, type: `geojson` }),
          e.options.styles.forEach((t) => {
            e.map.addLayer(t);
          }),
          e.store.setDirty(!0),
          e.store.render());
      },
      removeLayers() {
        (e.options.styles.forEach((t) => {
          e.map.getLayer(t.id) && e.map.removeLayer(t.id);
        }),
          e.map.getSource(c.COLD) && e.map.removeSource(c.COLD),
          e.map.getSource(c.HOT) && e.map.removeSource(c.HOT));
      },
    };
  return ((e.setup = r), r);
}
const Ke = `#3bb2d0`,
  z = `#fbb03b`,
  qe = `#fff`;
var Je = [
  {
    id: `gl-draw-polygon-fill`,
    type: `fill`,
    filter: [`all`, [`==`, `$type`, `Polygon`]],
    paint: { "fill-color": [`case`, [`==`, [`get`, `active`], `true`], z, Ke], "fill-opacity": 0.1 },
  },
  {
    id: `gl-draw-lines`,
    type: `line`,
    filter: [`any`, [`==`, `$type`, `LineString`], [`==`, `$type`, `Polygon`]],
    layout: { "line-cap": `round`, "line-join": `round` },
    paint: {
      "line-color": [`case`, [`==`, [`get`, `active`], `true`], z, Ke],
      "line-dasharray": [`case`, [`==`, [`get`, `active`], `true`], [`literal`, [0.2, 2]], [`literal`, [2, 0]]],
      "line-width": 2,
    },
  },
  {
    id: `gl-draw-point-outer`,
    type: `circle`,
    filter: [`all`, [`==`, `$type`, `Point`], [`==`, `meta`, `feature`]],
    paint: { "circle-radius": [`case`, [`==`, [`get`, `active`], `true`], 7, 5], "circle-color": qe },
  },
  {
    id: `gl-draw-point-inner`,
    type: `circle`,
    filter: [`all`, [`==`, `$type`, `Point`], [`==`, `meta`, `feature`]],
    paint: {
      "circle-radius": [`case`, [`==`, [`get`, `active`], `true`], 5, 3],
      "circle-color": [`case`, [`==`, [`get`, `active`], `true`], z, Ke],
    },
  },
  {
    id: `gl-draw-vertex-outer`,
    type: `circle`,
    filter: [`all`, [`==`, `$type`, `Point`], [`==`, `meta`, `vertex`], [`!=`, `mode`, `simple_select`]],
    paint: { "circle-radius": [`case`, [`==`, [`get`, `active`], `true`], 7, 5], "circle-color": qe },
  },
  {
    id: `gl-draw-vertex-inner`,
    type: `circle`,
    filter: [`all`, [`==`, `$type`, `Point`], [`==`, `meta`, `vertex`], [`!=`, `mode`, `simple_select`]],
    paint: { "circle-radius": [`case`, [`==`, [`get`, `active`], `true`], 5, 3], "circle-color": z },
  },
  {
    id: `gl-draw-midpoint`,
    type: `circle`,
    filter: [`all`, [`==`, `meta`, `midpoint`]],
    paint: { "circle-radius": 3, "circle-color": z },
  },
];
function Ye(e, t) {
  let r = t.getBoundingClientRect();
  return new n(e.clientX - r.left - (t.clientLeft || 0), e.clientY - r.top - (t.clientTop || 0));
}
function B(e, t, n, r) {
  return {
    type: d.FEATURE,
    properties: { meta: h.VERTEX, parent: e, coord_path: n, active: r ? g.ACTIVE : g.INACTIVE },
    geometry: { type: d.POINT, coordinates: t },
  };
}
function Xe(e, t, n) {
  let a = t.geometry.coordinates,
    o = n.geometry.coordinates;
  if (a[1] > 85 || a[1] < -85 || o[1] > 85 || o[1] < -85) return null;
  let s = r(a),
    c = r(o),
    l = (e) => Number(e.toFixed(8)),
    u = (e, t) => (e + t) / 2,
    f = i([u(s[0], c[0]), u(s[1], c[1])]),
    p = [l(f[0]), l(f[1])];
  return {
    type: d.FEATURE,
    properties: { meta: h.MIDPOINT, parent: e, lng: p[0], lat: p[1], coord_path: n.properties.coord_path },
    geometry: { type: d.POINT, coordinates: p },
  };
}
function V(e, t = {}, n = null) {
  let { type: r, coordinates: i } = e.geometry,
    a = e.properties && e.properties.id,
    o = [];
  r === d.POINT
    ? o.push(B(a, i, n, c(n)))
    : r === d.POLYGON
      ? i.forEach((e, t) => {
          s(e, n === null ? String(t) : `${n}.${t}`);
        })
      : r === d.LINE_STRING
        ? s(i, n)
        : r.indexOf(d.MULTI_PREFIX) === 0 && l();
  function s(e, n) {
    let r = ``,
      i = null;
    e.forEach((e, s) => {
      let l = n == null ? String(s) : `${n}.${s}`,
        u = B(a, e, l, c(l));
      if (t.midpoints && i) {
        let e = Xe(a, i, u);
        e && o.push(e);
      }
      i = u;
      let d = JSON.stringify(e);
      (r !== d && o.push(u), s === 0 && (r = d));
    });
  }
  function c(e) {
    return t.selectedPaths ? t.selectedPaths.indexOf(e) !== -1 : !1;
  }
  function l() {
    let n = r.replace(d.MULTI_PREFIX, ``);
    i.forEach((r, i) => {
      let a = { type: d.FEATURE, properties: e.properties, geometry: { type: n, coordinates: r } };
      o = o.concat(V(a, t, i));
    });
  }
  return o;
}
var H = {
  enable(e) {
    setTimeout(() => {
      !e.map ||
        !e.map.doubleClickZoom ||
        !e._ctx ||
        !e._ctx.store ||
        !e._ctx.store.getInitialConfigValue ||
        (e._ctx.store.getInitialConfigValue(`doubleClickZoom`) && e.map.doubleClickZoom.enable());
    }, 0);
  },
  disable(e) {
    setTimeout(() => {
      !e.map || !e.map.doubleClickZoom || e.map.doubleClickZoom.disable();
    }, 0);
  },
};
const { LAT_MIN: U, LAT_MAX: W, LAT_RENDERED_MIN: Ze, LAT_RENDERED_MAX: Qe, LNG_MIN: $e, LNG_MAX: et } = se;
function tt(e) {
  let t = { Point: 0, LineString: 1, Polygon: 2, MultiPoint: 1, MultiLineString: 2, MultiPolygon: 3 }[e.geometry.type],
    n = [e.geometry.coordinates].flat(t),
    r = n.map((e) => e[0]),
    i = n.map((e) => e[1]),
    a = (e) => Math.min.apply(null, e),
    o = (e) => Math.max.apply(null, e);
  return [a(r), a(i), o(r), o(i)];
}
function G(e, t) {
  let n = U,
    r = W,
    i = U,
    a = W,
    o = et,
    s = $e;
  e.forEach((e) => {
    let t = tt(e),
      c = t[1],
      l = t[3],
      u = t[0],
      d = t[2];
    (c > n && (n = c), l < r && (r = l), l > i && (i = l), c < a && (a = c), u < o && (o = u), d > s && (s = d));
  });
  let c = t;
  return (
    n + c.lat > Qe && (c.lat = Qe - n),
    i + c.lat > W && (c.lat = W - i),
    r + c.lat < Ze && (c.lat = Ze - r),
    a + c.lat < U && (c.lat = U - a),
    o + c.lng <= $e && (c.lng += Math.ceil(Math.abs(c.lng) / 360) * 360),
    s + c.lng >= et && (c.lng -= Math.ceil(Math.abs(c.lng) / 360) * 360),
    c
  );
}
function K(e, t) {
  let n = G(
    e.map((e) => e.toGeoJSON()),
    t,
  );
  e.forEach((e) => {
    let t = e.getCoordinates(),
      r = (e) => {
        let t = { lng: e[0] + n.lng, lat: e[1] + n.lat };
        return [t.lng, t.lat];
      },
      i = (e) => e.map((e) => r(e)),
      a = (e) => e.map((e) => i(e)),
      o;
    (e.type === d.POINT
      ? (o = r(t))
      : e.type === d.LINE_STRING || e.type === d.MULTI_POINT
        ? (o = t.map(r))
        : e.type === d.POLYGON || e.type === d.MULTI_LINE_STRING
          ? (o = t.map(i))
          : e.type === d.MULTI_POLYGON && (o = t.map(a)),
      e.incomingCoords(o));
  });
}
const q = {};
((q.onSetup = function (e) {
  let t = {
    dragMoveLocation: null,
    boxSelectStartLocation: null,
    boxSelectElement: void 0,
    boxSelecting: !1,
    canBoxSelect: !1,
    dragMoving: !1,
    canDragMove: !1,
    initialDragPanState: this.map.dragPan.isEnabled(),
    initiallySelectedFeatureIds: e.featureIds || [],
  };
  return (
    this.setSelected(t.initiallySelectedFeatureIds.filter((e) => this.getFeature(e) !== void 0)),
    this.fireActionable(),
    this.setActionableState({ combineFeatures: !0, uncombineFeatures: !0, trash: !0 }),
    t
  );
}),
  (q.fireUpdate = function () {
    this.fire(p.UPDATE, { action: m.MOVE, features: this.getSelected().map((e) => e.toGeoJSON()) });
  }),
  (q.fireActionable = function () {
    let e = this.getSelected(),
      t = e.filter((e) => this.isInstanceOf(`MultiFeature`, e)),
      n = !1;
    if (e.length > 1) {
      n = !0;
      let t = e[0].type.replace(`Multi`, ``);
      e.forEach((e) => {
        e.type.replace(`Multi`, ``) !== t && (n = !1);
      });
    }
    let r = t.length > 0,
      i = e.length > 0;
    this.setActionableState({ combineFeatures: n, uncombineFeatures: r, trash: i });
  }),
  (q.getUniqueIds = function (e) {
    return e.length
      ? e
          .map((e) => e.properties.id)
          .filter((e) => e !== void 0)
          .reduce((e, t) => (e.add(t), e), new E())
          .values()
      : [];
  }),
  (q.stopExtendedInteractions = function (e) {
    (e.boxSelectElement &&
      (e.boxSelectElement.parentNode && e.boxSelectElement.parentNode.removeChild(e.boxSelectElement),
      (e.boxSelectElement = null)),
      (e.canDragMove || e.canBoxSelect) && e.initialDragPanState === !0 && this.map.dragPan.enable(),
      (e.boxSelecting = !1),
      (e.canBoxSelect = !1),
      (e.dragMoving = !1),
      (e.canDragMove = !1));
  }),
  (q.onStop = function () {
    H.enable(this);
  }),
  (q.onMouseMove = function (e, t) {
    return (ue(t) && e.dragMoving && this.fireUpdate(), this.stopExtendedInteractions(e), !0);
  }),
  (q.onMouseOut = function (e) {
    return e.dragMoving ? this.fireUpdate() : !0;
  }),
  (q.onTap = q.onClick =
    function (e, t) {
      if (y(t)) return this.clickAnywhere(e, t);
      if (_(h.VERTEX)(t)) return this.clickOnVertex(e, t);
      if (ue(t)) return this.clickOnFeature(e, t);
    }),
  (q.clickAnywhere = function (e) {
    let t = this.getSelectedIds();
    (t.length && (this.clearSelectedFeatures(), t.forEach((e) => this.doRender(e))),
      H.enable(this),
      this.stopExtendedInteractions(e));
  }),
  (q.clickOnVertex = function (e, t) {
    (this.changeMode(f.DIRECT_SELECT, {
      featureId: t.featureTarget.properties.parent,
      coordPath: t.featureTarget.properties.coord_path,
      startPos: t.lngLat,
    }),
      this.updateUIClasses({ mouse: l.MOVE }));
  }),
  (q.startOnActiveFeature = function (e, t) {
    (this.stopExtendedInteractions(e),
      this.map.dragPan.disable(),
      this.doRender(t.featureTarget.properties.id),
      (e.canDragMove = !0),
      (e.dragMoveLocation = t.lngLat));
  }),
  (q.clickOnFeature = function (e, t) {
    (H.disable(this), this.stopExtendedInteractions(e));
    let n = x(t),
      r = this.getSelectedIds(),
      i = t.featureTarget.properties.id,
      a = this.isSelected(i);
    if (!n && a && this.getFeature(i).type !== d.POINT) return this.changeMode(f.DIRECT_SELECT, { featureId: i });
    (a && n
      ? (this.deselect(i), this.updateUIClasses({ mouse: l.POINTER }), r.length === 1 && H.enable(this))
      : !a && n
        ? (this.select(i), this.updateUIClasses({ mouse: l.MOVE }))
        : !a &&
          !n &&
          (r.forEach((e) => this.doRender(e)), this.setSelected(i), this.updateUIClasses({ mouse: l.MOVE })),
      this.doRender(i));
  }),
  (q.onMouseDown = function (e, t) {
    if (((e.initialDragPanState = this.map.dragPan.isEnabled()), v(t))) return this.startOnActiveFeature(e, t);
    if (this.drawConfig.boxSelect && ce(t)) return this.startBoxSelect(e, t);
  }),
  (q.startBoxSelect = function (e, t) {
    (this.stopExtendedInteractions(e),
      this.map.dragPan.disable(),
      (e.boxSelectStartLocation = Ye(t.originalEvent, this.map.getContainer())),
      (e.canBoxSelect = !0));
  }),
  (q.onTouchStart = function (e, t) {
    if (v(t)) return this.startOnActiveFeature(e, t);
  }),
  (q.onDrag = function (e, t) {
    if (e.canDragMove) return this.dragMove(e, t);
    if (this.drawConfig.boxSelect && e.canBoxSelect) return this.whileBoxSelect(e, t);
  }),
  (q.whileBoxSelect = function (e, t) {
    ((e.boxSelecting = !0),
      this.updateUIClasses({ mouse: l.ADD }),
      e.boxSelectElement ||
        ((e.boxSelectElement = document.createElement(`div`)),
        e.boxSelectElement.classList.add(s.BOX_SELECT),
        this.map.getContainer().appendChild(e.boxSelectElement)));
    let n = Ye(t.originalEvent, this.map.getContainer()),
      r = Math.min(e.boxSelectStartLocation.x, n.x),
      i = Math.max(e.boxSelectStartLocation.x, n.x),
      a = Math.min(e.boxSelectStartLocation.y, n.y),
      o = Math.max(e.boxSelectStartLocation.y, n.y),
      c = `translate(${r}px, ${a}px)`;
    ((e.boxSelectElement.style.transform = c),
      (e.boxSelectElement.style.WebkitTransform = c),
      (e.boxSelectElement.style.width = `${i - r}px`),
      (e.boxSelectElement.style.height = `${o - a}px`));
  }),
  (q.dragMove = function (e, t) {
    ((e.dragMoving = !0), t.originalEvent.stopPropagation());
    let n = { lng: t.lngLat.lng - e.dragMoveLocation.lng, lat: t.lngLat.lat - e.dragMoveLocation.lat };
    (K(this.getSelected(), n), (e.dragMoveLocation = t.lngLat));
  }),
  (q.onTouchEnd = q.onMouseUp =
    function (e, t) {
      if (e.dragMoving) this.fireUpdate();
      else if (e.boxSelecting) {
        let n = [e.boxSelectStartLocation, Ye(t.originalEvent, this.map.getContainer())],
          r = this.featuresAt(null, n, `click`),
          i = this.getUniqueIds(r).filter((e) => !this.isSelected(e));
        i.length && (this.select(i), i.forEach((e) => this.doRender(e)), this.updateUIClasses({ mouse: l.MOVE }));
      }
      this.stopExtendedInteractions(e);
    }),
  (q.toDisplayFeatures = function (e, t, n) {
    ((t.properties.active = this.isSelected(t.properties.id) ? g.ACTIVE : g.INACTIVE),
      n(t),
      this.fireActionable(),
      !(t.properties.active !== g.ACTIVE || t.geometry.type === d.POINT) && V(t).forEach(n));
  }),
  (q.onTrash = function () {
    (this.deleteFeature(this.getSelectedIds()), this.fireActionable());
  }),
  (q.onCombineFeatures = function () {
    let e = this.getSelected();
    if (e.length === 0 || e.length < 2) return;
    let t = [],
      n = [],
      r = e[0].type.replace(`Multi`, ``);
    for (let i = 0; i < e.length; i++) {
      let a = e[i];
      if (a.type.replace(`Multi`, ``) !== r) return;
      (a.type.includes(`Multi`)
        ? a.getCoordinates().forEach((e) => {
            t.push(e);
          })
        : t.push(a.getCoordinates()),
        n.push(a.toGeoJSON()));
    }
    if (n.length > 1) {
      let e = this.newFeature({
        type: d.FEATURE,
        properties: n[0].properties,
        geometry: { type: `Multi${r}`, coordinates: t },
      });
      (this.addFeature(e),
        this.deleteFeature(this.getSelectedIds(), { silent: !0 }),
        this.setSelected([e.id]),
        this.fire(p.COMBINE_FEATURES, { createdFeatures: [e.toGeoJSON()], deletedFeatures: n }));
    }
    this.fireActionable();
  }),
  (q.onUncombineFeatures = function () {
    let e = this.getSelected();
    if (e.length === 0) return;
    let t = [],
      n = [];
    for (let r = 0; r < e.length; r++) {
      let i = e[r];
      this.isInstanceOf(`MultiFeature`, i) &&
        (i.getFeatures().forEach((e) => {
          (this.addFeature(e), (e.properties = i.properties), t.push(e.toGeoJSON()), this.select([e.id]));
        }),
        this.deleteFeature(i.id, { silent: !0 }),
        n.push(i.toGeoJSON()));
    }
    (t.length > 1 && this.fire(p.UNCOMBINE_FEATURES, { createdFeatures: t, deletedFeatures: n }),
      this.fireActionable());
  }));
const nt = _(h.VERTEX),
  rt = _(h.MIDPOINT),
  J = {};
((J.fireUpdate = function () {
  this.fire(p.UPDATE, { action: m.CHANGE_COORDINATES, features: this.getSelected().map((e) => e.toGeoJSON()) });
}),
  (J.fireActionable = function (e) {
    this.setActionableState({ combineFeatures: !1, uncombineFeatures: !1, trash: e.selectedCoordPaths.length > 0 });
  }),
  (J.startDragging = function (e, t) {
    (e.initialDragPanState == null && (e.initialDragPanState = this.map.dragPan.isEnabled()),
      this.map.dragPan.disable(),
      (e.canDragMove = !0),
      (e.dragMoveLocation = t.lngLat));
  }),
  (J.stopDragging = function (e) {
    (e.canDragMove && e.initialDragPanState === !0 && this.map.dragPan.enable(),
      (e.initialDragPanState = null),
      (e.dragMoving = !1),
      (e.canDragMove = !1),
      (e.dragMoveLocation = null));
  }),
  (J.onVertex = function (e, t) {
    this.startDragging(e, t);
    let n = t.featureTarget.properties,
      r = e.selectedCoordPaths.indexOf(n.coord_path);
    !x(t) && r === -1
      ? (e.selectedCoordPaths = [n.coord_path])
      : x(t) && r === -1 && e.selectedCoordPaths.push(n.coord_path);
    let i = this.pathsToCoordinates(e.featureId, e.selectedCoordPaths);
    this.setSelectedCoordinates(i);
  }),
  (J.onMidpoint = function (e, t) {
    this.startDragging(e, t);
    let n = t.featureTarget.properties;
    (e.feature.addCoordinate(n.coord_path, n.lng, n.lat), this.fireUpdate(), (e.selectedCoordPaths = [n.coord_path]));
  }),
  (J.pathsToCoordinates = function (e, t) {
    return t.map((t) => ({ feature_id: e, coord_path: t }));
  }),
  (J.onFeature = function (e, t) {
    e.selectedCoordPaths.length === 0 ? this.startDragging(e, t) : this.stopDragging(e);
  }),
  (J.dragFeature = function (e, t, n) {
    (K(this.getSelected(), n), (e.dragMoveLocation = t.lngLat));
  }),
  (J.dragVertex = function (e, t, n) {
    let r = e.selectedCoordPaths.map((t) => e.feature.getCoordinate(t)),
      i = G(
        r.map((e) => ({ type: d.FEATURE, properties: {}, geometry: { type: d.POINT, coordinates: e } })),
        n,
      );
    for (let t = 0; t < r.length; t++) {
      let n = r[t];
      e.feature.updateCoordinate(e.selectedCoordPaths[t], n[0] + i.lng, n[1] + i.lat);
    }
  }),
  (J.clickNoTarget = function () {
    this.changeMode(f.SIMPLE_SELECT);
  }),
  (J.clickInactive = function () {
    this.changeMode(f.SIMPLE_SELECT);
  }),
  (J.clickActiveFeature = function (e) {
    ((e.selectedCoordPaths = []), this.clearSelectedCoordinates(), e.feature.changed());
  }),
  (J.onSetup = function (e) {
    let t = e.featureId,
      n = this.getFeature(t);
    if (!n) throw Error(`You must provide a featureId to enter direct_select mode`);
    if (n.type === d.POINT) throw TypeError(`direct_select mode doesn't handle point features`);
    let r = {
      featureId: t,
      feature: n,
      dragMoveLocation: e.startPos || null,
      dragMoving: !1,
      canDragMove: !1,
      selectedCoordPaths: e.coordPath ? [e.coordPath] : [],
    };
    return (
      this.setSelectedCoordinates(this.pathsToCoordinates(t, r.selectedCoordPaths)),
      this.setSelected(t),
      H.disable(this),
      this.setActionableState({ trash: !0 }),
      r
    );
  }),
  (J.onStop = function (e) {
    (H.enable(this), this.clearSelectedCoordinates(), this.stopDragging(e));
  }),
  (J.toDisplayFeatures = function (e, t, n) {
    (e.featureId === t.properties.id
      ? ((t.properties.active = g.ACTIVE),
        n(t),
        V(t, { map: this.map, midpoints: !0, selectedPaths: e.selectedCoordPaths }).forEach(n))
      : ((t.properties.active = g.INACTIVE), n(t)),
      this.fireActionable(e));
  }),
  (J.onTrash = function (e) {
    (e.selectedCoordPaths
      .sort((e, t) => t.localeCompare(e, `en`, { numeric: !0 }))
      .forEach((t) => e.feature.removeCoordinate(t)),
      this.fireUpdate(),
      (e.selectedCoordPaths = []),
      this.clearSelectedCoordinates(),
      this.fireActionable(e),
      e.feature.isValid() === !1 && (this.deleteFeature([e.featureId]), this.changeMode(f.SIMPLE_SELECT, {})));
  }),
  (J.onMouseMove = function (e, t) {
    let n = v(t),
      r = nt(t),
      i = rt(t),
      a = e.selectedCoordPaths.length === 0;
    return (
      (n && a) || (r && !a) ? this.updateUIClasses({ mouse: l.MOVE }) : this.updateUIClasses({ mouse: l.NONE }),
      (r || n || i) && e.dragMoving && this.fireUpdate(),
      this.stopDragging(e),
      !0
    );
  }),
  (J.onMouseOut = function (e) {
    return (e.dragMoving && this.fireUpdate(), !0);
  }),
  (J.onTouchStart = J.onMouseDown =
    function (e, t) {
      if (nt(t)) return this.onVertex(e, t);
      if (v(t)) return this.onFeature(e, t);
      if (rt(t)) return this.onMidpoint(e, t);
    }),
  (J.onDrag = function (e, t) {
    if (e.canDragMove !== !0) return;
    ((e.dragMoving = !0), t.originalEvent.stopPropagation());
    let n = { lng: t.lngLat.lng - e.dragMoveLocation.lng, lat: t.lngLat.lat - e.dragMoveLocation.lat };
    (e.selectedCoordPaths.length > 0 ? this.dragVertex(e, t, n) : this.dragFeature(e, t, n),
      (e.dragMoveLocation = t.lngLat));
  }),
  (J.onClick = function (e, t) {
    if (y(t)) return this.clickNoTarget(e, t);
    if (v(t)) return this.clickActiveFeature(e, t);
    if (le(t)) return this.clickInactive(e, t);
    this.stopDragging(e);
  }),
  (J.onTap = function (e, t) {
    if (y(t)) return this.clickNoTarget(e, t);
    if (v(t)) return this.clickActiveFeature(e, t);
    if (le(t)) return this.clickInactive(e, t);
  }),
  (J.onTouchEnd = J.onMouseUp =
    function (e) {
      (e.dragMoving && this.fireUpdate(), this.stopDragging(e));
    }));
const Y = {};
((Y.onSetup = function () {
  let e = this.newFeature({ type: d.FEATURE, properties: {}, geometry: { type: d.POINT, coordinates: [] } });
  return (
    this.addFeature(e),
    this.clearSelectedFeatures(),
    this.updateUIClasses({ mouse: l.ADD }),
    this.activateUIButton(u.POINT),
    this.setActionableState({ trash: !0 }),
    { point: e }
  );
}),
  (Y.stopDrawingAndRemove = function (e) {
    (this.deleteFeature([e.point.id], { silent: !0 }), this.changeMode(f.SIMPLE_SELECT));
  }),
  (Y.onTap = Y.onClick =
    function (e, t) {
      (this.updateUIClasses({ mouse: l.MOVE }),
        e.point.updateCoordinate(``, t.lngLat.lng, t.lngLat.lat),
        this.fire(p.CREATE, { features: [e.point.toGeoJSON()] }),
        this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.point.id] }));
    }),
  (Y.onStop = function (e) {
    (this.activateUIButton(), e.point.getCoordinate().length || this.deleteFeature([e.point.id], { silent: !0 }));
  }),
  (Y.toDisplayFeatures = function (e, t, n) {
    let r = t.properties.id === e.point.id;
    if (((t.properties.active = r ? g.ACTIVE : g.INACTIVE), !r)) return n(t);
  }),
  (Y.onTrash = Y.stopDrawingAndRemove),
  (Y.onKeyUp = function (e, t) {
    if (S(t) || C(t)) return this.stopDrawingAndRemove(e, t);
  }));
function X(e, t) {
  return e.lngLat ? e.lngLat.lng === t[0] && e.lngLat.lat === t[1] : !1;
}
const Z = {};
((Z.onSetup = function () {
  let e = this.newFeature({ type: d.FEATURE, properties: {}, geometry: { type: d.POLYGON, coordinates: [[]] } });
  return (
    this.addFeature(e),
    this.clearSelectedFeatures(),
    H.disable(this),
    this.updateUIClasses({ mouse: l.ADD }),
    this.activateUIButton(u.POLYGON),
    this.setActionableState({ trash: !0 }),
    { polygon: e, currentVertexPosition: 0 }
  );
}),
  (Z.clickAnywhere = function (e, t) {
    if (e.currentVertexPosition > 0 && X(t, e.polygon.coordinates[0][e.currentVertexPosition - 1]))
      return this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
    (this.updateUIClasses({ mouse: l.ADD }),
      e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat),
      e.currentVertexPosition++,
      e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat));
  }),
  (Z.clickOnVertex = function (e) {
    return this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
  }),
  (Z.onMouseMove = function (e, t) {
    (e.polygon.updateCoordinate(`0.${e.currentVertexPosition}`, t.lngLat.lng, t.lngLat.lat),
      b(t) && this.updateUIClasses({ mouse: l.POINTER }));
  }),
  (Z.onTap = Z.onClick =
    function (e, t) {
      return b(t) ? this.clickOnVertex(e, t) : this.clickAnywhere(e, t);
    }),
  (Z.onKeyUp = function (e, t) {
    S(t)
      ? (this.deleteFeature([e.polygon.id], { silent: !0 }), this.changeMode(f.SIMPLE_SELECT))
      : C(t) && this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.polygon.id] });
  }),
  (Z.onStop = function (e) {
    (this.updateUIClasses({ mouse: l.NONE }),
      H.enable(this),
      this.activateUIButton(),
      this.getFeature(e.polygon.id) !== void 0 &&
        (e.polygon.removeCoordinate(`0.${e.currentVertexPosition}`),
        e.polygon.isValid()
          ? this.fire(p.CREATE, { features: [e.polygon.toGeoJSON()] })
          : (this.deleteFeature([e.polygon.id], { silent: !0 }),
            this.changeMode(f.SIMPLE_SELECT, {}, { silent: !0 }))));
  }),
  (Z.toDisplayFeatures = function (e, t, n) {
    let r = t.properties.id === e.polygon.id;
    if (((t.properties.active = r ? g.ACTIVE : g.INACTIVE), !r)) return n(t);
    if (t.geometry.coordinates.length === 0) return;
    let i = t.geometry.coordinates[0].length;
    if (!(i < 3)) {
      if (((t.properties.meta = h.FEATURE), n(B(e.polygon.id, t.geometry.coordinates[0][0], `0.0`, !1)), i > 3)) {
        let r = t.geometry.coordinates[0].length - 3;
        n(B(e.polygon.id, t.geometry.coordinates[0][r], `0.${r}`, !1));
      }
      if (i <= 4) {
        let e = [
          [t.geometry.coordinates[0][0][0], t.geometry.coordinates[0][0][1]],
          [t.geometry.coordinates[0][1][0], t.geometry.coordinates[0][1][1]],
        ];
        if (
          (n({ type: d.FEATURE, properties: t.properties, geometry: { coordinates: e, type: d.LINE_STRING } }), i === 3)
        )
          return;
      }
      return n(t);
    }
  }),
  (Z.onTrash = function (e) {
    (this.deleteFeature([e.polygon.id], { silent: !0 }), this.changeMode(f.SIMPLE_SELECT));
  }));
const Q = {};
((Q.onSetup = function (e) {
  e = e || {};
  let t = e.featureId,
    n,
    r,
    i = `forward`;
  if (t) {
    if (((n = this.getFeature(t)), !n)) throw Error(`Could not find a feature with the provided featureId`);
    let a = e.from;
    if (
      (a && a.type === `Feature` && a.geometry && a.geometry.type === `Point` && (a = a.geometry),
      a && a.type === `Point` && a.coordinates && a.coordinates.length === 2 && (a = a.coordinates),
      !a || !Array.isArray(a))
    )
      throw Error("Please use the `from` property to indicate which point to continue the line from");
    let o = n.coordinates.length - 1;
    if (n.coordinates[o][0] === a[0] && n.coordinates[o][1] === a[1])
      ((r = o + 1), n.addCoordinate(r, ...n.coordinates[o]));
    else if (n.coordinates[0][0] === a[0] && n.coordinates[0][1] === a[1])
      ((i = `backwards`), (r = 0), n.addCoordinate(r, ...n.coordinates[0]));
    else throw Error("`from` should match the point at either the start or the end of the provided LineString");
  } else
    ((n = this.newFeature({ type: d.FEATURE, properties: {}, geometry: { type: d.LINE_STRING, coordinates: [] } })),
      (r = 0),
      this.addFeature(n));
  return (
    this.clearSelectedFeatures(),
    H.disable(this),
    this.updateUIClasses({ mouse: l.ADD }),
    this.activateUIButton(u.LINE),
    this.setActionableState({ trash: !0 }),
    { line: n, currentVertexPosition: r, direction: i }
  );
}),
  (Q.clickAnywhere = function (e, t) {
    if (
      (e.currentVertexPosition > 0 && X(t, e.line.coordinates[e.currentVertexPosition - 1])) ||
      (e.direction === `backwards` && X(t, e.line.coordinates[e.currentVertexPosition + 1]))
    )
      return this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.line.id] });
    (this.updateUIClasses({ mouse: l.ADD }),
      e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat),
      e.direction === `forward`
        ? (e.currentVertexPosition++, e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat))
        : e.line.addCoordinate(0, t.lngLat.lng, t.lngLat.lat));
  }),
  (Q.clickOnVertex = function (e) {
    return this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.line.id] });
  }),
  (Q.onMouseMove = function (e, t) {
    (e.line.updateCoordinate(e.currentVertexPosition, t.lngLat.lng, t.lngLat.lat),
      b(t) && this.updateUIClasses({ mouse: l.POINTER }));
  }),
  (Q.onTap = Q.onClick =
    function (e, t) {
      if (b(t)) return this.clickOnVertex(e, t);
      this.clickAnywhere(e, t);
    }),
  (Q.onKeyUp = function (e, t) {
    C(t)
      ? this.changeMode(f.SIMPLE_SELECT, { featureIds: [e.line.id] })
      : S(t) && (this.deleteFeature([e.line.id], { silent: !0 }), this.changeMode(f.SIMPLE_SELECT));
  }),
  (Q.onStop = function (e) {
    (H.enable(this),
      this.activateUIButton(),
      this.getFeature(e.line.id) !== void 0 &&
        (e.line.removeCoordinate(`${e.currentVertexPosition}`),
        e.line.isValid()
          ? this.fire(p.CREATE, { features: [e.line.toGeoJSON()] })
          : (this.deleteFeature([e.line.id], { silent: !0 }), this.changeMode(f.SIMPLE_SELECT, {}, { silent: !0 }))));
  }),
  (Q.onTrash = function (e) {
    (this.deleteFeature([e.line.id], { silent: !0 }), this.changeMode(f.SIMPLE_SELECT));
  }),
  (Q.toDisplayFeatures = function (e, t, n) {
    let r = t.properties.id === e.line.id;
    if (((t.properties.active = r ? g.ACTIVE : g.INACTIVE), !r)) return n(t);
    t.geometry.coordinates.length < 2 ||
      ((t.properties.meta = h.FEATURE),
      n(
        B(
          e.line.id,
          t.geometry.coordinates[e.direction === `forward` ? t.geometry.coordinates.length - 2 : 1],
          `${e.direction === `forward` ? t.geometry.coordinates.length - 2 : 1}`,
          !1,
        ),
      ),
      n(t));
  }));
var it = { simple_select: q, direct_select: J, draw_point: Y, draw_polygon: Z, draw_line_string: Q };
const at = {
    defaultMode: f.SIMPLE_SELECT,
    keybindings: !0,
    touchEnabled: !0,
    clickBuffer: 2,
    touchBuffer: 25,
    boxSelect: !0,
    displayControlsDefault: !0,
    styles: Je,
    modes: it,
    controls: {},
    userProperties: !1,
    suppressAPIEvents: !0,
  },
  ot = { point: !0, line_string: !0, polygon: !0, trash: !0, combine_features: !0, uncombine_features: !0 },
  st = { point: !1, line_string: !1, polygon: !1, trash: !1, combine_features: !1, uncombine_features: !1 };
function ct(e, t) {
  return e.map((e) => Object.assign({}, e, { id: `${e.id}.${t}`, source: t === `hot` ? c.HOT : c.COLD }));
}
function lt(e = {}) {
  let t = Object.assign({}, e);
  (e.controls || (t.controls = {}),
    e.displayControlsDefault === !1
      ? (t.controls = Object.assign({}, st, e.controls))
      : (t.controls = Object.assign({}, ot, e.controls)),
    (t = Object.assign({}, at, t)));
  let n = t.styles.filter((e) => e.source),
    r = t.styles.filter((e) => !e.source);
  return ((t.styles = n.concat(ct(r, `cold`)).concat(ct(r, `hot`))), t);
}
function ut(e, t) {
  return e.length === t.length ? JSON.stringify(e.map((e) => e).sort()) === JSON.stringify(t.map((e) => e).sort()) : !1;
}
const dt = { Polygon: N, LineString: M, Point: j, MultiPolygon: F, MultiLineString: F, MultiPoint: F };
function ft(e, t) {
  t.modes = f;
  let n = e.options.suppressAPIEvents === void 0 ? !0 : !!e.options.suppressAPIEvents;
  return (
    (t.getFeatureIdsAt = function (t) {
      return D.click({ point: t }, null, e).map((e) => e.properties.id);
    }),
    (t.getSelectedIds = function () {
      return e.store.getSelectedIds();
    }),
    (t.getSelected = function () {
      return {
        type: d.FEATURE_COLLECTION,
        features: e.store
          .getSelectedIds()
          .map((t) => e.store.get(t))
          .map((e) => e.toGeoJSON()),
      };
    }),
    (t.getSelectedPoints = function () {
      return {
        type: d.FEATURE_COLLECTION,
        features: e.store
          .getSelectedCoordinates()
          .map((e) => ({ type: d.FEATURE, properties: {}, geometry: { type: d.POINT, coordinates: e.coordinates } })),
      };
    }),
    (t.set = function (n) {
      if (n.type === void 0 || n.type !== d.FEATURE_COLLECTION || !Array.isArray(n.features))
        throw Error(`Invalid FeatureCollection`);
      let r = e.store.createRenderBatch(),
        i = e.store.getAllIds().slice(),
        a = t.add(n),
        o = new E(a);
      return ((i = i.filter((e) => !o.has(e))), i.length && t.delete(i), r(), a);
    }),
    (t.add = function (t) {
      let r = JSON.parse(JSON.stringify(o(t))).features.map((t) => {
        if (((t.id = t.id || Fe()), t.geometry === null)) throw Error(`Invalid geometry: null`);
        if (e.store.get(t.id) === void 0 || e.store.get(t.id).type !== t.geometry.type) {
          let r = dt[t.geometry.type];
          if (r === void 0) throw Error(`Invalid geometry type: ${t.geometry.type}.`);
          let i = new r(e, t);
          e.store.add(i, { silent: n });
        } else {
          let r = e.store.get(t.id),
            i = r.properties;
          ((r.properties = t.properties),
            a(i, t.properties) || e.store.featureChanged(r.id, { silent: n }),
            a(r.getCoordinates(), t.geometry.coordinates) || r.incomingCoords(t.geometry.coordinates));
        }
        return t.id;
      });
      return (e.store.render(), r);
    }),
    (t.get = function (t) {
      let n = e.store.get(t);
      if (n) return n.toGeoJSON();
    }),
    (t.getAll = function () {
      return { type: d.FEATURE_COLLECTION, features: e.store.getAll().map((e) => e.toGeoJSON()) };
    }),
    (t.delete = function (r) {
      return (
        e.store.delete(r, { silent: n }),
        t.getMode() === f.DIRECT_SELECT && !e.store.getSelectedIds().length
          ? e.events.changeMode(f.SIMPLE_SELECT, void 0, { silent: n })
          : e.store.render(),
        t
      );
    }),
    (t.deleteAll = function () {
      return (
        e.store.delete(e.store.getAllIds(), { silent: n }),
        t.getMode() === f.DIRECT_SELECT
          ? e.events.changeMode(f.SIMPLE_SELECT, void 0, { silent: n })
          : e.store.render(),
        t
      );
    }),
    (t.changeMode = function (r, i = {}) {
      return r === f.SIMPLE_SELECT && t.getMode() === f.SIMPLE_SELECT
        ? ut(i.featureIds || [], e.store.getSelectedIds())
          ? t
          : (e.store.setSelected(i.featureIds, { silent: n }), e.store.render(), t)
        : ((r === f.DIRECT_SELECT && t.getMode() === f.DIRECT_SELECT && i.featureId === e.store.getSelectedIds()[0]) ||
            e.events.changeMode(r, i, { silent: n }),
          t);
    }),
    (t.getMode = function () {
      return e.events.getMode();
    }),
    (t.trash = function () {
      return (e.events.trash({ silent: n }), t);
    }),
    (t.combineFeatures = function () {
      return (e.events.combineFeatures({ silent: n }), t);
    }),
    (t.uncombineFeatures = function () {
      return (e.events.uncombineFeatures({ silent: n }), t);
    }),
    (t.setFeatureProperty = function (r, i, a) {
      return (e.store.setFeatureProperty(r, i, a, { silent: n }), t);
    }),
    t
  );
}
var pt = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.defineProperty(
    {
      __proto__: null,
      CommonSelectors: ge,
      ModeHandler: Ne,
      StringSet: E,
      constrainFeatureMovement: G,
      createMidPoint: Xe,
      createSupplementaryPoints: V,
      createVertex: B,
      doubleClickZoom: H,
      euclideanDistance: Ee,
      featuresAt: D,
      getFeatureAtAndSetCursors: O,
      isClick: k,
      isEventAtCoordinates: X,
      isTap: Me,
      mapEventToBoundingBox: xe,
      moveFeatures: K,
      sortFeatures: be,
      stringSetsAreEqual: ut,
      theme: Je,
      toDenseArray: L,
    },
    Symbol.toStringTag,
    { value: `Module` },
  ),
);
const mt = function (e, t) {
  e = lt(e);
  let n = { options: e };
  ((t = ft(n, t)), (n.api = t));
  let r = Ge(n);
  return ((t.onAdd = r.onAdd), (t.onRemove = r.onRemove), (t.types = u), (t.options = e), t);
};
function $(e) {
  mt(e, this);
}
(($.modes = it), ($.constants = se), ($.lib = pt));
export { $ as default };
//# sourceMappingURL=index.js.map
