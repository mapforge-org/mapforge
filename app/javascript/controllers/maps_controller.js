import { Controller } from '@hotwired/stimulus'

export default class extends Controller {
  async connect () {
  }

  async loadMaps(event) {
    const url = `/admin?sort=${event.params.sort}&direction=${event.params.direction}`

    const response = await fetch(url, {
      headers: { "Accept": "text/vnd.turbo-stream.html" }
    })

    const html = await response.text()
    Turbo.renderStreamMessage(html)

    // Optionally update URL in address bar without full reload
    window.history.replaceState({}, "", url)
  }
}
