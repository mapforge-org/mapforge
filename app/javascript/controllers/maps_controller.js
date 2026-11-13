import { Controller } from '@hotwired/stimulus'

export default class extends Controller {

  static values = {
    search: String,
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
    this.searchValue = event.target.value
    this.loadMaps()
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
    params.set('sort', this.sortValue)
    params.set('direction', this.directionValue)
    const url = `${location.pathname}?${params}`
    const response = await fetch(url, {
      headers: { "Accept": "text/vnd.turbo-stream.html" }
    })
    const html = await response.text()
    Turbo.renderStreamMessage(html)
    // Optionally update URL in address bar without full reload
    window.history.replaceState({}, "", url)
  }
}
