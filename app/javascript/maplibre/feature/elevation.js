import { distance } from "@turf/distance"
import { point } from "@turf/helpers"
import * as functions from 'helpers/functions'
import { map } from 'maplibre/map'
import { featureColor } from 'maplibre/styles/styles'

let marker
let syncChartToViewport
let debouncedSync
let canvasAbort
let lastGpsPosition = null

export async function showElevationChart (feature) {
  const chartElement = document.getElementById('route-elevation-chart')
  const elevationContainer = document.getElementById('feature-details-elevation')

  if (feature.geometry.type !== 'LineString' || feature.geometry.coordinates[0].length !== 3) {
    chartElement?.classList?.add('hidden')
    elevationContainer?.classList?.add('hidden')
    document.getElementById('elevation-stats')?.classList?.add('hidden')
    return null
  }

  elevationContainer?.classList?.remove('hidden')

  if (debouncedSync) {
    map.off('moveend', debouncedSync)
    debouncedSync = null
    syncChartToViewport = null
  }

  const chartJs = await import('chart.js')
  const { CategoryScale, Chart, LinearScale, LineController,
    LineElement, PointElement, Filler, Tooltip } = chartJs

  chartElement.classList.remove('hidden')
  Chart.register([CategoryScale, LineController, LineElement, LinearScale, PointElement,
    Filler, Tooltip])

  // Compute cumulative distance along the track for each coordinate
  const allCoords = feature.geometry.coordinates
  const allLabels = computeDistances(allCoords)
  const allValues = allCoords.map(c => c[2])

  const chartLineColor = (feature.properties['fill-extrusion-color'] ||
    feature.properties['stroke'] || featureColor).substring(0, 7)

  const canvas = document.getElementById('route-elevation-chart')
  const existing = Chart.getChart(canvas)
  if (existing) existing.destroy()

  const infoLine = document.getElementById('elevation-info-line')

  // Mutable view into the data — all callbacks reference this object,
  // so updating its properties is enough to sync the chart with the map viewport
  const active = { labels: allLabels, values: allValues, coords: allCoords }
  filterToViewport(active, allLabels, allValues, allCoords)
  showElevationStats(active.values)

  // GPS position indicator plugin
  const gpsPlugin = {
    id: 'gpsPosition',
    afterDraw (chart) {
      if (chart._gpsChartIndex == null) return
      const meta = chart.getDatasetMeta(0)
      const element = meta.data[chart._gpsChartIndex]
      if (!element) return

      const ctx = chart.ctx
      const yAxis = chart.scales.y
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(element.x, yAxis.top)
      ctx.lineTo(element.x, yAxis.bottom)
      ctx.lineWidth = 2
      ctx.strokeStyle = '#3b82f6'
      ctx.setLineDash([4, 4])
      ctx.stroke()

      // Draw a dot at the elevation value
      ctx.beginPath()
      ctx.arc(element.x, element.y, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#3b82f6'
      ctx.fill()
      ctx.restore()
    }
  }

  let chart = new Chart(canvas, {
    type: 'line',
    plugins: [gpsPlugin],
    data: {
      labels: active.labels,
      datasets: [{
        fill: true,
        label: 'Track elevation',
        data: active.values,
        borderColor: chartLineColor,
        borderWidth: 2,
        backgroundColor: chartLineColor + '50',
        // Color segments by steepness grade (skipped for very large tracks for performance)
        segment: allValues.length < 2500 ? {
          backgroundColor: (ctx) => segmentColor(ctx, active, chartLineColor)
        } : undefined,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: 'white',
        pointBorderColor: chartLineColor,
        pointBorderWidth: 3,
        tension: 0.1,
        spanGaps: true,
      }]
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        title: { display: true, text: 'Track elevation chart' }
      },
      scales: {
        x: {
          beginAtZero: true,
          display: true,
          grid: { display: false, drawBorder: false },
          ticks: {
            font: { size: 12 },
            padding: 10,
            maxTicksLimit: 10,
            callback: (_value, index) => toDisplayUnit(active.labels[index])
          }
        },
        y: {
          title: { display: false },
          ticks: {
            maxTicksLimit: 5,
            callback: (value) => value + 'm'
          }
        }
      }
    }
  })

  // Abort old canvas listeners from a previous chart before adding new ones
  if (canvasAbort) canvasAbort.abort()
  canvasAbort = new AbortController()
  const signal = canvasAbort.signal

  // Shared handler for hover/touch interaction
  const handleChartInteraction = (event) => {
    const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true)
    if (points.length === 0) {
      infoLine.style.visibility = 'hidden'
      if (marker) marker.remove()
      return
    }

    const i = points[0].index
    const distance = toDisplayUnit(active.labels[i])
    const elevation = active.values[i].toFixed(0)
    const grade = i === 0 ? 0 : computeGrade(active.values, active.labels, i)

    infoLine.innerHTML = `Waypoint: ${distance} • <i class="bi bi-triangle"></i> ${elevation}m • <i class="bi bi-arrow-up-right"></i> ${grade.toFixed(1)}%`
    infoLine.style.visibility = 'visible'

    // Place a marker on the map at the hovered point
    const coord = active.coords[i]
    marker = getMarker(feature)
    marker.setLngLat([coord[0], coord[1]])
    marker.addTo(map)
  }

  const hideChartInteraction = () => {
    infoLine.style.visibility = 'hidden'
    if (marker) marker.remove()
  }

  // Update info line on hover (desktop)
  chart.canvas.addEventListener('mousemove', handleChartInteraction, { signal })
  chart.canvas.addEventListener('mouseout', hideChartInteraction, { signal })

  // Update info line on touch drag (mobile)
  chart.canvas.addEventListener('touchmove', (event) => {
    event.preventDefault() // Prevent scrolling while dragging
    handleChartInteraction(event)
  }, { signal, passive: false })

  chart.canvas.addEventListener('touchend', hideChartInteraction, { signal })

  // Fly to the clicked point on the map (stopPropagation prevents the click
  // from bubbling to the map, which would re-trigger highlightFeature and
  // destroy this chart mid-handler)
  chart.canvas.addEventListener('click', (event) => {
    event.stopPropagation()
    const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true)
    if (points.length === 0) return
    const coord = active.coords[points[0].index]
    map.flyTo({ center: [coord[0], coord[1]], duration: 1000, curve: 0.3 })
  }, { signal })

  // Update GPS position indicator on the chart
  window.addEventListener('gps-position', (event) => {
    if (elevationContainer.offsetParent === null) return
    if (!event.detail) {
      lastGpsPosition = null
      chart._gpsChartIndex = null
      chart.update('none')
      return
    }

    // Throttle to 1 Hz — chart position indicator doesn't need sub-second updates
    functions.throttle(() => {
      lastGpsPosition = event.detail
      const idx = findNearestTrackIndex(event.detail, allCoords)
      if (idx === -1 || idx < active.firstIdx || idx > active.lastIdx) {
        chart._gpsChartIndex = null
      } else {
        chart._gpsChartIndex = idx - active.firstIdx
      }
      chart.update('none')
    }, 'gps-elevation', 1000)
  }, { signal })

  // Sync chart with map viewport — show only the track section currently visible
  syncChartToViewport = () => {
    if (elevationContainer.offsetParent === null) return
    if (!chart.canvas || !chart.canvas.isConnected) {
      map.off('moveend', debouncedSync)
      debouncedSync = null
      syncChartToViewport = null
      return
    }
    filterToViewport(active, allLabels, allValues, allCoords)
    chart.data.labels = active.labels
    chart.data.datasets[0].data = active.values
    showElevationStats(active.values)

    // Update GPS position indicator for new viewport
    if (lastGpsPosition) {
      const idx = findNearestTrackIndex(lastGpsPosition, allCoords)
      chart._gpsChartIndex = (idx !== -1 && idx >= active.firstIdx && idx <= active.lastIdx)
        ? idx - active.firstIdx : null
    } else {
      chart._gpsChartIndex = null
    }

    chart.update('none')
  }

  // Debounce 300ms — groups rapid successive map moves (pinch-zoom, flyTo) into one chart update
  debouncedSync = () => functions.debounce(syncChartToViewport, 'elevation-viewport', 300)
  map.on('moveend', debouncedSync)

  return chart
}

// Compute cumulative distances (meters) along a coordinate array
function computeDistances (coords) {
  const distances = []
  coords.reduce((total, coord, i) => {
    if (i === 0) { distances.push(0); return 0 }
    total += distance(point(coords[i - 1]), point(coord), { units: 'meters' })
    distances.push(Math.round(total))
    return total
  }, 0)
  return distances
}

// Euclidean approx instead of Haversine — avoids thousands of trig calls per GPS update,
// accurate enough for nearest-neighbor comparison
function approxDistSq (lngLat, coord) {
  const dlng = (lngLat.lng - coord[0]) * Math.cos(lngLat.lat * Math.PI / 180)
  const dlat = lngLat.lat - coord[1]
  return dlng * dlng + dlat * dlat
}

// Find the nearest track point to the given GPS position
// Returns index if within 100m threshold, else -1
function findNearestTrackIndex (lngLat, coords) {
  let minDist = Infinity
  let minIdx = -1
  for (let i = 0; i < coords.length; i++) {
    const d = approxDistSq(lngLat, coords[i])
    if (d < minDist) {
      minDist = d
      minIdx = i
    }
  }
  if (minIdx === -1) return -1
  // Only use precise Haversine for the final 100m threshold check
  const realDist = distance(point([lngLat.lng, lngLat.lat]), point(coords[minIdx]), { units: 'meters' })
  return realDist <= 100 ? minIdx : -1
}

// Filter active data to only include points visible in the current map viewport
function filterToViewport (active, allLabels, allValues, allCoords) {
  const bounds = map.getBounds()
  let firstIdx = -1, lastIdx = -1
  allCoords.forEach((coord, i) => {
    if (bounds.contains([coord[0], coord[1]])) {
      if (firstIdx === -1) firstIdx = i
      lastIdx = i
    }
  })
  if (firstIdx === -1 || firstIdx === lastIdx) {
    active.labels = allLabels
    active.values = allValues
    active.coords = allCoords
    active.firstIdx = 0
    active.lastIdx = allCoords.length - 1
  } else {
    active.labels = allLabels.slice(firstIdx, lastIdx + 1)
    active.values = allValues.slice(firstIdx, lastIdx + 1)
    active.coords = allCoords.slice(firstIdx, lastIdx + 1)
    active.firstIdx = firstIdx
    active.lastIdx = lastIdx
  }
}

// Grade (%) between two consecutive points — positive = uphill, negative = downhill
function computeGrade (values, labels, i) {
  const distDiff = labels[i] - labels[i - 1]
  if (distDiff === 0) return 0
  return ((values[i] - values[i - 1]) / distDiff) * 100
}

// Steepness-based segment fill color:
//   uphill:   orange (>5%), red (>10%), dark red (>15%)
//   downhill: dark green (>5%)
function segmentColor (ctx, active, baseColor) {
  const distDiff = active.labels[ctx.p1DataIndex] - active.labels[ctx.p0DataIndex]
  if (distDiff === 0) return baseColor + '50'
  const elevDiff = active.values[ctx.p1DataIndex] - active.values[ctx.p0DataIndex]
  const grade = (elevDiff / distDiff) * 100

  if (grade >= 15) return 'rgba(139, 0, 0, 0.5)'
  if (grade >= 10) return 'rgba(255, 0, 0, 0.5)'
  if (grade >= 5)  return 'rgba(255, 165, 0, 0.5)'
  if (grade <= -5) return 'rgba(0, 100, 0, 0.5)'
  return baseColor + '50'
}

function showElevationStats (values) {
  // changes below threshold are not added, to filter GPS jitter
  const threshold = 2
  let gain = 0, loss = 0, ref = values[0]
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - ref
    if (diff > threshold) {
      gain += diff
      ref = values[i]
    } else if (diff < -threshold) {
      loss -= diff
      ref = values[i]
    }
  }
  const statsEl = document.getElementById('elevation-stats')
  if (statsEl) {
    document.getElementById('elevation-gain').textContent = '↑ ' + Math.round(gain) + ' m'
    document.getElementById('elevation-loss').textContent = '↓ ' + Math.round(loss) + ' m'
    statsEl.classList.remove('hidden')
  }
}

function getMarker (feature) {
  if (marker) return marker
  const el = document.createElement('div')
  el.style.backgroundColor = feature.properties['fill-extrusion-color'] ||
    feature.properties['stroke'] || featureColor
  el.className = 'elevation-marker'
  return new window.maplibregl.Marker({
    element: el,
    opacity: '0.8',
    opacityWhenCovered: '0',
    rotationAlignment: 'viewport',
    pitchAlignment: 'viewport'
  })
}

function toDisplayUnit (distance) {
  distance = Number(distance)
  if (distance == 0) return ''
  if (distance >= 1000) return (distance * 0.001).toFixed(1) + ' km'
  return distance.toFixed(0) + ' m'
}
