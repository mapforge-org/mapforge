import { Controller } from '@hotwired/stimulus'

export default class extends Controller {

  static values = {
    search: String,
    sort: String,
    sortLabel: String,
    direction: String
  }

  async connect () {
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
    let template = document.getElementById('search-filter-template')
    
    let existingFilter = document.getElementById('search-filter')
    if (existingFilter) { existingFilter.remove() }
    if (this.searchValue !== '') {
      let searchFilter = template.cloneNode(true)
      searchFilter.id = 'search-filter'
      searchFilter.classList.remove('hidden')
      // searchFilter.innerText = this.searchValue
      searchFilter.querySelector('.search-val').innerText = this.searchValue
      template.after(searchFilter)
    }
  }

  clearFilter() {
    this.searchValue = ''
    this.loadMaps()
    let existingFilter = document.getElementById('search-filter')
    if (existingFilter) { existingFilter.remove() }
  }

  async loadMaps() {
    document.getElementById('map-list-count').innerText = 'Loading...'
    const url = `/admin?search=${this.searchValue}&sort=${this.sortValue}&direction=${this.directionValue}`
    const response = await fetch(url, {
      headers: { "Accept": "text/vnd.turbo-stream.html" }
    })
    const html = await response.text()
    Turbo.renderStreamMessage(html)
    // Optionally update URL in address bar without full reload
    window.history.replaceState({}, "", url)
  }
}
