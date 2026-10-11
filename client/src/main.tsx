import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/nunito'
import '@fontsource-variable/space-grotesk'
import './styles.css'
import { App } from './App'
import { startData } from './lib/data'
import { startFeedbackSync } from './lib/feedback'
import { startSocket } from './lib/socket'
import { sfx } from './lib/sound'

/**
 * Kiosk hardening for touchscreens: no context menu / long-press menu, no pinch or ctrl-wheel
 * zoom, no image dragging, and links never open other sites on the kiosk.
 * (Pull-to-refresh, double-tap zoom and text selection are disabled in CSS.)
 */
function installKioskGuards() {
  const locked = () => document.documentElement.classList.contains('kiosk') || document.documentElement.classList.contains('route-phone')
  window.addEventListener('contextmenu', (e) => {
    const t = e.target instanceof Element ? e.target : null
    if (locked() && !t?.closest('input, textarea')) e.preventDefault()
  })
  document.addEventListener('gesturestart', (e) => locked() && e.preventDefault())
  window.addEventListener('wheel', (e) => locked() && e.ctrlKey && e.preventDefault(), { passive: false })
  window.addEventListener('keydown', (e) => {
    if (locked() && (e.ctrlKey || e.metaKey) && ['+', '=', '-', '0'].includes(e.key)) e.preventDefault()
  })
  window.addEventListener('dragstart', (e) => locked() && e.target instanceof HTMLImageElement && e.preventDefault())
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (locked() && a && /^https?:/i.test(a.getAttribute('href') ?? '') && new URL(a.getAttribute('href')!, location.href).origin !== location.origin) {
        e.preventDefault()
      }
    },
    true,
  )
  window.addEventListener('pointerdown', () => sfx.unlock(), { once: true })
}

installKioskGuards()
startSocket()
startData()
// Feedback answered while offline is sent as soon as the connection is back.
startFeedbackSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
