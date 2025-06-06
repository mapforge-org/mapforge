import * as doubleClickZoom from "mapbox-gl-draw-paint-mode/lib/double_click_zoom"
import * as dragPan from "mapbox-gl-draw-paint-mode/lib/drag_pan"
import * as Constants from "mapbox-gl-draw-paint-mode/lib/Constants"

var PaintMode = {};

PaintMode.onSetup = function () {
  var state = {};
  state.currentLine = null;
  state.currentLineFeature = null;
  doubleClickZoom.disable(this);
  if(isTouchDevice()){
    dragPan.disable(this);
  }
  return state;
};

PaintMode.onClick = function (state, e) {
  if (e.originalEvent.detail === 2) {
    stopDrawing(state, e, this);
  } else {
    startDrawing(state, e);
  }
};

PaintMode.onMouseDown = function (state, e) {
    startDrawing(state, e);
    // disable map drag
    e.preventDefault();
};

PaintMode.onMouseUp = function (state, e) {
  stopDrawing(state, e, this);
};

PaintMode.onTouchStart = function (state, e) {
  startDrawing(state, e);
};

PaintMode.onTouchEnd = function (state, e) {
  stopDrawing(state, e, this);
};

function startDrawing(state, e) {
  state.currentLine = state.currentLine || [];
  state.currentLine.push([e.lngLat.lng, e.lngLat.lat]);
}

function stopDrawing(state, e, me) {
  let feature = {
      type: "Feature",
      id: state.currentLineFeature.id,
      properties: { "stroke-width": "6", "stroke": "#63452c" },
      geometry: {
        type: "LineString",
        coordinates: state.currentLineFeature.coordinates,
      }
    }

  // same behavior as std draw element: create + select
  me.map.fire("draw.create", {
    type: "FeatureCollection",
    features: [feature]
  })

  me.changeMode('direct_select', { featureId: feature.id })
}

PaintMode.onMouseMove = PaintMode.onDrag = PaintMode.onTouchMove = function (state, e) {
  if (!state.currentLine) return;

  state.currentLine.push([e.lngLat.lng, e.lngLat.lat]);

  if (!state.currentLineFeature) {
    state.currentLineFeature = this.newFeature({
      type: "Feature",
      properties: { "stroke-width": "6", "stroke": "#63452c" },
      geometry: {
        type: "LineString"
      },
    })
  }
  state.currentLineFeature['coordinates'] = state.currentLine
  this.addFeature(state.currentLineFeature);
  this.map.fire("draw.selectionchange", {
    featureIds: [state.currentLineFeature.id],
  })
}

PaintMode.toDisplayFeatures = function (state, geojson, display) {
  display(geojson);
};

PaintMode.onStop = function (state) {
  dragPan.enable(this);
  doubleClickZoom.enable(this);
};

function isTouchDevice() {
  return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     (navigator.msMaxTouchPoints > 0));
}

export default PaintMode;
