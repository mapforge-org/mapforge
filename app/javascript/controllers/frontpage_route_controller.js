import { Controller } from '@hotwired/stimulus'

const POINT_SPACING = 90
const STRAIGHT_LENGTH = 280
const WOBBLE = 5

export default class extends Controller {
  static targets = ['path', 'hero', 'feature', 'row', 'stats', 'grid']

  connect () {
    this.observer = new ResizeObserver(() => this.draw())
    this.observer.observe(this.element)
  }

  disconnect () {
    this.observer.disconnect()
  }

  // The pins move with the layout, so the route follows their measured positions
  draw () {
    const origin = this.element.getBoundingClientRect()
    const box = (element) => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return new DOMRect(x - origin.x, y - origin.y, width, height)
    }
    const tip = (element) => {
      const { left, right, bottom } = box(element)
      return { x: (left + right) / 2, y: bottom }
    }
    const between = (a, b) => ({ x: (a.x + b.x) / 2, y: a.y + 6 })

    const [open, free, host] = this.heroTargets.map(tip)
    const [importData, routing] = this.featureTargets.map(tip)
    const [share, mobile, code] = this.rowTargets.map(tip)
    const [shareBottom, mobileBottom] = this.rowTargets.map(e => box(e.closest('.row')).bottom - 12)
    const aboveStats = box(this.statsTarget).top - 14
    const grid = box(this.gridTarget)
    const cards = [...this.gridTarget.children].map(box)
    // Bends scale with their card, the fractions can reach outside of it into the page gutter
    const bends = (card, ...fractions) => fractions.map(([x, y]) => ({
      x: Math.min(origin.width - 8, Math.max(8, card.left + card.width * x)),
      y: card.top + card.height * y
    }))
    const descent = cards[2].left + cards[2].width * 0.6

    const points = [
      { x: 0, y: open.y - 70 }, { x: open.x - 40, y: open.y - 40 },
      open, between(open, free), free, between(free, host), host,
      { x: host.x + 90, y: aboveStats }, { x: descent - 50, y: aboveStats }, { x: descent, y: aboveStats + 30 },
      ...bends(cards[2], [0.62, -0.6], [0.72, -0.2], [0.7, 0.15]),
      routing,
      ...bends(cards[2], [0.42, 0.37], [0.12, 0.24]),
      ...bends(cards[1], [0.87, 0.1], [0.6, 0.02], [0.3, 0.1], [0.05, 0.2]),
      ...bends(cards[0], [0.91, 0.33], [0.62, 0.4]),
      importData,
      ...bends(cards[0], [0.2, 0.3], [-0.05, 0.2], [-0.1, 0.6]),
      { x: Math.max(8, grid.left - 30), y: (grid.top + grid.bottom * 3) / 4 },
      { x: share.x, y: grid.bottom + 70 },
      share, { x: share.x, y: shareBottom }, { x: mobile.x, y: shareBottom },
      mobile, { x: mobile.x, y: mobileBottom }, { x: code.x, y: mobileBottom },
      code
    ]

    this.pathTarget.setAttribute('d', this.smoothPath(this.addWobble(points)))
  }

  addWobble (points) {
    return points.flatMap((point, index) => {
      const next = points[index + 1]
      if (!next) { return [point] }
      const length = Math.hypot(next.x - point.x, next.y - point.y)
      // Shorter segments are the bends, extra points would flatten their curves
      const count = length < STRAIGHT_LENGTH ? 0 : Math.floor(length / POINT_SPACING)
      const steps = Array.from({ length: count }, (_, step) => {
        const share = (step + 1) / (count + 1)
        const offset = Math.sin(step * 1.7 + index) * WOBBLE
        return {
          x: point.x + (next.x - point.x) * share - (next.y - point.y) / length * offset,
          y: point.y + (next.y - point.y) * share + (next.x - point.x) / length * offset
        }
      })
      return [point, ...steps]
    })
  }

  // Catmull-Rom spline as bezier curves, it passes through all points
  smoothPath (points) {
    const curves = points.slice(1).map((point, index) => {
      const start = points[index]
      const before = points[index - 1] || start
      const after = points[index + 2] || point
      const handle = (axis) => [
        start[axis] + (point[axis] - before[axis]) / 6,
        point[axis] - (after[axis] - start[axis]) / 6
      ]
      const [x1, x2] = handle('x')
      const [y1, y2] = handle('y')
      return `C${x1} ${y1} ${x2} ${y2} ${point.x} ${point.y}`
    })
    return `M${points[0].x} ${points[0].y} ${curves.join(' ')}`
  }
}
