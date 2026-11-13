import { Controller } from '@hotwired/stimulus'
import { debounce } from 'helpers/functions'

export default class extends Controller {
  static targets = ['tagInput', 'tagMenu', 'tagToggle']

  static values = {
    search: String,
    tag: String,
    sort: String,
    sortLabel: String,
    direction: String
  }

  async connect () {
    // Clear map instance and its event listeners
    if (window.map) {
      try { window.map.remove() } catch { console.warn('No map instance to remove')}
    }
  }

  sortValueChanged() {
    this.markActive('sort', this.sortValue)
  }

  directionValueChanged() {
    this.markActive('direction', this.directionValue)
  }

  tagValueChanged() {
    this.markActive('tag', this.tagValue)
    if (this.hasTagToggleTarget) this.tagToggleTarget.classList.toggle('active', this.tagValue !== '')
  }

  // Bold marks the current choice in the sort and tag menus
  markActive(param, value) {
    const attribute = `data-maps-${param}-param`
    this.element.querySelectorAll(`[${attribute}]`).forEach(item => {
      item.classList.toggle('fw-bold', item.getAttribute(attribute).toLowerCase() === value.toLowerCase())
    })
  }

  changeSort(event) {
    this.sortValue = event.params.sort || this.sortValue
    this.sortLabelValue = event.params.sortLabel || this.sortLabelValue

    this.loadMaps()
    document.getElementById('sortTitle').innerText = this.sortLabelValue
  }

  changeDirection(event) {
    this.directionValue = event.params.direction || this.directionValue

    this.loadMaps()
    let sortIcon = document.getElementById('sortIcon')
    sortIcon.classList.remove('bi-sort-down', 'bi-sort-up')
    this.directionValue === 'desc' ? sortIcon.classList.add('bi-sort-down') : sortIcon.classList.add('bi-sort-up')
  }

  search(event) {
    const value = event.target.value
    debounce(() => {
      this.searchValue = value
      this.loadMaps()
    }, 'maps-search', 300)
  }

  showTags() {
    this.tagMenuTarget.classList.add('show')
  }

  closeTags() {
    this.tagMenuTarget.classList.remove('show')
  }

  hideTags(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) this.closeTags()
  }

  // Typing only narrows the proposals, so a partial name does not empty the list. Enter or a proposal applies it.
  typeTag() {
    const text = this.tagInputTarget.value.trim()
    this.filterTags(text)
    this.showTags()
    if (!text) this.applyTag()
  }

  filterTags(text) {
    this.tagMenuTarget.querySelectorAll('li').forEach(item => {
      item.hidden = !item.dataset.tag.toLowerCase().includes(text.toLowerCase())
    })
  }

  // Picking the current tag again removes it, because the icon button of narrow screens has no X
  pickTag(event) {
    const tag = String(event.params.tag)
    this.tagInputTarget.value = tag.toLowerCase() === this.tagValue.toLowerCase() ? '' : tag
    this.filterTags(this.tagInputTarget.value)
    this.applyTag()
  }

  // The icon button opens all proposals, because narrow screens hide the input that narrows them
  toggleTags(event) {
    // Safari does not focus a clicked button, and only a focused button closes the menu on focusout
    event.currentTarget.focus()
    if (this.tagMenuTarget.classList.contains('show')) return this.closeTags()
    this.filterTags('')
    this.showTags()
  }

  clearTag() {
    this.tagInputTarget.value = ''
    this.filterTags('')
    this.applyTag()
  }

  applyTag() {
    this.closeTags()
    const value = this.tagInputTarget.value.trim()
    if (value === this.tagValue) return
    this.tagValue = value
    this.loadMaps()
  }

  // Adds the current search and sort, which change in the URL without a page load
  quickFilter(event) {
    event.preventDefault()
    const params = new URLSearchParams(location.search)
    params.set('quick', event.params.quick)
    Turbo.visit(`${location.pathname}?${params}`)
  }

  clearFilter() {
    this.searchValue = ''
    document.getElementById('search').value = ''
    this.loadMaps()
  }

  async loadMaps() {
    document.getElementById('map-list-count').innerText = window.__('Loading...')
    // Start from the current params, so the admin quick filter stays set
    const params = new URLSearchParams(location.search)
    params.set('search', this.searchValue)
    params.set('tag', this.tagValue)
    params.set('sort', this.sortValue)
    params.set('direction', this.directionValue)
    const url = `${location.pathname}?${params}`
    const request = this.lastRequest = Symbol('maps')
    const response = await fetch(url, {
      headers: { "Accept": "text/vnd.turbo-stream.html" }
    })
    const html = await response.text()
    // A slower response for older input must not overwrite a newer one
    if (request !== this.lastRequest) return
    Turbo.renderStreamMessage(html)
    // Optionally update URL in address bar without full reload
    window.history.replaceState({}, "", url)
  }
}
