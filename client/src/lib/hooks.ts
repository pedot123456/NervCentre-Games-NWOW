import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { serverNow } from './socket'

// ── Routing (hash routes) ───────────────────────────────────────────────────

export type Route = { name: 'kiosk' } | { name: 'join'; code: string | null } | { name: 'display' } | { name: 'admin' }

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+/, '')
  const [first, second] = path.split('/')
  if (first === 'join') return { name: 'join', code: second && /^\d{4}$/.test(second) ? second : null }
  if (first === 'display') return { name: 'display' }
  if (first === 'admin') return { name: 'admin' }
  return { name: 'kiosk' }
}

const subscribeHash = (fn: () => void) => {
  window.addEventListener('hashchange', fn)
  return () => window.removeEventListener('hashchange', fn)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash, () => '')
  const [route, setRoute] = useState(() => parseRoute(hash))
  useEffect(() => {
    const next = parseRoute(hash)
    setRoute((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next))
  }, [hash])
  return route
}

// ── Media queries ───────────────────────────────────────────────────────────

/** Phones: narrow in portrait, or short (a phone turned sideways). Same as the `phone:` CSS variant. */
export const PHONE_QUERY = '(max-width: 640px), (max-height: 520px)'
export const SHORT_QUERY = '(max-height: 520px)'
export const PORTRAIT_QUERY = '(orientation: portrait)'

export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (fn: () => void) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', fn)
      return () => m.removeEventListener('change', fn)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

export const useIsPhone = () => useMedia(PHONE_QUERY)

// ── Timing ──────────────────────────────────────────────────────────────────

/** Re-renders every `ms` (or every animation frame with ms = 0) and returns the server time. */
export function useServerNow(ms = 250): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    if (ms === 0) {
      let raf = 0
      const loop = () => {
        setNow(serverNow())
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => cancelAnimationFrame(raf)
    }
    const t = setInterval(() => setNow(serverNow()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (ms === null) return
    const t = setInterval(() => ref.current(), ms)
    return () => clearInterval(t)
  }, [ms])
}

/**
 * Returns to the attract screen after `seconds` without a tap. Returns the seconds left (for the
 * "Back to the home page in n s" hint). Any pointer or key press restarts the count.
 */
export function useIdle(seconds: number, onIdle: () => void, enabled = true): number {
  const [left, setLeft] = useState(seconds)
  const last = useRef(Date.now())
  const cb = useRef(onIdle)
  cb.current = onIdle
  useEffect(() => {
    if (!enabled) return
    last.current = Date.now()
    setLeft(seconds)
    const reset = () => {
      last.current = Date.now()
      setLeft(seconds)
    }
    window.addEventListener('pointerdown', reset)
    window.addEventListener('keydown', reset)
    const t = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(seconds - (Date.now() - last.current) / 1000))
      setLeft(remaining)
      if (remaining <= 0) {
        clearInterval(t)
        cb.current()
      }
    }, 250)
    return () => {
      clearInterval(t)
      window.removeEventListener('pointerdown', reset)
      window.removeEventListener('keydown', reset)
    }
  }, [seconds, enabled])
  return left
}

// ── Gestures ────────────────────────────────────────────────────────────────

/** Press and hold for `ms` (the staff shortcut on the NWOW logo). */
export function useLongPress(onHold: () => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => cancel, [])
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      cancel()
      timer.current = setTimeout(() => {
        timer.current = null
        onHold()
      }, ms)
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  }
}

// ── Full screen ─────────────────────────────────────────────────────────────

const subscribeFullscreen = (fn: () => void) => {
  document.addEventListener('fullscreenchange', fn)
  return () => document.removeEventListener('fullscreenchange', fn)
}

export function useFullscreen(): [boolean, () => void] {
  const on = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false)
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }, [])
  return [on, toggle]
}
