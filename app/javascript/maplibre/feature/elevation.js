import { featureColor } from 'maplibre/styles/styles'
import { map } from 'maplibre/map'
import { point } from "@turf/helpers"
import { distance } from "@turf/distance"

let marker

export async function showElevationChart (feature) {
  const chartElement = document.getElementById('route-elevation-chart')
  // skip without elevation data
  if (feature.geometry.type !== 'LineString' || feature.geometry.coordinates[0].length !== 3) {
    chartElement?.classList?.add('hidden')
    document.getElementById('elevation-stats')?.classList?.add('hidden')
    return null
  }

  // async load chart.js 
  const chartJs = await import('chart.js')
  // Destructure the required modules from chartJs
  const { CategoryScale, Chart, LinearScale, LineController, 
    LineElement, PointElement, Filler, Tooltip } = chartJs

  chartElement.classList.remove('hidden')
  Chart.register([CategoryScale, LineController, LineElement, LinearScale, PointElement,
    Filler, Tooltip])
  const labels = []
  feature.geometry.coordinates.reduce((pointDistance, coord, index) => {
    if (index == 0) { labels.push(0); return 0 }
    let from = point(feature.geometry.coordinates[index - 1])
    let to = point(coord)
    pointDistance += distance(from, to, { units: 'meters' })
    labels.push(Math.round(pointDistance))
    return pointDistance
  }, 0)

  const values = feature.geometry.coordinates.map(coords => coords[2])

  // Calculate elevation gain and loss
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
  const chartLineColor = (feature.properties['fill-extrusion-color'] ||
    feature.properties['stroke'] || featureColor).substring(0, 7)

  const canvas = document.getElementById('route-elevation-chart')
  // If a chart already exists on this canvas, destroy it
  const existing = Chart.getChart(canvas)
  if (existing) existing.destroy()

  let chart = new Chart(
    canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          fill: true,
          label: 'Track elevation',
          data: values,
          borderColor: chartLineColor,
          borderWidth: 2,
          backgroundColor: chartLineColor + '50',
          segment: values.length < 2500 ? {
            backgroundColor: (ctx) => {
              const i0 = ctx.p0DataIndex
              const i1 = ctx.p1DataIndex
              const distDiff = labels[i1] - labels[i0]
              if (distDiff === 0) return chartLineColor + '50'
              const grade = Math.abs((values[i1] - values[i0]) / distDiff * 100)
              if (grade >= 15) return 'rgba(139, 0, 0, 0.5)'
              if (grade >= 10) return 'rgba(255, 0, 0, 0.5)'
              if (grade >= 5) return 'rgba(255, 165, 0, 0.5)'
              return chartLineColor + '50'
            }
          } : undefined,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'white',
          pointBorderColor: chartLineColor,
          pointBorderWidth: 3,
          tension: 0.1,
          pointRadius: 0,
          spanGaps: true,
        }]
      },
      options: {
        responsive: true,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        tooltip: { position: 'nearest' },
        plugins: {
          legend: {
              display: false,
              position: 'top',
          },
          tooltip: {
            backgroundColor: '#354A51',
            padding: 12,
            titleFont: {
                size: 14,
                weight: 'bold'
            },
            bodyFont: {
                size: 13
            },
            displayColors: false,
            animation: { duration: 0 },
            callbacks: {
              title: (tooltipItems) => {
                return "Distance: " + toDisplayUnit(tooltipItems[0].label)
              },
              label: (tooltipItem) => {
                return "Elevation: " + tooltipItem.raw.toFixed(0) + 'm'
              },
              afterLabel: (tooltipItem) => {
                const i = tooltipItem.dataIndex
                if (i === 0) return 'Steepness: 0%'
                const elevDiff = values[i] - values[i - 1]
                const distDiff = labels[i] - labels[i - 1]
                if (distDiff === 0) return 'Steepness: 0%'
                const grade = (elevDiff / distDiff) * 100
                return 'Steepness: ' + grade.toFixed(1) + '%'
              },
              afterBody: function(context) {
                let coord = feature.geometry.coordinates[context[0]['dataIndex']]
                marker = getMarker(feature)
                marker.setLngLat([coord[0], coord[1]])
                marker.addTo(map)
              }
            }
          },
          // TODO: Not shown
          title: {
            display: true,
            text: 'Track elevation chart'
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            //type: 'linear', // linear only paints y values on full x values
            display: true,
            grid: {
                display: false,
                drawBorder: false
            },
            ticks: {
              font: {
                  size: 12
              },
              padding: 10,
              callback: function(_value, index, _values) {
                const label = labels[index]
                return toDisplayUnit(label)
              }
            }
          },
          y: {
            title: {
              display: true,
              text: 'Elevation (m)'
            }
          }
        }
      }
    })

  chart.canvas.addEventListener('mouseout', function(_event) {
    if (marker) { marker.remove() }
  })

  chart.canvas.addEventListener('click', function(event) {
    const points = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, true)
    if (points.length === 0) return
    const coord = feature.geometry.coordinates[points[0].index]
    map.flyTo({ center: [coord[0], coord[1]], duration: 1000, curve: 0.3 })
  })

  return chart
}

function getMarker(feature) {
  if (marker) { return marker }
  const markerDiv = document.createElement('div')
  markerDiv.style.backgroundColor = feature.properties['fill-extrusion-color'] ||
    feature.properties['stroke'] || featureColor
  markerDiv.className = 'elevation-marker'
  return new window.maplibregl.Marker({
    element: markerDiv,
    opacity: '0.8',
    opacityWhenCovered: '0',
    rotationAlignment: 'viewport',
    pitchAlignment: 'viewport'
  })
}

function toDisplayUnit (distance) {
  const unit = distance >= 1000 ? 'km' : 'm'
  const factor = distance >= 1000 ? 0.001 : 1
  const decimals = unit == 'm' ? 0 : 1
  if (distance == 0) { return '' }
  return (distance * factor).toFixed(decimals) + ' ' + unit
}
