import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import { App } from './App'

// Run before the first React render so that:
// 1. --tma-vh is set to the real viewport height from frame 0, preventing
//    the 100vh fallback from pushing MobileHeader off-screen on iOS compact mode
//    (on iOS, 100vh can equal the full WKWebView height rather than the compact
//    viewport visible to the user, causing overflow:hidden to clip the bottom bar).
// 2. expand() is called as early as possible so the expansion animation starts
//    before React paints its first frame, minimising the compact-mode flash.
const _twa = window.Telegram?.WebApp
if (_twa) {
  document.documentElement.style.setProperty('--tma-vh', `${window.innerHeight}px`)
  _twa.expand()
  _twa.requestFullscreen?.()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
