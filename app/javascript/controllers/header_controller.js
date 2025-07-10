import { Controller } from '@hotwired/stimulus'
import * as functions from 'helpers/functions'
import { animateElement  } from 'helpers/dom'
import { resetControls } from 'maplibre/controls/shared'

export default class extends Controller {
  connect () {
  }

  hideNavBar (_event) {
    functions.e('#map-header nav', e => { e.style.display = 'none' })
    animateElement('#map-header nav', 'fade-up')
  }

  showNavBar (_event) {
    resetControls()
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
      this.showNavBar(event)
      this.showNavDropdown(event)
    } else {
      this.hideNav (event)
    }
  }

  hideNav (_event) {
    if (document.querySelector('.map')) { let controller = this; setTimeout(function () { controller.hideNavBar(event) }, 300) }
    this.hideNavDropdown(event)
  }  
}
