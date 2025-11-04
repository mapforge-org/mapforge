// @mapbox/point-geometry@1.1.0 downloaded from https://ga.jspm.io/npm:@mapbox/point-geometry@1.1.0/index.js

/**
 * A standalone point geometry with useful accessor, comparison, and
 * modification methods.
 *
 * @class
 * @param {number} x the x-coordinate. This could be longitude or screen pixels, or any other sort of unit.
 * @param {number} y the y-coordinate. This could be latitude or screen pixels, or any other sort of unit.
 *
 * @example
 * const point = new Point(-77, 38);
 */
function Point(t,i){this.x=t;this.y=i}Point.prototype={clone(){return new Point(this.x,this.y)},
/**
     * Add this point's x & y coordinates to another point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
add(t){return this.clone()._add(t)},
/**
     * Subtract this point's x & y coordinates to from point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
sub(t){return this.clone()._sub(t)},
/**
     * Multiply this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
multByPoint(t){return this.clone()._multByPoint(t)},
/**
     * Divide this point's x & y coordinates by point,
     * yielding a new point.
     * @param {Point} p the other point
     * @return {Point} output point
     */
divByPoint(t){return this.clone()._divByPoint(t)},
/**
     * Multiply this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
mult(t){return this.clone()._mult(t)},
/**
     * Divide this point's x & y coordinates by a factor,
     * yielding a new point.
     * @param {number} k factor
     * @return {Point} output point
     */
div(t){return this.clone()._div(t)},
/**
     * Rotate this point around the 0, 0 origin by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @return {Point} output point
     */
rotate(t){return this.clone()._rotate(t)},
/**
     * Rotate this point around p point by an angle a,
     * given in radians
     * @param {number} a angle to rotate around, in radians
     * @param {Point} p Point to rotate around
     * @return {Point} output point
     */
rotateAround(t,i){return this.clone()._rotateAround(t,i)},
/**
     * Multiply this point by a 4x1 transformation matrix
     * @param {[number, number, number, number]} m transformation matrix
     * @return {Point} output point
     */
matMult(t){return this.clone()._matMult(t)},unit(){return this.clone()._unit()},perp(){return this.clone()._perp()},round(){return this.clone()._round()},mag(){return Math.sqrt(this.x*this.x+this.y*this.y)},
/**
     * Judge whether this point is equal to another point, returning
     * true or false.
     * @param {Point} other the other point
     * @return {boolean} whether the points are equal
     */
equals(t){return this.x===t.x&&this.y===t.y},
/**
     * Calculate the distance from this point to another point
     * @param {Point} p the other point
     * @return {number} distance
     */
dist(t){return Math.sqrt(this.distSqr(t))},
/**
     * Calculate the distance from this point to another point,
     * without the square root step. Useful if you're comparing
     * relative distances.
     * @param {Point} p the other point
     * @return {number} distance
     */
distSqr(t){const i=t.x-this.x,r=t.y-this.y;return i*i+r*r},angle(){return Math.atan2(this.y,this.x)},
/**
     * Get the angle from this point to another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
angleTo(t){return Math.atan2(this.y-t.y,this.x-t.x)},
/**
     * Get the angle between this point and another point, in radians
     * @param {Point} b the other point
     * @return {number} angle
     */
angleWith(t){return this.angleWithSep(t.x,t.y)},
/**
     * Find the angle of the two vectors, solving the formula for
     * the cross product a x b = |a||b|sin(θ) for θ.
     * @param {number} x the x-coordinate
     * @param {number} y the y-coordinate
     * @return {number} the angle in radians
     */
angleWithSep(t,i){return Math.atan2(this.x*i-this.y*t,this.x*t+this.y*i)},
/** @param {[number, number, number, number]} m */
_matMult(t){const i=t[0]*this.x+t[1]*this.y,r=t[2]*this.x+t[3]*this.y;this.x=i;this.y=r;return this},
/** @param {Point} p */
_add(t){this.x+=t.x;this.y+=t.y;return this},
/** @param {Point} p */
_sub(t){this.x-=t.x;this.y-=t.y;return this},
/** @param {number} k */
_mult(t){this.x*=t;this.y*=t;return this},
/** @param {number} k */
_div(t){this.x/=t;this.y/=t;return this},
/** @param {Point} p */
_multByPoint(t){this.x*=t.x;this.y*=t.y;return this},
/** @param {Point} p */
_divByPoint(t){this.x/=t.x;this.y/=t.y;return this},_unit(){this._div(this.mag());return this},_perp(){const t=this.y;this.y=this.x;this.x=-t;return this},
/** @param {number} angle */
_rotate(t){const i=Math.cos(t),r=Math.sin(t),s=i*this.x-r*this.y,n=r*this.x+i*this.y;this.x=s;this.y=n;return this},
/**
     * @param {number} angle
     * @param {Point} p
     */
_rotateAround(t,i){const r=Math.cos(t),s=Math.sin(t),n=i.x+r*(this.x-i.x)-s*(this.y-i.y),h=i.y+s*(this.x-i.x)+r*(this.y-i.y);this.x=n;this.y=h;return this},_round(){this.x=Math.round(this.x);this.y=Math.round(this.y);return this},constructor:Point};
/**
 * Construct a point from an array if necessary, otherwise if the input
 * is already a Point, return it unchanged.
 * @param {Point | [number, number] | {x: number, y: number}} p input value
 * @return {Point} constructed point.
 * @example
 * // this
 * var point = Point.convert([0, 1]);
 * // is equivalent to
 * var point = new Point(0, 1);
 */Point.convert=function(t){if(t instanceof Point)/** @type {Point} */
return t;if(Array.isArray(t))return new Point(+t[0],+t[1]);if(t.x!==void 0&&t.y!==void 0)return new Point(+t.x,+t.y);throw new Error("Expected [x, y] or {x, y} point format")};export{Point as default};

