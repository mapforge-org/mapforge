import * as functions from 'helpers/functions';

export function initContextMenu(e) {
  functions.e('#map-context-menu', el => {
    el.innerHTML = ''
    // Position the context menu
    el.style.left = `${e.point.x}px`
    el.style.top = `${e.point.y}px`
  })
}

export function hideContextMenu () {
  functions.e('#map-context-menu', menu => {
    menu.innerHTML = ''
    menu.classList.add('hidden')
  })
}