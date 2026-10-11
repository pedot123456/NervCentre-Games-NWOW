import { lazy, Suspense, useEffect } from 'react'
import { Starfield } from './components/Starfield'
import { ConnectionBanner, RehearsalBadge } from './components/ui'
import { DisplayApp } from './display/DisplayApp'
import { KioskApp } from './kiosk/KioskApp'
import { configStore } from './lib/data'
import { useRoute } from './lib/hooks'
import { useStore } from './lib/store'
import { PlayerApp } from './player/PlayerApp'

const AdminApp = lazy(() => import('./admin/AdminApp'))

const openAdmin = () => {
  location.hash = '#/admin'
}

/** Routes: #/ kiosk · #/join/1234 phones · #/display TV · #/admin staff (PIN). */
export function App() {
  const route = useRoute()
  const config = useStore(configStore)

  useEffect(() => {
    const html = document.documentElement
    html.classList.toggle('kiosk', route.name === 'kiosk' || route.name === 'display')
    html.classList.toggle('route-phone', route.name === 'join')
    html.classList.toggle('route-admin', route.name === 'admin')
  }, [route.name])

  // Ctrl + Shift + A opens Admin from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        openAdmin()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (route.name === 'admin') {
    return (
      <Suspense fallback={<div className="p-10 text-center text-muted">Loading admin…</div>}>
        <AdminApp />
      </Suspense>
    )
  }
  return (
    <>
      <Starfield density={route.name === 'join' ? 0.6 : 1} />
      <ConnectionBanner />
      {route.name !== 'display' && <RehearsalBadge on={config?.settings.rehearsal_mode} />}
      {route.name === 'join' ? <PlayerApp key={route.code} code={route.code} /> : route.name === 'display' ? <DisplayApp /> : <KioskApp onAdmin={openAdmin} />}
    </>
  )
}
