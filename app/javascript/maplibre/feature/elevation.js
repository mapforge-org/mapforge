import { featureColor } from 'maplibre/styles/styles'
import { map } from 'maplibre/map'
import { point } from "@turf/helpers"
import { distance } from "@turf/distance"

let marker
let syncChartToViewport
let canvasAbort

export async function showElevationChart (feature) {
  const chartElement = document.getElementById('route-elevation-chart')
  if (feature.geometry.type !== 'LineString' || feature.geometry.coordinates[0].length !== 3) {
    chartElement?.classList?.add('hidden')
    document.getElementById('elevation-stats')?.classList?.add('hidden')
    return null
  }

  if (syncChartToViewport) {
    map.off('moveend', syncChartToViewport)
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

  showElevationStats(allValues)

  const chartLineColor = (feature.properties['fill-extrusion-color'] ||
    feature.properties['stroke'] || featureColor).substring(0, 7)

  const canvas = document.getElementById('route-elevation-chart')
  const existing = Chart.getChart(canvas)
  if (existing) existing.destroy()

  // Mutable view into the data — all callbacks reference this object,
  // so updating its properties is enough to sync the chart with the map viewport
  const active = { labels: allLabels, values: allValues, coords: allCoords }
  filterToViewport(active, allLabels, allValues, allCoords)

  let chart = new Chart(canvas, {
    type: 'line',
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
        tooltip: {
          backgroundColor: '#354A51',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          displayColors: false,
          animation: { duration: 0 },
          callbacks: {
            title: (items) => "Distance: " + toDisplayUnit(items[0].label),
            label: (item) => "Elevation: " + item.raw.toFixed(0) + 'm',
            afterLabel: (item) => {
              const i = item.dataIndex
              if (i === 0) return 'Steepness: 0%'
              const grade = computeGrade(active.values, active.labels, i)
              return 'Steepness: ' + grade.toFixed(1) + '%'
            },
            // Place a marker on the map at the hovered point
            afterBody: (context) => {
              const coord = active.coords[context[0]['dataIndex']]
              marker = getMarker(feature)
              marker.setLngLat([coord[0], coord[1]])
              marker.addTo(map)
            }
          }
        },
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
            callback: (_value, index) => toDisplayUnit(active.labels[index])
          }
        },
        y: { title: { display: true, text: 'Elevation (m)' } }
      }
    }
  })

  // Abort old canvas listeners from a previous chart before adding new ones
  if (canvasAbort) canvasAbort.abort()
  canvasAbort = new AbortController()
  const signal = canvasAbort.signal

  chart.canvas.addEventListener('mouseout', () => { if (marker) marker.remove() }, { signal })

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

  // Sync chart with map viewport — show only the track section currently visible
  syncChartToViewport = () => {
    if (!chart.canvas || !chart.canvas.isConnected) {
      map.off('moveend', syncChartToViewport)
      syncChartToViewport = null
      return
    }
    filterToViewport(active, allLabels, allValues, allCoords)
    chart.data.labels = active.labels
    chart.data.datasets[0].data = active.values
    chart.update('none')
  }

  map.on('moveend', syncChartToViewport)

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
  } else {
    active.labels = allLabels.slice(firstIdx, lastIdx + 1)
    active.values = allValues.slice(firstIdx, lastIdx + 1)
    active.coords = allCoords.slice(firstIdx, lastIdx + 1)
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
  let gain = 0, loss = 0
  for (let i = 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]
    if (diff > 0) gain += diff
    else loss += Math.abs(diff)
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
