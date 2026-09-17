import { Controller } from '@hotwired/stimulus'
import { scrollToId } from 'helpers/dom'

// Note: Don't import map js here for faster frontpage load times

export default class extends Controller {
  scrollToFeatures (event) {
    event.preventDefault()
    scrollToId('features')
  }
}
