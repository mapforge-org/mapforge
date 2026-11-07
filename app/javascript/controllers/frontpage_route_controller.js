import { Controller } from '@hotwired/stimulus'

// All values are in pixels
const POINT_SPACING = 90 // distance between the extra points on a long segment
const STRAIGHT_LENGTH = 280 // shorter segments are bends and stay unchanged
const WOBBLE = 5 // largest sideways shift of an extra point
const EDGE = 13 // smallest distance to the page edge before the wobble, it fits the 20px page gutter
const MIN_STEP = 20 // closer points make kinks, and identical points have no direction
const CORNER_REACH = 45 // a sharp corner starts this far before its point
const CORNER_COSINE = 0.7 // a turn of more than 45 degrees is a sharp corner
const CHEVRON_SPACING = 280 // distance between the chevrons along the route, a multiple of DASH_PERIOD
const CHEVRON_SIZE = 9 // length of a chevron arm
const CHEVRON_PIN_DISTANCE = 26 // a closer chevron would stick out from behind the pin head
const PIN_HEAD = 12 // the head of a pin sits this far above its tip
const FLAG_POLE = 1 / 8 // left edge of the pole in the flag icon, as a share of the icon width
const FLAG_FOOT = 1 / 16 // the route meets the pole this far above the icon bottom, as a share of the icon width
const DASH = 11 // must match the first stroke-dasharray value of .landing-route path
const DASH_PERIOD = 20 // must match the sum of the stroke-dasharray values of .landing-route path

export default class extends Controller {
  static targets = ['path', 'chevrons', 'start', 'headline', 'actions', 'hero', 'feature', 'showcase', 'stop', 'cta',
    'flag', 'stats', 'grid', 'tile', 'photo', 'lightRoute', 'lightChevrons']

  connect () {
    this.redraw = () => this.draw()
    this.observer = new ResizeObserver(this.redraw)
    this.observer.observe(this.element)
    // Fonts move the headline end and the pins, but the page size can stay the same
    document.fonts.addEventListener('loadingdone', this.redraw)
  }

  disconnect () {
    this.observer.disconnect()
    document.fonts.removeEventListener('loadingdone', this.redraw)
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
      return { x: (left + right) / 2, y: bottom, pin: true }
    }

    const adFree = tip(this.heroTargets[1])
    const [importData, routing] = this.featureTargets.map(tip)
    const showcase = (row, center) => {
      const pins = this.stopTargets.filter(pin => row.contains(pin))
      return this.showcasePoints(box(row), box(row.querySelector('svg')), box(pins[0].closest('ul')), pins.map(tip), center)
    }
    const share = showcase(this.showcaseTargets[0])
    const center = share[0].x
    const mobile = showcase(this.showcaseTargets[1], center)
    const flag = box(this.flagTarget)
    const finish = { x: flag.left + flag.width * FLAG_POLE, y: flag.bottom - flag.width * FLAG_FOOT, pin: true }
    const aboveStats = box(this.statsTarget).top - 14
    const belowActions = box(this.actionsTarget).bottom + 16
    // In one column the page gutter replaces the gap next to the hero text
    const maxX = origin.width - EDGE
    const side = Math.min(box(this.headlineTarget).right + 28, maxX)
    const headlineText = document.createRange()
    headlineText.selectNodeContents(this.headlineTarget)
    const lastLine = [...headlineText.getClientRects()].at(-1)
    const start = {
      x: Math.min(lastLine.right - origin.x + 12, maxX),
      y: lastLine.bottom - origin.y - lastLine.height / 4
    }
    const grid = box(this.gridTarget)
    const cards = [...this.gridTarget.children].map(box)
    // Bends scale with their card, the fractions can reach outside of it into the page gutter
    const bends = (card, ...fractions) => fractions.map(([x, y]) => ({
      x: Math.min(maxX, Math.max(EDGE, card.left + card.width * x)),
      y: card.top + card.height * y
    }))
    const leftGutter = Math.max(EDGE, grid.left - 30)
    const rightGutter = Math.min(maxX, grid.right + 30)

    const fromHeadline = [start, { x: side, y: start.y + 12 }]
    // Measured from the list and not the pin: the checks can wrap to a second line below the pin
    const belowChecks = box(this.heroTargets[1].closest('ul')).bottom + 3
    const underChecks = (share, drop) => ({ x: adFree.x + (side - 40 - adFree.x) * share, y: belowChecks + drop })
    const hero = this.heroTargets[1].offsetParent
      ? [
          ...fromHeadline,
          { x: side - 14, y: (start.y + belowChecks) / 2 + 30 },
          { x: side - 4, y: belowChecks - 24 },
          underChecks(1, 10), underChecks(0.6, 0), underChecks(0.25, 12), underChecks(0, 0),
          { x: leftGutter + 30, y: belowChecks + 2 }
        ]
      : [...fromHeadline, { x: side, y: belowActions }]

    // The route runs in the 1rem gap between the image and the text
    const belowDrawImage = box(this.gridTarget.children[1].querySelector('.landing-feature-art')).bottom + 8

    const features = cards[2].top === cards[0].top
      ? [
          { x: leftGutter, y: aboveStats },
          { x: leftGutter, y: cards[0].top + cards[0].height * 0.1 },
          ...bends(cards[0], [-0.03, 0.27], [0.18, 0.33]),
          importData,
          ...bends(cards[0], [0.62, 0.4], [0.91, 0.33]),
          ...[-0.03, 0.5, 1.03].map(share => ({ x: cards[1].left + cards[1].width * share, y: belowDrawImage })),
          ...bends(cards[2], [0.12, 0.24], [0.42, 0.37]),
          routing,
          ...bends(cards[2], [0.92, 0.42]),
          { x: rightGutter, y: cards[2].top + cards[2].height * 0.55 },
          { x: rightGutter, y: grid.bottom + 30 }
        ]
      : this.stackedFeatures(leftGutter, belowActions, grid, cards, importData, routing)

    const points = [
      ...hero,
      ...features,
      { x: center, y: grid.bottom + 70 },
      ...share,
      ...mobile,
      ...this.ctaPoints(center, box(this.ctaTarget), box(this.ctaTarget.querySelector('h2')), finish)
    ]

    this.pathTarget.setAttribute('d', this.smoothPath(this.addWobble(this.widenCorners(points)), maxX + WOBBLE))
    // Without this the route can end in a gap of the dash pattern, short of the pole
    this.pathTarget.setAttribute('stroke-dashoffset', DASH - this.pathTarget.getTotalLength())
    const covers = [box(this.statsTarget), ...this.tileTargets.map(box)]
    this.chevronsTarget.setAttribute('d', this.chevronPath(points.filter(point => point.pin), covers))
    // The brown route has too little contrast on the satellite image, a light copy covers it there
    const { x, y, width, height } = box(this.featureTargets[1].parentElement)
    Object.entries({ x, y, width, height }).forEach(([name, value]) => this.photoTarget.setAttribute(name, value))
    this.lightRouteTarget.setAttribute('d', this.pathTarget.getAttribute('d'))
    this.lightRouteTarget.setAttribute('stroke-dashoffset', this.pathTarget.getAttribute('stroke-dashoffset'))
    this.lightChevronsTarget.setAttribute('d', this.chevronsTarget.getAttribute('d'))
    this.startTarget.setAttribute('cx', start.x)
    this.startTarget.setAttribute('cy', start.y)
  }

  // With the image on the left the route runs in the gap to the text. Below the image, or with the
  // image on the right, it runs in the left margin. There it comes over from the center first,
  // and it returns to the center under the list. It swings over to the list and runs straight
  // through its pins. The extra points on a swing keep it vertical where it meets a straight part.
  showcasePoints (row, image, list, pins, center) {
    const inGap = image.right < list.left
    const flipped = image.left > list.left
    const gutter = inGap ? (image.right + list.left) / 2 : Math.max(EDGE, flipped ? list.left - 30 : image.left - 12)
    const reach = inGap || flipped ? 50 : 30
    const { x } = pins[0]
    const middle = (gutter + x) / 2
    const above = pins[0].y - 30
    const below = pins.at(-1).y + 30
    const swingIn = [
      { x: gutter, y: above - reach - 30 },
      { x: gutter, y: above - reach },
      { x: middle, y: above - reach / 2 },
      { x, y: above },
      ...pins
    ]
    if (flipped) {
      const top = row.top + 30
      const bottom = row.bottom - 30
      return [{ x: center, y: top }, { x: gutter, y: top }, ...swingIn, { x, y: bottom }, { x: center, y: bottom }]
    }
    return [
      ...swingIn,
      { x, y: below },
      { x: middle, y: below + reach / 2 },
      { x: gutter, y: below + reach },
      { x: gutter, y: below + reach + 30 }
    ]
  }

  // Along the top of the card and around the centered text to the flag next to the button
  ctaPoints (gutter, cta, heading, finish) {
    const top = cta.top + 34
    const left = Math.max(cta.left + 16, Math.min(heading.left - 140, finish.x - 60))
    return [{ x: gutter, y: top }, { x: left, y: top }, { x: left, y: finish.y }, finish]
  }

  // The route passes behind the covers, so a chevron moves on along the route until it is clear of them
  chevronPath (pins, covers) {
    const route = this.pathTarget
    const length = route.getTotalLength()
    const covered = ({ x, y }) => covers.some(({ left, right, top, bottom }) =>
      x > left - CHEVRON_SIZE && x < right + CHEVRON_SIZE && y > top - CHEVRON_SIZE && y < bottom + CHEVRON_SIZE)
    const marks = []
    // The route ends with a full dash, so these distances all put the chevron tip on the end of a dash
    const first = CHEVRON_SPACING / 2 + (length - CHEVRON_SPACING / 2) % DASH_PERIOD
    for (let distance = first; distance < length; distance += CHEVRON_SPACING) {
      while (distance < length && covered(route.getPointAtLength(distance))) { distance += DASH_PERIOD }
      if (distance >= length) { break }
      const { x, y } = route.getPointAtLength(distance)
      if (pins.some(pin => Math.hypot(pin.x - x, pin.y - PIN_HEAD - y) < CHEVRON_PIN_DISTANCE)) { continue }
      const before = route.getPointAtLength(distance - 4)
      const direction = Math.atan2(y - before.y, x - before.x)
      const arm = (turn) => {
        const angle = direction + turn
        return `${x - Math.cos(angle) * CHEVRON_SIZE} ${y - Math.sin(angle) * CHEVRON_SIZE}`
      }
      marks.push(`M${arm(0.7)} L${x} ${y} L${arm(-0.7)}`)
    }
    return marks.join(' ')
  }

  // In a wrapped grid the route stays in the gaps next to the cards, away from their text
  stackedFeatures (leftGutter, belowActions, grid, cards, importData, routing) {
    const gap = cards[0].right + 7
    const gapBelow = cards[2].right + 7
    // The pin stands close to the gap, so the route leaves the gap and returns to it in a half circle around the pin
    const radius = gapBelow - routing.x
    const arc = (side) => ({ x: routing.x + radius * 0.3, y: routing.y + side * radius * 0.7 })
    return [
      { x: leftGutter, y: belowActions }, { x: leftGutter, y: grid.top - 20 }, { x: importData.x, y: grid.top - 20 },
      importData,
      { x: gap, y: importData.y }, { x: gap, y: cards[2].top + 10 }, { x: gap, y: routing.y - radius },
      arc(-1), routing, arc(1),
      { x: gapBelow, y: routing.y + radius }, { x: gapBelow, y: grid.bottom + 30 }
    ]
  }

  // The spline turns in one point at a corner. Two points give it room for a wider curve.
  // The route must reach the pins, so they stay in place.
  widenCorners (allPoints) {
    const points = allPoints.filter((point, index) => {
      const before = allPoints[index - 1]
      return point.pin || !before || Math.hypot(point.x - before.x, point.y - before.y) > MIN_STEP
    })
    return points.flatMap((point, index) => {
      const before = points[index - 1]
      const after = points[index + 1]
      if (point.pin || !before || !after) { return [point] }
      const toBefore = Math.hypot(before.x - point.x, before.y - point.y)
      const toAfter = Math.hypot(after.x - point.x, after.y - point.y)
      const dot = (point.x - before.x) * (after.x - point.x) + (point.y - before.y) * (after.y - point.y)
      if (dot / (toBefore * toAfter) > CORNER_COSINE) { return [point] }
      const reach = Math.min(CORNER_REACH, toBefore / 2, toAfter / 2)
      const towards = (target, distance) => ({
        x: point.x + (target.x - point.x) * reach / distance,
        y: point.y + (target.y - point.y) * reach / distance
      })
      return [towards(before, toBefore), towards(after, toAfter)]
    })
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
  smoothPath (points, maxX) {
    const curves = points.slice(1).map((point, index) => {
      const start = points[index]
      const before = points[index - 1] || start
      const after = points[index + 2] || point
      const length = Math.hypot(point.x - start.x, point.y - start.y)
      // A long neighbor segment must not push a handle past a short segment
      const limit = (a, b) => Math.min(1, 2 * length / Math.hypot(b.x - a.x, b.y - a.y))
      const leave = limit(before, point)
      const arrive = limit(start, after)
      const handle = (axis) => [
        start[axis] + (point[axis] - before[axis]) / 6 * leave,
        point[axis] - (after[axis] - start[axis]) / 6 * arrive
      ]
      // Long segments push the handles out of the page at sharp bends
      const [x1, x2] = handle('x').map(x => Math.max(EDGE - WOBBLE, Math.min(x, maxX)))
      const [y1, y2] = handle('y')
      return `C${x1} ${y1} ${x2} ${y2} ${point.x} ${point.y}`
    })
    return `M${points[0].x} ${points[0].y} ${curves.join(' ')}`
  }
}
