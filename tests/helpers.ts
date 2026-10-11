import type { AddressInfo } from 'node:net'
import type { Puzzle, RaceState, RunProgress, Settings } from '@shared/types'
import { buildApp } from '../server/app'
import { createStore } from '../server/db/store'

/**
 * Test client for the HTTP "realtime" API (POST /api/rt/<event>). It remembers the last race it
 * joined or watched, so `nextState` can poll that race like a device does.
 */
export interface Client {
  url: string
  watch: { race_id: string; run_id?: string; token?: string; host_token?: string } | null
  connected: boolean
  disconnect(): void
}

/** A server on a random port with an in-memory database and an adjustable clock. */
export async function startServer(settings: Partial<Settings> = {}) {
  const { store } = await createStore({ dataDir: 'memory://' })
  if (Object.keys(settings).length) await store.setSettings(settings)
  let offset = 0
  const clock = () => Date.now() + offset
  const built = await buildApp({ store, appVersion: 'test', adminDefaultPin: '1234', clock })
  await built.app.listen({ port: 0, host: '127.0.0.1' })
  const url = `http://127.0.0.1:${(built.app.server.address() as AddressInfo).port}`
  return {
    ...built,
    store,
    url,
    clock,
    /** Moves the server clock forward (skips the 3-2-1 or uses up race time). */
    advance(ms: number) {
      offset += ms
    },
    async connect(): Promise<Client> {
      const c: Client = {
        url,
        watch: null,
        connected: true,
        disconnect() {
          c.connected = false
        },
      }
      return c
    },
    async close() {
      await built.app.close()
      await store.close()
    },
  }
}

export type TestServer = Awaited<ReturnType<typeof startServer>>

/** A player from a project (free-text project name). */
export const player = (full_name: string, project_name = 'Kasawari CCS') => ({ full_name, affiliation_type: 'project' as const, project_name, opu: null, consent: true })
/** A player from a business OPU (from the Admin list). */
export const bizPlayer = (full_name: string, opu = 'Upstream - PMA') => ({ full_name, affiliation_type: 'business' as const, project_name: null, opu, consent: true })

/** Sends an event and returns the reply (like a Socket.IO acknowledgement). */
export async function ask<T = Record<string, unknown>>(c: Client, event: string, payload?: unknown): Promise<T> {
  const res = await fetch(`${c.url}/api/rt/${event}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload ?? {}) })
  const body = (await res.json()) as T & { ok?: boolean; race?: RaceState; run_id?: string; token?: string; host_token?: string }
  if (body.ok && body.race) {
    if (body.run_id && body.token) c.watch = { race_id: body.race.id, run_id: body.run_id, token: body.token }
    else if (body.host_token) c.watch = { race_id: body.race.id, host_token: body.host_token }
    else if (event === 'race:watch') c.watch = payload as Client['watch']
  }
  return body
}

/** Tile ids that build the current puzzle, in order. */
export function correctTiles(puzzles: Puzzle[], progress: RunProgress): string[] {
  const puzzle = puzzles[progress.queue[0]]
  const used = new Set(progress.used)
  const out: string[] = []
  for (const token of puzzle.answer.slice(progress.progress)) {
    const tile = puzzle.tiles.find((t) => t.text === token.text && !used.has(t.id))!
    used.add(tile.id)
    out.push(tile.id)
  }
  return out
}

export interface Seat {
  race_id: string
  run_id: string
  token: string
}

/** Plays the current puzzle correctly; returns the last tap result. */
export async function solveOne(c: Client, race: RaceState, seat: Seat, progress: RunProgress) {
  type TapRes = { ok: boolean; outcome: string; progress: RunProgress; status: string }
  let last: TapRes | null = null
  const puzzle = progress.queue[0]
  for (const tile of correctTiles(race.puzzles, progress)) {
    const res: TapRes = await ask<TapRes>(c, 'run:tap', { ...seat, puzzle, tile })
    if (!res.ok) throw new Error(`tap failed: ${JSON.stringify(res)}`)
    last = res
  }
  return last!
}

export async function http<T = Record<string, unknown>>(url: string, path: string, opts: { method?: string; json?: unknown; token?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  if (opts.json !== undefined) headers['content-type'] = 'application/json'
  if (opts.token) headers.authorization = `Bearer ${opts.token}`
  const res = await fetch(url + path, { method: opts.method ?? (opts.json !== undefined ? 'POST' : 'GET'), headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined })
  const type = res.headers.get('content-type') ?? ''
  const body = type.includes('json') ? ((await res.json()) as T) : ((await res.arrayBuffer()) as unknown as T)
  return { status: res.status, body, headers: res.headers }
}

/** Signs in with the default PIN and changes it, returning an Admin token. */
export async function adminToken(url: string, pin = '482915'): Promise<string> {
  const first = await http<{ token: string; must_change_pin: boolean }>(url, '/api/admin/login', { json: { pin: '1234' } })
  if (first.status === 200 && first.body.must_change_pin) {
    await http(url, '/api/admin/pin', { json: { current: '1234', next: pin }, token: first.body.token })
  }
  const login = await http<{ token: string }>(url, '/api/admin/login', { json: { pin } })
  return login.body.token
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Polls the client's race (like a device) until the state matches `pred`. */
export async function nextState(c: Client, pred: (r: RaceState) => boolean, timeoutMs = 8000): Promise<RaceState> {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (c.watch) {
      const res = await fetch(`${c.url}/api/rt/race:watch`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c.watch) })
      const body = (await res.json()) as { ok: boolean; race?: RaceState }
      if (body.ok && body.race && pred(body.race)) return body.race
    }
    await wait(100)
  }
  throw new Error('timed out waiting for race state')
}
