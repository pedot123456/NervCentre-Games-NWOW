import { useCallback, useEffect, useRef, useState } from 'react'
import type { Fail } from '@shared/protocol'
import type { RaceState } from '@shared/types'
import { emit } from './socket'

export interface WatchParams {
  race_id: string
  run_id?: string
  token?: string
  host_token?: string
}

/** How often to ask for the race state, by status. */
function pollMs(race: RaceState | null, fast: boolean): number | null {
  if (!race) return 1000
  switch (race.status) {
    case 'lobby':
      return 1500
    case 'howto':
      return 1000
    case 'running':
      return fast ? 600 : 1500
    default:
      return null
  }
}

/**
 * Keeps a race state fresh by polling `race:watch` (which also tells the server this device is
 * still connected). `fast` polls quicker while racing (to show other players' progress live).
 */
export function useRace(watch: WatchParams | null, opts: { initial?: RaceState | null; fast?: boolean } = {}) {
  const [race, setRace] = useState<RaceState | null>(opts.initial ?? null)
  const [error, setError] = useState<Fail | null>(null)
  const key = watch ? `${watch.race_id}|${watch.run_id ?? ''}|${watch.host_token ? 'h' : ''}` : ''
  const watchRef = useRef(watch)
  watchRef.current = watch
  const raceRef = useRef(race)
  raceRef.current = race

  const refresh = useCallback(async () => {
    const w = watchRef.current
    if (!w) return null
    const res = await emit('race:watch', w)
    if (watchRef.current !== w && watchRef.current?.race_id !== w.race_id) return null
    if (res.ok) {
      setRace(res.race)
      setError(null)
      return res.race
    }
    if (res.error !== 'offline') setError(res)
    return null
  }, [])

  useEffect(() => {
    if (!watch) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const loop = async () => {
      if (stopped) return
      const r = document.hidden ? raceRef.current : ((await refresh()) ?? raceRef.current)
      if (stopped) return
      const ms = pollMs(r, !!opts.fast)
      // Finished / cancelled races don't change any more.
      if (ms !== null) timer = setTimeout(loop, ms)
    }
    void loop()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.fast])

  return { race, setRace, error, refresh }
}
