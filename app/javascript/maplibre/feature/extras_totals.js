import { escapeHtml, formatNumber } from 'helpers/functions'
import { GRADE_CLASSES, gradeTotals, surfaceColor } from 'maplibre/feature/track_profile'
import { EXTRAS_COLOR_CONFIGS } from 'maplibre/layers/geojson/route_extras'

// a steep class shows only from this length on, below it is GPS noise
const MIN_CLASS_METERS = 50

export const GRADE_ICON = '<svg class="grade-icon" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M1.5 13.5h13v-11z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'

// a slope with a notch, the same as the elevation profile card in _feature.haml
const PROFILE_ICON = '<svg class="card-icon" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M1.5 13.5h13V2.5l-4.5 5-2-1.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'

const km = meters => formatNumber(meters / 1000, 1) + ' km'

// a swatch without color is hatched, like the unknown surface in the chart band
function row (color, label, meters) {
  const swatch = color ? `class="extras-totals-swatch" style="background: ${color}"` : 'class="extras-totals-swatch swatch-unknown"'
  return `<div class="extras-totals-row"><span ${swatch}></span>` +
    `<span class="extras-totals-label">${escapeHtml(label)}</span><span class="extras-totals-stats">${km(meters)}</span></div>`
}

function card (icon, title, body) {
  return `<div class="feature-section-card extras-card"><h5 class="feature-card-title">${icon}${escapeHtml(title)}</h5>${body}</div>`
}

// "Steepest point +3 % at km 3,8", the template is a translation, the values are numbers
function spot (template, { grade, at }) {
  return '<div>' + escapeHtml(template)
    .replace('%{grade}', `<strong>${formatNumber(grade, 0, { signDisplay: 'exceptZero' })} %</strong>`)
    .replace('%{km}', formatNumber(at / 1000, 1)) + '</div>'
}

function gradeCard (profile) {
  const { totals, steepest, descent } = gradeTotals(profile)
  // the steep and the very steep classes share a row, named after the steep one, the chart keeps both colors
  const rows = [[1, 0], [2], [3], [4], [5, 6]].map(group => {
    const meters = group.reduce((sum, i) => sum + totals[i], 0)
    const classes = group.map(i => GRADE_CLASSES[i])
    if (!classes[0].base && meters < MIN_CLASS_METERS) return ''
    const color = classes.length > 1
      ? `linear-gradient(to right, ${classes[0].color} 50%, ${classes[1].color} 50%)` : classes[0].color
    return row(color, classes[0].label, meters)
  }).join('')
  const spots = steepest
    ? '<div class="extras-totals-spots">' + spot(window.__('Steepest point %{grade} at km %{km}'), steepest) +
      spot(window.__('Steepest descent %{grade} at km %{km}'), descent) + '</div>'
    : ''
  return card(PROFILE_ICON, window.__('Steepness'), rows + spots)
}

function surfaceCard ({ surfaces, dists, total }) {
  const totals = new Map()
  surfaces.forEach((s, i) => totals.set(Math.max(s, 0), (totals.get(Math.max(s, 0)) || 0) + dists[i + 1] - dists[i]))
  const config = EXTRAS_COLOR_CONFIGS.surface
  // the longest first, unknown last
  const rows = [...totals].filter(([, meters]) => meters / total >= 0.005)
    .sort(([a, ma], [b, mb]) => (a === 0) - (b === 0) || mb - ma)
    .map(([value, meters]) => row(value === 0 ? null : surfaceColor(value),
      config.labels[value] || String(value), meters))
    .join('')
  return card('<i class="bi bi-layers"></i>', window.__('Surface'), rows)
}

export function showExtrasTotals (profile) {
  const container = document.getElementById('feature-details-extras')
  if (!container) return
  const cards = [profile?.classes && gradeCard(profile), profile?.surfaces && surfaceCard(profile)].filter(Boolean)
  container.innerHTML = cards.join('')
  container.classList.toggle('hidden', cards.length === 0)
}
