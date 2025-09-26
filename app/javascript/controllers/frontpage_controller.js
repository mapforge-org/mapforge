import { Controller } from '@hotwired/stimulus'

// Note: Don't import map js here for faster frontpage load times

export default class extends Controller {
  swiper = null

  async connect () {
    this.swiper = this.initSwiper()
  }

  async initSwiper () {

    // Dynamically import Swiper only when this controller is connected
    const Swiper = (await import('swiper')).default
    const { Navigation, Pagination } = (await import('swiper/modules'))

    const config = {
      modules: [Navigation, Pagination],
      loop: true,
      speed: 1000,
      autoplay: {
        delay: 5000
      },
      slidesPerView: 1,
      centeredSlides: true,
      navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev'
      },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },    
      on: {
        slideChange: () => {
          this.slideChange()
        }
      }
    }
    return new Swiper('.swiper', config)
  }

  slideChange () {
    if (this.swiper && document.getElementById('swiper-image')) {
      this.swiper.then(sw => {
        // console.log('Slide changed to:', sw.realIndex)
        document.getElementById('swiper-image').src = 'images/frontpage/feature' + sw.realIndex + '.png'
      })
    }
  }
}
