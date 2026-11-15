import { Controller } from '@hotwired/stimulus'

const PRESETS = {
  park: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[11.0735, 49.4455], [11.0790, 49.4450], [11.0805, 49.4485], [11.0755, 49.4495], [11.0735, 49.4455]]]
    },
    properties: {
      label: 'Stadtpark',
      'label-background': 'shadow',
      fill: '#9ccc65',
      'fill-opacity': 0.7,
      'fill-pattern': 'hatch',
      stroke: '#33691e',
      'stroke-width': 3
    }
  },
  cafe: {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [11.077, 49.447] },
    properties: { label: 'Café', 'marker-shape': 'pin', 'marker-color': '#b9531d', 'marker-symbol': '☕', 'marker-size': 20 }
  },
  trail: {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[11.070, 49.444], [11.074, 49.447], [11.079, 49.446], [11.084, 49.449]] },
    properties: { label: 'Wanderweg', stroke: '#8e2a0b', 'stroke-width': 4, 'stroke-dasharray': true }
  },
  building: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[11.0763, 49.4465], [11.0777, 49.4465], [11.0777, 49.4474], [11.0763, 49.4474], [11.0763, 49.4465]]]
    },
    properties: { label: 'Turm', fill: '#9ccc65', 'fill-extrusion-color': '#558b2f', 'fill-extrusion-height': 40 }
  }
}

// "Load in playground" switches to this preset when the property does not apply to the current geometry
const GEOMETRY_PRESETS = { Point: 'cafe', LineString: 'trail', Polygon: 'park' }

// The value lists of the markdown are strings, the feature needs numbers and booleans
const typed = (value) => {
  if (value === 'true' || value === 'false') { return value === 'true' }
  return /^-?\d*\.?\d+$/.test(value) ? Number(value) : value
}

export default class extends Controller {
  static targets = ['editor', 'status', 'preview', 'preset', 'cursorName', 'cursorChips', 'cursorDesc',
    'cursorValues', 'cursorRelated', 'search', 'tab', 'card']

  static values = { properties: Array, geometries: Object }

  connect () {
    this.properties = Object.fromEntries(this.propertiesValue.map(property => [property.name, property]))
    this.group = 'All'
    const shared = new URLSearchParams(window.location.search).get('feature')
    if (shared) {
      this.editorTarget.value = shared
      this.edit()
    } else {
      this.loadPreset({ params: { preset: 'park' } })
    }
  }

  previewMessage (event) {
    if (event.origin !== window.location.origin || event.data?.type !== 'style-preview-ready') { return }
    this.ready = true
    this.post(true)
  }

  loadPreset ({ params: { preset } }) {
    this.presetTargets.forEach(button => {
      button.classList.toggle('active', button.dataset.stylePlaygroundPresetParam === preset)
    })
    this.setFeature(structuredClone(PRESETS[preset]), true)
  }

  // Properties first and the coordinates on one line, so that the style properties stay in view
  setFeature (feature, fit = false) {
    const { type, properties, geometry, ...rest } = feature
    const ordered = { type, properties, geometry: { ...geometry, coordinates: '__coordinates__' }, ...rest }
    this.editorTarget.value = JSON.stringify(ordered, null, 2)
      .replace('"__coordinates__"', JSON.stringify(geometry.coordinates))
    this.edit(fit)
  }

  edit (fit = false) {
    try {
      const feature = JSON.parse(this.editorTarget.value)
      if (feature?.type !== 'Feature' || !feature.geometry?.type) { throw new Error(window.__('Not a GeoJSON feature')) }
      this.feature = feature
      this.setStatus('✓ ' + window.__('valid'))
      this.post(fit === true)
    } catch (error) {
      this.setStatus(error.message, true)
    }
    this.showCursor()
  }

  setStatus (text, error = false) {
    this.statusTarget.textContent = text
    this.statusTarget.classList.toggle('error', error)
  }

  post (fit) {
    if (!this.ready || !this.feature) { return }
    const pitch = this.feature.properties?.['fill-extrusion-height'] ? 50 : 0
    this.previewTarget.contentWindow.postMessage(
      { type: 'style-preview', feature: { ...this.feature, id: 'preview' }, fit, pitch }, window.location.origin)
  }

  geometryType () {
    return (this.feature?.geometry?.type || '').replace('Multi', '')
  }

  showCursor () {
    const { value, selectionStart } = this.editorTarget
    const lineEnd = value.indexOf('\n', selectionStart)
    const line = value.slice(value.lastIndexOf('\n', selectionStart - 1) + 1, lineEnd === -1 ? undefined : lineEnd)
    const property = this.properties[line.match(/"([a-z-]+)"\s*:/)?.[1]]
    if (property) { this.renderCursor(property) }
  }

  renderCursor (property) {
    const geometries = property.geometries
    const info = geometries[this.geometryType()] || geometries.All || Object.values(geometries)[0]
    const current = this.feature?.properties?.[property.name]
    this.cursorNameTarget.textContent = property.name
    this.cursorChipsTarget.replaceChildren(
      ...Object.keys(geometries).map(geometry => this.chip(this.geometriesValue[geometry])),
      ...(info.default ? [this.chip(window.__('default: %{value}').replace('%{value}', info.default))] : []))
    // The description is our own markdown from docs/tutorials, rendered on the server
    this.cursorDescTarget.innerHTML = info.html
    this.cursorValuesTarget.replaceChildren(...property.values.map(value => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'styling-value'
      button.classList.toggle('active', String(current) === value)
      button.textContent = value
      button.addEventListener('click', () => this.setProperty(property.name, typed(value)))
      return button
    }))
    this.cursorRelatedTarget.replaceChildren(...this.propertiesValue
      .filter(other => other.group === property.group && other.name !== property.name).slice(0, 5)
      .map(other => {
        const link = document.createElement('a')
        link.href = `#property-${other.name}`
        link.textContent = other.name
        return link
      }))
  }

  chip (text) {
    const chip = document.createElement('span')
    chip.className = 'styling-chip'
    chip.textContent = text
    return chip
  }

  setProperty (name, value) {
    this.feature.properties = { ...this.feature.properties, [name]: value }
    this.setFeature(this.feature)
    // keep the cursor on the property, so that the panel stays on it
    const position = this.editorTarget.value.indexOf(`"${name}"`) + 1
    this.editorTarget.setSelectionRange(position, position)
    this.showCursor()
  }

  loadProperty ({ params: { name } }) {
    const property = this.properties[name]
    if (!property.geometries.All && !property.geometries[this.geometryType()]) {
      this.loadPreset({ params: { preset: GEOMETRY_PRESETS[Object.keys(property.geometries)[0]] } })
    }
    this.setProperty(name, property.example)
    this.editorTarget.focus({ preventScroll: true })
  }

  async copy () {
    await navigator.clipboard.writeText(this.editorTarget.value)
    this.setStatus(window.__('Copied'))
  }

  async share () {
    const url = `${window.location.origin}${window.location.pathname}?feature=` +
      encodeURIComponent(JSON.stringify(this.feature))
    window.history.replaceState(null, '', url)
    await navigator.clipboard.writeText(url)
    this.setStatus(window.__('Link copied'))
  }

  filterGroup ({ params: { group } }) {
    this.group = group
    this.tabTargets.forEach(tab => tab.classList.toggle('active', tab.dataset.stylePlaygroundGroupParam === group))
    this.filter()
  }

  filter () {
    const query = this.searchTarget.value.trim().toLowerCase()
    this.cardTargets.forEach(card => {
      const inGroup = this.group === 'All' || card.dataset.group === this.group
      card.hidden = !inGroup || !card.textContent.toLowerCase().includes(query)
    })
  }
}
