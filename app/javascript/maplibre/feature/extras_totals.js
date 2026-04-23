import { EXTRAS_COLOR_CONFIGS, computeExtrasTotals } from 'maplibre/layers/geojson/route_extras'

function formatDistance (meters) {
  if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km'
  return Math.round(meters) + ' m'
}

export function showExtrasTotals (feature) {
  const container = document.getElementById('feature-details-extras')
  if (!container) return

  container.innerHTML = ''

  if (feature.geometry.type !== 'LineString' || !feature.properties.route?.extras) {
    container.classList.add('hidden')
    return
  }

  const extras = feature.properties.route.extras
  let hasAny = false

  for (const extrasType of Object.keys(EXTRAS_COLOR_CONFIGS)) {
    if (!extras[extrasType]) continue
    const result = computeExtrasTotals(feature, extrasType)
    if (!result || Object.keys(result.totals).length === 0) continue
    hasAny = true
    container.appendChild(buildExtrasSection(result))
  }

  if (hasAny) {
    container.classList.remove('hidden')
  } else {
    container.classList.add('hidden')
  }
}

function buildExtrasSection ({ config, totals, totalDistance }) {
  const section = document.createElement('div')
  section.className = 'feature-section-card'

  // Header with title + chevron
  const header = document.createElement('div')
  header.className = 'feature-details-card-header'

  const title = document.createElement('h5')
  title.textContent = config.title + ' analysis'
  header.appendChild(title)

  const chevron = document.createElement('i')
  chevron.className = 'bi bi-chevron-down extras-totals-chevron'
  header.appendChild(chevron)

  section.appendChild(header)

  // Sort entries: by value for gradient types, by distance (descending) for discrete
  const entries = Object.entries(totals)
  if (config.gradient) {
    entries.sort((a, b) => Number(a[0]) - Number(b[0]))
  } else {
    entries.sort((a, b) => b[1] - a[1])
  }

  // Stacked bar
  const bar = document.createElement('div')
  bar.className = 'extras-totals-bar'
  entries.forEach(([value, dist]) => {
    const pct = (dist / totalDistance) * 100
    if (pct < 0.5) return
    const color = config.colors.find(([v]) => v === Number(value))
    const segment = document.createElement('div')
    segment.className = 'extras-totals-bar-segment'
    segment.style.width = pct + '%'
    segment.style.backgroundColor = color ? color[1] : '#888888'
    segment.title = (config.labels[value] || value) + ': ' + formatDistance(dist) + ' (' + Math.round(pct) + '%)'
    bar.appendChild(segment)
  })
  section.appendChild(bar)

  // Collapsible detail rows
  const list = document.createElement('div')
  list.className = 'extras-totals-list hidden'
  entries.forEach(([value, dist]) => {
    const pct = (dist / totalDistance) * 100
    if (pct < 0.5) return
    const row = document.createElement('div')
    row.className = 'extras-totals-row'

    const swatch = document.createElement('span')
    swatch.className = 'extras-totals-swatch'
    const color = config.colors.find(([v]) => v === Number(value))
    swatch.style.backgroundColor = color ? color[1] : '#888888'
    row.appendChild(swatch)

    const label = document.createElement('span')
    label.className = 'extras-totals-label'
    label.textContent = config.labels[value] || value
    row.appendChild(label)

    const stats = document.createElement('span')
    stats.className = 'extras-totals-stats'
    stats.textContent = formatDistance(dist) + ' (' + Math.round(pct) + '%)'
    row.appendChild(stats)

    list.appendChild(row)
  })
  section.appendChild(list)

  // Toggle expand/collapse on header or bar click
  const toggleDetails = () => {
    list.classList.toggle('hidden')
    chevron.classList.toggle('bi-chevron-down')
    chevron.classList.toggle('bi-chevron-up')
  }
  header.addEventListener('click', toggleDetails)
  bar.addEventListener('click', toggleDetails)

  return section
}
