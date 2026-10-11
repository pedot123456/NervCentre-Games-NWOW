import { useEffect } from 'react'
import type { Boards, PublicConfig, RaceState } from '@shared/types'
import { getJson } from './socket'
import { applySoundDefault } from './sound'
import { createStore, useStore } from './store'

/**
 * Shared data the screens read: public config (settings, solution names), the boards and live races.
 * Kept fresh by polling: screens showing live races (TV display, Home) ask for /api/live often;
 * otherwise a light "pulse" tells when boards or settings changed.
 */

export const configStore = createStore<PublicConfig | null>(null)
export const boardsStore = createStore<Boards | null>(null)
export const liveStore = createStore<RaceState[]>([])

let lastPulse = { boards: -1, settings: -1 }
let liveWatchers = 0
let timer: ReturnType<typeof setTimeout> | null = null

export async function loadConfig() {
  const res = await getJson<PublicConfig>('/api/config')
  if (res.ok) {
    configStore.set(res.body)
    applySoundDefault(res.body.settings.sound_default)
  }
}

export async function loadBoards() {
  const res = await getJson<Boards>('/api/boards')
  if (res.ok) boardsStore.set(res.body)
}

function onPulse(p: { boards: number; settings: number }) {
  if (lastPulse.boards !== -1 && p.boards !== lastPulse.boards) void loadBoards()
  if (lastPulse.settings !== -1 && p.settings !== lastPulse.settings) void loadConfig()
  lastPulse = p
}

async function tick() {
  timer = null
  if (document.hidden) return schedule(5000)
  if (liveWatchers > 0) {
    const res = await getJson<{ live: RaceState[]; pulse: { boards: number; settings: number } }>('/api/live')
    if (res.ok) {
      liveStore.set(res.body.live)
      onPulse(res.body.pulse)
    }
    schedule(2000)
  } else {
    const res = await getJson<{ boards: number; settings: number }>('/api/pulse')
    if (res.ok) onPulse(res.body)
    schedule(12_000)
  }
}

function schedule(ms: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void tick(), ms)
}

export function startData() {
  void loadConfig()
  void loadBoards()
  schedule(1500)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schedule(100)
  })
}

/** Live races, polled while a screen that shows them is open. */
export function useLive(): RaceState[] {
  const live = useStore(liveStore)
  useLiveWatch()
  return live
}

function useLiveWatch() {
  useEffect(() => {
    liveWatchers++
    schedule(50)
    return () => {
      liveWatchers--
    }
  }, [])
}

/** Refresh the boards now (after a game ends). */
export const refreshBoards = () => loadBoards()
