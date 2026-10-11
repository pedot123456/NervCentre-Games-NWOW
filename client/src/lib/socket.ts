import type { Ack, ClientToServer } from '@shared/protocol'
import { createStore } from './store'

/**
 * The game channel. The original app used Socket.IO; on serverless hosting (Vercel) every event is
 * one HTTP call instead (POST /api/rt/<event>) with the same payloads and replies, and screens poll
 * for race updates. Times on screen use the SERVER clock (`serverNow`), synchronised here.
 */

export type Connection = 'connecting' | 'online' | 'offline'
export const connectionStore = createStore<Connection>('connecting')

let offset = 0
let bestRtt = Infinity

/** Current time on the server clock (epoch ms). */
export const serverNow = () => Date.now() + offset

type EventName = Exclude<keyof ClientToServer, 'time:sync' | 'display:watch' | 'race:unwatch'>
type Payload<E extends EventName> = Parameters<ClientToServer[E]>[0]
type Reply<E extends EventName> = Parameters<Parameters<ClientToServer[E]>[1]>[0]

let failures = 0
function markOnline() {
  failures = 0
  connectionStore.set('online')
}
function markFailure() {
  failures++
  if (failures >= 2 || connectionStore.get() !== 'online') connectionStore.set('offline')
}

/** Events that create a race or a player: on a cold serverless instance they can take several seconds (the API allows 15 s). */
const SLOW_EVENTS: ReadonlySet<EventName> = new Set<EventName>(['solo:start', 'h2h:start', 'room:create', 'room:join', 'room:start'])

const OFFLINE_MESSAGE = 'Could not reach the game server – please check the connection and try again.'

/** Sends one game event. Never throws: a dropped connection comes back as `{ ok: false, error: 'offline' }`. */
export async function emit<E extends EventName>(event: E, payload: Payload<E>, timeoutMs = SLOW_EVENTS.has(event) ? 20_000 : 8000): Promise<Reply<E>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`/api/rt/${event}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
      cache: 'no-store',
    })
    if (res.status >= 500) throw new Error(`server ${res.status}`)
    const body = (await res.json()) as Reply<E>
    markOnline()
    return body
  } catch {
    markFailure()
    return { ok: false, error: 'offline', message: OFFLINE_MESSAGE } as Ack<never> as Reply<E>
  } finally {
    clearTimeout(timer)
  }
}

/** Measures the clock offset: a few round trips, keeping the fastest (least network noise). */
export async function syncClock(samples = 5): Promise<void> {
  for (let i = 0; i < samples; i++) {
    try {
      const t0 = Date.now()
      const res = await fetch('/api/time', { cache: 'no-store' })
      const t1 = Date.now()
      const { now } = (await res.json()) as { now: number }
      const rtt = t1 - t0
      // Older measurements age a little, so a better network later can replace them.
      if (rtt <= bestRtt + 15) {
        bestRtt = rtt
        offset = now + rtt / 2 - t1
      }
      markOnline()
    } catch {
      markFailure()
      return
    }
  }
}

export function startSocket() {
  void syncClock()
  // Re-sync every 30 s (device clocks drift; networks change).
  setInterval(() => {
    bestRtt += 30
    void syncClock(3)
  }, 30_000)
  window.addEventListener('online', () => void syncClock(2))
  window.addEventListener('offline', () => connectionStore.set('offline'))
}

/** Plain JSON request to the API (results, feedback, boards). */
export async function getJson<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; status: number; body: T } | { ok: false; status: number; body: { error?: string; message?: string } }> {
  try {
    const res = await fetch(path, { cache: 'no-store', ...init })
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : {}
    if (res.status < 500) markOnline()
    return res.ok ? { ok: true, status: res.status, body: body as T } : { ok: false, status: res.status, body }
  } catch {
    markFailure()
    return { ok: false, status: 0, body: { error: 'offline', message: OFFLINE_MESSAGE } }
  }
}
