import { featureColor } from 'maplibre/styles'
import { map } from 'maplibre/map'


let marker

export async function showElevationChart (feature) {
  const chartElement = document.getElementById('route-elevation-chart')
  // skip without elevation data
  if (feature.geometry.type !== 'LineString' || feature.geometry.coordinates[0].length !== 3) {
    chartElement.classList.add('hidden')
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
  feature.geometry.coordinates.reduce((distance, coord, index) => {
    if (index == 0) { labels.push(0); return 0 }
    let from = turf.point(feature.geometry.coordinates[index - 1])
    let to = turf.point(coord)
    distance += turf.distance(from, to, { units: 'meters' })
    labels.push(Math.round(distance))
    return distance
  }, 0)

  const values = feature.geometry.coordinates.map(coords => coords[2])
  const chartLineColor = (feature.properties['fill-extrusion-color'] ||
    feature.properties['stroke'] || featureColor).substring(0, 7)

  let chart = new Chart(
    document.getElementById('route-elevation-chart'), {
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
