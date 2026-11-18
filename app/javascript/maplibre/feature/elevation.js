import { distance } from "@turf/distance"
import { point } from "@turf/helpers"
import * as functions from 'helpers/functions'
import { routeDot, trackPositionHtml } from 'maplibre/feature/hover_info'
import { GRADE_CLASSES, nearestIndex, surfaceColor } from 'maplibre/feature/track_profile'
import { map } from 'maplibre/map'
import { defaults } from 'maplibre/styles/defaults'

let marker
let canvasAbort
let lastGpsPosition = null

const BAND_HEIGHT = 14
const WAYPOINT_RADIUS = 8

// 1, 2 or 5 times a power of ten, so an axis shows round values
function niceStep (raw) {
  const power = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map(m => m * power).find(step => raw <= step)
}

function hatchPattern (ctx) {
  const tile = Object.assign(document.createElement('canvas'), { width: 6, height: 6 })
  const t = tile.getContext('2d')
  t.fillStyle = '#f1f3f6'
  t.fillRect(0, 0, 6, 6)
  t.strokeStyle = '#c3c8d0'
  t.lineWidth = 1.5
  t.beginPath()
  t.moveTo(0, 6)
  t.lineTo(6, 0)
  t.stroke()
  return ctx.createPattern(tile, 'repeat')
}

export async function showElevationChart (feature, profile) {
  const container = document.getElementById('feature-details-elevation')
  if (canvasAbort) canvasAbort.abort()
  if (!profile?.eles) {
    container?.classList?.add('hidden')
    return null
  }
  container.classList.remove('hidden')

  const { Chart, LinearScale, LineController, LineElement, PointElement, Filler } = await import('chart.js')
  Chart.register([LineController, LineElement, LinearScale, PointElement, Filler])

  const { coords, dists, eles, classes, surfaces, total, lowest, highest } = profile
  const color = (feature.properties['fill-extrusion-color'] || feature.properties['stroke'] || defaults.featureColor).substring(0, 7)
  marker = routeDot(marker, color)

  const waypoints = (feature.properties.route?.waypoints || []).slice(0, 26).map(wp => nearestIndex(coords, wp))
  const bandLabel = window.__('Surface')
  const font = getComputedStyle(container).fontFamily

  const canvas = document.getElementById('route-elevation-chart')
  Chart.getChart(canvas)?.destroy()
  const hatch = hatchPattern(canvas.getContext('2d'))
  // about five distances, and two or three elevations on an axis that fits the track
  const step = niceStep(total / 5000) * 1000
  const digits = Math.max(0, Math.ceil(-Math.log10(step / 1000)))
  const eleStep = niceStep(Math.max(highest - lowest, 10) / 2)

  // the surface band between the chart and the distance axis, and the waypoint letters
  const overlays = {
    id: 'trackOverlays',
    afterDatasetsDraw (chart) {
      const { ctx, chartArea, scales: { x, y } } = chart
      ctx.save()
      if (surfaces) {
        const top = chartArea.bottom + 5
        let start = 0
        for (let i = 1; i <= surfaces.length; i++) {
          if (i < surfaces.length && surfaces[i] === surfaces[start]) continue
          const left = x.getPixelForValue(dists[start])
          const right = x.getPixelForValue(dists[i])
          const value = surfaces[start]
          ctx.fillStyle = value > 0 ? surfaceColor(value) : hatch
          ctx.fillRect(left, top, Math.max(1, right - left - 1), BAND_HEIGHT)
          start = i
        }
        // the name of the band on a light box in its middle
        ctx.font = `600 12px ${font}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const width = ctx.measureText(bandLabel).width + 10
        const middle = (chartArea.left + chartArea.right) / 2
        ctx.fillStyle = 'rgb(255 255 255 / 85%)'
        ctx.beginPath()
        ctx.roundRect(middle - width / 2, top, width, BAND_HEIGHT, 3)
        ctx.fill()
        ctx.fillStyle = '#374151'
        ctx.fillText(bandLabel, middle, top + BAND_HEIGHT / 2 + 0.5)
      }
      const active = chart.getActiveElements()[0]?.element
      if (active) {
        ctx.beginPath()
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = '#4b5563'
        ctx.lineWidth = 1
        ctx.moveTo(active.x, chartArea.top)
        ctx.lineTo(active.x, chartArea.bottom)
        ctx.stroke()
      }
      ctx.setLineDash([2, 3])
      ctx.strokeStyle = '#9ca3af'
      waypoints.forEach(index => {
        const px = x.getPixelForValue(dists[index])
        const py = y.getPixelForValue(eles[index])
        ctx.beginPath()
        ctx.moveTo(px, py + WAYPOINT_RADIUS)
        ctx.lineTo(px, chartArea.bottom)
        ctx.stroke()
      })
      ctx.setLineDash([])
      ctx.font = 'bold 9px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      waypoints.forEach((index, n) => {
        const px = x.getPixelForValue(dists[index])
        const py = y.getPixelForValue(eles[index])
        ctx.beginPath()
        ctx.arc(px, py, WAYPOINT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = '#fff'
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.fillText(String.fromCharCode(65 + n), px, py + 0.5)
      })
      ctx.restore()
    }
  }

  // the gps position of the user on the track
  const gpsPlugin = {
    id: 'gpsPosition',
    afterDraw (chart) {
      if (chart._gpsChartIndex == null) return
      const element = chart.getDatasetMeta(0).data[chart._gpsChartIndex]
      if (!element) return
      const { ctx, chartArea } = chart
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(element.x, chartArea.top)
      ctx.lineTo(element.x, chartArea.bottom)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#3b82f6'
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(element.x, element.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#3b82f6'
      ctx.fill()
      ctx.restore()
    }
  }

  const chart = new Chart(canvas, {
    type: 'line',
    plugins: [overlays, gpsPlugin],
    data: {
      datasets: [{
        data: eles.map((ele, i) => ({ x: dists[i], y: ele })),
        fill: 'start',
        borderColor: color,
        borderWidth: 2,
        backgroundColor: GRADE_CLASSES[3].color,
        segment: { backgroundColor: ctx => GRADE_CLASSES[classes[ctx.p0DataIndex]]?.color },
        pointRadius: 0,
        pointHoverRadius: 4.5,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: color,
        pointHoverBorderWidth: 3,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      // .elevation-chart sets the size: with its own aspect ratio, chart.js never grows
      // back after the modal was narrower
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      // the handlers below select the points, for mouse and touch
      events: [],
      // chart.js keeps half of the last distance label right of the plot, which also fits a waypoint
      layout: { padding: { top: WAYPOINT_RADIUS + 2 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          type: 'linear',
          min: 0,
          max: total,
          // round distances, and the end of the track instead of a round one too close to it
          afterBuildTicks: axis => {
            const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => ({ value: i * step }))
            if (total - ticks.at(-1).value < step / 2) ticks.pop()
            axis.ticks = [...ticks, { value: total }]
          },
          grid: { display: false },
          border: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: false,
            font: { size: 11 },
            color: '#6b7280',
            padding: surfaces ? BAND_HEIGHT + 10 : 6,
            callback: (value, index, ticks) =>
              functions.formatNumber(value / 1000, index === ticks.length - 1 ? Math.max(digits, 1) : digits) + ' km'
          }
        },
        y: {
          min: Math.floor(lowest / eleStep) * eleStep,
          max: Math.ceil(highest / eleStep) * eleStep,
          grid: { color: '#e5e7eb' },
          border: { display: false },
          ticks: {
            stepSize: eleStep,
            font: { size: 11 },
            color: '#6b7280',
            callback: (value, index) => functions.formatNumber(value) + (index === 0 ? ' m' : '')
          }
        }
      }
    }
  })

  updateGpsIndex(chart, coords)
  chart.update('none')

  canvasAbort = new AbortController()
  const signal = canvasAbort.signal
  // the listeners below and the chart keep the whole track alive, they end together
  signal.addEventListener('abort', () => chart.destroy())
  const here = document.getElementById('elevation-here')
  here.style.setProperty('--route-color', color)
  here.querySelector('.here-hint').textContent = functions.touchOnly()
    ? window.__('Tap the profile or the route') : window.__('Point at the profile or the route')

  // marks a track point in the chart and in the "here" line, null clears it. The map shows a dot
  // when the chart picked the point, a hover on the map track has its own dot.
  // A hover on the map gives the exact position between two points, it overrides the values of point i
  // A mouse move fires many times on the same point: the chart redraws only for another point, the
  // line only for another text
  const position = here.querySelector('.hover-position')
  let active, shown
  const select = (i, { dot = false, at = dists[i], segment = Math.min(i, coords.length - 2), elevation = eles[i] } = {}) => {
    if (i !== active) {
      active = i
      chart.setActiveElements(i == null ? [] : [{ datasetIndex: 0, index: i }])
      chart.update('none')
    }
    // without a point, a hint keeps the place of the line, so the cards below stay put
    here.classList.toggle('idle', i == null)
    if (dot && i != null) { marker.setLngLat([coords[i][0], coords[i][1]]).addTo(map) } else { marker.remove() }
    if (i == null) return
    const html = trackPositionHtml(profile, segment, at, elevation)
    if (html !== shown) { position.innerHTML = shown = html }
  }
  select(null)

  const indexAt = event => chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true)[0]?.index

  // the hover on the track on the map, see hover_info.js
  window.addEventListener('track-position', (event) => {
    const { featureId, position } = event.detail
    if (featureId !== feature.id || container.offsetParent === null) return
    if (!position) return select(null)
    // the exact position of the hover card, the chart marks the nearer of the two points
    const { segment, share, meters, elevation } = position
    select(share < 0.5 ? segment : segment + 1, { at: meters, segment, elevation })
  }, { signal })

  if (functions.touchOnly()) {
    // a tap on the route on the map, see selectFeatureOnClick
    window.addEventListener('track-tap', (event) => {
      if (event.detail.featureId !== feature.id) return
      select(nearestIndex(coords, event.detail.lngLat), { dot: true })
    }, { signal })
    const touchSelect = (event) => {
      // the sheet must not move while a finger runs along the chart
      event.stopPropagation()
      event.preventDefault()
      const i = indexAt(event)
      if (i != null) select(i, { dot: true })
    }
    canvas.addEventListener('touchstart', touchSelect, { signal, passive: false })
    canvas.addEventListener('touchmove', touchSelect, { signal, passive: false })
    // a tap anywhere else clears the point
    document.addEventListener('touchstart', (event) => {
      if (event.target !== canvas) select(null)
    }, { signal, capture: true })
  } else {
    canvas.addEventListener('mousemove', (event) => {
      const i = indexAt(event)
      select(i ?? null, { dot: true })
    }, { signal })
    canvas.addEventListener('mouseout', () => select(null), { signal })
    // stopPropagation keeps the click from the map, which would select the feature again
    // and destroy this chart in the middle of the handler
    canvas.addEventListener('click', (event) => {
      event.stopPropagation()
      const i = indexAt(event)
      if (i != null) map.flyTo({ center: [coords[i][0], coords[i][1]], duration: 1000, curve: 0.3 })
    }, { signal })
  }

  window.addEventListener('gps-position', (event) => {
    // kept while the card is hidden, so a later chart build can start from it
    lastGpsPosition = event.detail
    if (container.offsetParent === null) return
    functions.throttle(() => {
      updateGpsIndex(chart, coords)
      chart.update('none')
    }, 'gps-elevation', 1000)
  }, { signal })

  return chart
}

// the feature modal closed
export function closeElevationChart () {
  canvasAbort?.abort()
  canvasAbort = null
  marker?.remove()
}

function updateGpsIndex (chart, coords) {
  chart._gpsChartIndex = null
  if (!lastGpsPosition) return
  const index = nearestIndex(coords, [lastGpsPosition.lng, lastGpsPosition.lat])
  const meters = distance(point([lastGpsPosition.lng, lastGpsPosition.lat]), point(coords[index]), { units: 'meters' })
  if (meters <= 100) chart._gpsChartIndex = index
}
