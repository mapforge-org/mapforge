import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { resetControls } from 'maplibre/controls/shared'

export default class extends Controller {
  connect () {
  }

  hideNavBar (_event) {
    functions.e('nav', e => { e.style.display = 'none' })
  }

  showNavBar (_event) {
    resetControls()
    functions.e('nav', e => { e.style.display = 'block' })
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
      this.showNavBar(event)
      this.showNavDropdown(event)
    } else {
      if (document.querySelector('.map')) { let controller = this; setTimeout(function () { controller.hideNavBar(event) }, 300) }
      this.hideNavDropdown(event)
    }
  }
}
