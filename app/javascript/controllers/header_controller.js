import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { animateElement  } from 'helpers/dom'

// Note: Don't import map js here for faster frontpage load times

export default class extends Controller {
  connect () {
  }

  hideNavBar (_event) {
    functions.e('#map-header nav', e => { e.style.display = 'none' })
    // aos cannot fade elements out
    // animateElement('#map-header nav', 'fade-up')
  }

  showNavBar (_event) {
    functions.e('#map-header nav', e => { e.style.display = 'block' })
    animateElement('#map-header nav', 'fade-down')
  }  

  hideNavDropdown (event) {
    functions.e('.navbar-collapse.show', e => {
      let bsCollapse = new bootstrap.Collapse(e)
      bsCollapse.hide()
      // prevent default click handling on page when collapsing nav dropdown
      event.preventDefault()
    })
  }

  showNavDropdown (_event) {
    functions.e('.navbar-collapse', e => {
      let bsCollapse = new bootstrap.Collapse(e)
      bsCollapse.show()
    })
  }

  // Toggle Navbar + Dropdown on map page, only dropdown on other pages
  toggleNav (event) {
    if (!document.querySelector('#navbar-dropdown.show')) {
      // the select control owns the reset, and it only exists in edit mode
      document.querySelector('.maplibregl-ctrl-select')?.click()
      this.showNavBar(event)
      this.showNavDropdown(event)
    } else {
      this.hideNav (event)
    }
  }

  // Control clicks that this controller fires itself (toggleNav, openMapSettings) bubble
  // up to the map element, which is bound to hideNav. Only a real gesture closes the nav.
  hideNav (event) {
    if (event && !event.isTrusted) { return }
    if (document.querySelector('.map')) { let controller = this; setTimeout(function () { controller.hideNavBar(event) }, 300) }
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
    const mapElement = document.querySelector('.map')
    if (mapElement && mapElement.getAttribute('data-map-loaded') === 'true') {
      const settingsButton = document.querySelector('.maplibregl-ctrl-map')
      if (settingsButton) {
        settingsButton.click()
      }
    }
    event.preventDefault()
  }
}
