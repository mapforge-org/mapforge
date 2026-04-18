// ESM wrapper for deck.gl UMD bundle
// This loads the UMD bundle and provides it as an ESM module

let loadPromise = null

async function loadDeckGL() {
  if (window.deck) return window.deck
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/deck.gl@9.1.15/dist.min.js'
    script.onload = () => {
      if (!window.deck) {
        reject(new Error('deck.gl failed to load'))
      } else {
        resolve(window.deck)
      }
    }
    script.onerror = () => reject(new Error('Failed to load deck.gl script'))
    document.head.appendChild(script)
  })

  return loadPromise
}

// Re-export everything from the loaded module
export default loadDeckGL()
