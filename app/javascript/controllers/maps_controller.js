import { Controller } from '@hotwired/stimulus'

export default class extends Controller {

  static values = {
    sort: String,
    sortLabel: String,
    direction: String
  }

  async connect () {
  }

  changeSort(event) {
    this.sortValue = event.params.sort || this.sortValue
    this.sortLabelValue = event.params.sortLabel || this.sortLabelValue

    this.loadMaps(event)
    document.getElementById('sortTitle').innerText = this.sortLabelValue
  }

  changeDirection(event) {
    this.directionValue = event.params.direction || this.directionValue
    
    this.loadMaps(event)
    let sortIcon = document.getElementById('sortIcon')
    sortIcon.classList.remove('bi-sort-down', 'bi-sort-up')
    this.directionValue === 'desc' ? sortIcon.classList.add('bi-sort-down') : sortIcon.classList.add('bi-sort-up')
  }

  async loadMaps(_event) {
    const url = `/admin?sort=${this.sortValue}&direction=${this.directionValue}`
    const response = await fetch(url, {
      headers: { "Accept": "text/vnd.turbo-stream.html" }
    })
    const html = await response.text()
    Turbo.renderStreamMessage(html)
    // Optionally update URL in address bar without full reload
    window.history.replaceState({}, "", url)
  }
}
