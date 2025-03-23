import { Controller } from '@hotwired/stimulus'
// import * as functions from 'helpers/functions'
import { resetControls } from 'maplibre/controls/shared'

export default class extends Controller {
  connect () {
    //functions.e('#tour-modal', e => { e.classList.add('show') })
  }

  close () {
    resetControls()
    // TODO: localstorage don't show again
  }
}
