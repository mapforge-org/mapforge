import { computeCumulativeDistances, EXTRAS_COLOR_CONFIGS } from 'maplibre/layers/geojson/route_extras'

// Ordered from steep downhill to steep uphill. The base classes show always, the steep ones
// only when the track has them.
export const GRADE_CLASSES = [
  { label: window.__('Very steep downhill'), color: '#2d8a2d' },
  { label: window.__('Steep downhill'), color: '#6fbf6a' },
  { label: window.__('Downhill'), color: '#a8d5a0', base: true },
  { label: window.__('Flat'), color: '#d4eed0', base: true },
  { label: window.__('Uphill'), color: '#e8aa68', base: true },
  { label: window.__('Steep uphill'), color: '#d9752e' },
  { label: window.__('Very steep uphill'), color: '#b33a2a' }
]

// the steepness classes of openrouteservice: 1 is 1-3 %, 2 is 4-6 %, 3 is 7-11 %, 4 and 5 are 12 % and more
export const ORS_CLASS = { '-5': 0, '-4': 0, '-3': 1, '-2': 2, '-1': 2, 0: 3, 1: 4, 2: 4, 3: 5, 4: 6, 5: 6 }

export function gradeClass (grade) {
  if (grade >= 12) return 6
  if (grade >= 7) return 5
  if (grade >= 1) return 4
  if (grade <= -12) return 0
  if (grade <= -7) return 1
  if (grade <= -1) return 2
  return 3
}

// the elevation at a distance along the track, interpolated between the two points around it
function elevationAt (dists, eles, d) {
  let lo = 0
  let hi = dists.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (dists[mid] <= d) { lo = mid } else { hi = mid }
  }
  const piece = dists[hi] - dists[lo]
  return piece > 0 ? eles[lo] + (eles[hi] - eles[lo]) * (d - dists[lo]) / piece : eles[lo]
}

// The grade of each segment over 100 m around its middle: the grade between two GPS points a
// few meters apart jumps around. So the steepest spots are approximate.
function smoothedGrades (dists, eles, window = 100) {
  const total = dists.at(-1)
  const grades = new Float32Array(dists.length - 1)
  for (let i = 0; i < grades.length; i++) {
    const middle = (dists[i] + dists[i + 1]) / 2
    const from = Math.max(0, middle - window / 2)
    const to = Math.min(total, middle + window / 2)
    grades[i] = to > from ? (elevationAt(dists, eles, to) - elevationAt(dists, eles, from)) / (to - from) * 100 : 0
  }
  return grades
}

// the color of a surface in the chart and the totals, gray for one without a color
export const surfaceColor = value => EXTRAS_COLOR_CONFIGS.surface.colors.find(([v]) => v === value)?.[1] || '#888888'

// a value per segment from the [start, end, value] ranges of a routing service extra, null where it gave none
function segmentValues (ranges, segments) {
  if (!ranges) return null
  const values = new Array(segments).fill(null)
  for (const [start, end, value] of ranges) {
    for (let i = start; i < Math.min(end, segments); i++) values[i] = value
  }
  return values
}

// changes below the threshold are left out, to filter GPS jitter
function gainAndLoss (eles, threshold = 2) {
  let gain = 0, loss = 0, ref = eles[0]
  for (let i = 1; i < eles.length; i++) {
    const diff = eles[i] - ref
    if (diff > threshold) {
      gain += diff
      ref = eles[i]
    } else if (diff < -threshold) {
      loss -= diff
      ref = eles[i]
    }
  }
  return { gain, loss }
}

// the height of an elevation between the lowest and the highest point of the track, from 0 to 1
export function heightShare ({ lowest, highest }, minRange = 0) {
  const range = Math.max(highest - lowest, minRange) || 1
  return elevation => (elevation - lowest) / range
}

// The elevation profile as the points of an svg path, x from 0 to 100 along the track and y from
// the given function. Every nth point, at most about maxPoints.
// ponytail: every nth point, not the peaks of each stretch. Fine at the size of a card.
export function profileLine ({ dists, total, eles }, maxPoints, y) {
  const step = Math.max(1, Math.ceil(eles.length / maxPoints))
  const points = []
  for (let i = 0; i < eles.length; i += step) { points.push(i) }
  // the end of the track, twice when the step lands on it, which draws nothing
  points.push(eles.length - 1)
  return points.map(i => `${(dists[i] / total * 100).toFixed(1)} ${y(eles[i]).toFixed(1)}`).join('L')
}

// The elevation of each point, null for a track without any. A GPS recorder leaves it out on some
// points, often at the start: a gap takes the values between its neighbors along the track, a gap
// at an end the nearest value.
function elevationsOf (coords, dists) {
  const known = []
  coords.forEach((c, i) => { if (Number.isFinite(c[2])) known.push(i) })
  if (!known.length) return null
  let k = 0
  return coords.map((c, i) => {
    while (known[k + 1] <= i) k++
    const a = known[k]
    const b = known[k + 1]
    if (a === i) return c[2]
    if (a > i || b === undefined) return coords[a][2]
    return coords[a][2] + (coords[b][2] - coords[a][2]) * (dists[i] - dists[a]) / ((dists[b] - dists[a]) || 1)
  })
}

// Distances, gradient classes, steepness and surfaces per segment of a LineString. The gradient comes from
// the elevation of the track, or else from the steepness classes of openrouteservice.
export function trackProfile (feature) {
  const coords = feature.geometry.coordinates
  if (feature.geometry.type !== 'LineString' || coords.length < 2) return null
  const dists = computeCumulativeDistances(coords)
  const segments = coords.length - 1
  const eles = elevationsOf(coords, dists)
  const grades = eles ? smoothedGrades(dists, eles) : null
  const extras = feature.properties.route?.extras
  const steepness = segmentValues(extras?.steepness?.values, segments)
  const classes = grades ? Int8Array.from(grades, gradeClass) : steepness && Int8Array.from(steepness, v => ORS_CLASS[v] ?? -1)
  // a spread of a long GPS track would overflow the call stack
  const extent = eles && { lowest: eles.reduce((a, b) => Math.min(a, b)), highest: eles.reduce((a, b) => Math.max(a, b)) }
  return { coords, dists, total: dists.at(-1), eles, grades, classes, steepness,
    surfaces: segmentValues(extras?.surface?.values, segments), ...(eles && gainAndLoss(eles)), ...extent }
}

// meters per gradient class, and the steepest segment up and down
export function gradeTotals ({ dists, grades, classes }) {
  const totals = new Array(GRADE_CLASSES.length).fill(0)
  classes.forEach((c, i) => { if (c >= 0) totals[c] += dists[i + 1] - dists[i] })
  if (!grades) return { totals }
  let up = 0, down = 0
  grades.forEach((g, i) => {
    if (g > grades[up]) up = i
    if (g < grades[down]) down = i
  })
  const at = i => (dists[i] + dists[i + 1]) / 2
  return { totals, steepest: { grade: grades[up], at: at(up) }, descent: { grade: grades[down], at: at(down) } }
}

// the track point nearest to a position, compared in degrees, which is good enough to pick a point
export function nearestIndex (coords, [lng, lat]) {
  const scale = Math.cos(lat * Math.PI / 180)
  let best = 0, bestDist = Infinity
  coords.forEach((c, i) => {
    const d = ((c[0] - lng) * scale) ** 2 + (c[1] - lat) ** 2
    if (d < bestDist) { bestDist = d; best = i }
  })
  return best
}
