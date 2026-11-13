import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { animateElement  } from 'helpers/dom'

// Note: Don't import map js here for faster frontpage load times

export default class extends Controller {
  hideNavDropdown (event) {
    functions.e('.navbar-collapse.show', e => {
      bootstrap.Collapse.getOrCreateInstance(e).hide()
      // prevent default click handling on page when collapsing nav dropdown
      event.preventDefault()
    })
  }

  // Toggle Navbar + Dropdown on map page, only dropdown on other pages
  toggleNav (event) {
    if (document.querySelector('#navbar-dropdown.show')) { return this.hideNav(event) }
    // the select control owns the reset, and it only exists in edit mode
    document.querySelector('.maplibregl-ctrl-select')?.click()
    functions.e('#map-header nav', e => { e.style.display = 'block' })
    animateElement('#map-header nav', 'fade-down')
    functions.e('.navbar-collapse', e => { bootstrap.Collapse.getOrCreateInstance(e).show() })
  }

  // Control clicks that this controller fires itself (toggleNav, openMapSettings) bubble
  // up to the map element, which is bound to hideNav. Only a real gesture closes the nav.
  hideNav (event) {
    if (event && !event.isTrusted) { return }
    if (document.querySelector('.map')) {
      setTimeout(() => functions.e('#map-header nav', e => { e.style.display = 'none' }), 300)
    }
    this.hideNavDropdown(event)
  }

  // Switches the running map instead of loading the page again.
  async switchMode (event) {
    event.preventDefault()
    const link = event.currentTarget
    if (link.classList.contains('active')) { return }
    const url = link.getAttribute('href')
    const { switchMapMode } = await import('maplibre/map')
    await switchMapMode(link.dataset.mode, url.split('/').pop(), url)
  }

  openMapSettings (event) {
    event.preventDefault()
    if (document.querySelector('.map[data-map-loaded="true"]')) {
      document.querySelector('.maplibregl-ctrl-map')?.click()
    }
  }
}
