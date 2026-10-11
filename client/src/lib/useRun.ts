import { useCallback, useEffect, useRef, useState } from 'react'
import { applySkip, applyTap, canSkip, effectiveMs, timeUp, type SkipOutcome, type TapOutcome } from '@shared/game'
import type { RaceState, RunProgress } from '@shared/types'
import { emit, serverNow } from './socket'
import { sfx } from './sound'

export type Flash =
  | { kind: 'solved'; name: string; key: number }
  | { kind: 'wrong'; tile: string; key: number }
  | { kind: 'penalty'; text: string; key: number }

export interface Seat {
  race_id: string
  run_id: string
  token: string
}

/**
 * Plays one run on this device. Taps are applied at once with the shared reducer (instant
 * feedback), then sent to the server in order; the server times them with its own clock. When no
 * tap is in flight, the server's state replaces the local one (the server is the source of truth).
 */
export function useRun(race: RaceState | null, seat: Seat | null, opts: { sound?: boolean } = {}) {
  const sound = opts.sound !== false
  const serverRun = race && seat ? race.runs.find((r) => r.id === seat.run_id) : undefined
  const [progress, setProgress] = useState<RunProgress | null>(serverRun?.progress ?? null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [wrongTile, setWrongTile] = useState<{ id: string; key: number } | null>(null)
  const inFlight = useRef(0)
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const progressRef = useRef(progress)
  progressRef.current = progress
  const flashKey = useRef(0)
  const timedOut = useRef(false)

  // Adopt the server's state whenever nothing of ours is still on its way.
  useEffect(() => {
    if (!serverRun) return
    if (inFlight.current === 0) {
      const local = progressRef.current
      const server = serverRun.progress
      // Never step back from a locally ended run to a still-open server run (the server will catch up).
      if (!(local?.ended && !server.ended)) setProgress(server)
    }
  }, [serverRun?.progress, serverRun])

  const show = (f: { kind: 'solved'; name: string } | { kind: 'penalty'; text: string }) => setFlash({ ...f, key: ++flashKey.current })

  const goAt = race?.go_at ?? null
  const rules = race?.rules

  const send = useCallback(
    (fn: () => Promise<{ ok: boolean; progress?: RunProgress }>) => {
      inFlight.current++
      chain.current = chain.current
        .then(fn)
        .then((res) => {
          inFlight.current--
          if (res.ok && res.progress && inFlight.current === 0) setProgress(res.progress)
        })
        .catch(() => {
          inFlight.current--
        })
    },
    [],
  )

  const onOutcome = useCallback(
    (outcome: TapOutcome | SkipOutcome, next: RunProgress, tile?: string) => {
      if (!race || !rules) return
      if (outcome === 'correct') sound && sfx.tap()
      else if (outcome === 'solved' || outcome === 'finished') {
        sound && sfx.chime()
        const solvedIdx = next.solved[next.solved.length - 1]
        show({ kind: 'solved', name: race.puzzles[solvedIdx]?.name ?? '' })
      } else if (outcome === 'wrong') {
        sound && sfx.wrong()
        if (tile) setWrongTile({ id: tile, key: ++flashKey.current })
        show({ kind: 'penalty', text: `Wrong tile · +${rules.wrong_penalty_ms / 1000} s` })
      } else if (outcome === 'skipped') {
        sound && sfx.skip()
        show({ kind: 'penalty', text: `Skipped · +${rules.skip_penalty_ms / 1000} s` })
      } else if (outcome === 'timeout') {
        if (!timedOut.current) {
          timedOut.current = true
          sound && sfx.timeUp()
          show({ kind: 'penalty', text: "Time's up!" })
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [race?.id, rules, sound],
  )

  const tap = useCallback(
    (tileId: string) => {
      const p = progressRef.current
      if (!race || !seat || !p || !rules || goAt === null || p.ended) return
      const elapsed = serverNow() - goAt
      if (elapsed < 0) return
      const puzzle = p.queue[0]
      const res = applyTap(p, race.puzzles, rules, puzzle, tileId, elapsed)
      if (res.outcome === 'ignored') return
      progressRef.current = res.progress
      setProgress(res.progress)
      onOutcome(res.outcome, res.progress, tileId)
      send(() => emit('run:tap', { ...seat, puzzle, tile: tileId }))
    },
    [race, seat, rules, goAt, onOutcome, send],
  )

  const skip = useCallback(() => {
    const p = progressRef.current
    if (!race || !seat || !p || !rules || goAt === null || !canSkip(p)) return
    const elapsed = serverNow() - goAt
    if (elapsed < 0) return
    const puzzle = p.queue[0]
    const res = applySkip(p, rules, puzzle, elapsed)
    if (res.outcome === 'ignored') return
    progressRef.current = res.progress
    setProgress(res.progress)
    onOutcome(res.outcome, res.progress)
    send(() => emit('run:skip', { ...seat, puzzle }))
  }, [race, seat, rules, goAt, onOutcome, send])

  // The clock running out ends the run on the device at once (the server does the same on its side).
  useEffect(() => {
    if (!rules || goAt === null) return
    const t = setInterval(() => {
      const p = progressRef.current
      if (!p || p.ended) return
      const elapsed = serverNow() - goAt
      if (elapsed >= 0 && effectiveMs(p, elapsed) >= rules.limit_ms) {
        const next = timeUp(p)
        progressRef.current = next
        setProgress(next)
        onOutcome('timeout', next)
      }
    }, 100)
    return () => clearInterval(t)
  }, [rules, goAt, onOutcome])

  return { progress, tap, skip, flash, wrongTile, ended: !!progress?.ended }
}
