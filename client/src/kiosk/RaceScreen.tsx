import { useEffect, useMemo, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import type { RaceState, RunProgress } from '@shared/types'
import { Constellation } from '../components/Constellation'
import { Countdown } from '../components/Countdown'
import { PuzzleBoard } from '../components/PuzzleBoard'
import { Timer } from '../components/Timer'
import { SHORT_QUERY, useIsPhone, useMedia, useServerNow } from '../lib/hooks'
import { useRace } from '../lib/useRace'
import { useRun, type Seat } from '../lib/useRun'
import { KioskFrame } from './Frame'

export interface RaceEnd {
  progress: RunProgress
  timeMs: number
}

/** The lit list next to the constellation: solved names in the order built, then "Not lit yet". */
export function LitList({ race, progress }: { race: RaceState; progress: RunProgress | null }) {
  const total = race.puzzles.length || 6
  const solved = progress?.solved ?? []
  return (
    <ol className="flex flex-col gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const idx = solved[i]
        const lit = idx !== undefined
        return (
          <li key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-[1.12rem] ${lit ? 'bg-nc-purple/30 font-semibold' : 'text-white/35'}`}>
            {lit ? <Sparkles className="size-4 shrink-0 text-nc-purple-soft" aria-hidden="true" /> : <span className="w-4 text-center text-[0.85em]">{i + 1}</span>}
            {lit ? race.puzzles[idx]?.name : 'Not lit yet'}
          </li>
        )
      })}
    </ol>
  )
}

/** Plays a run; calls `onEnd` 1.1 s after the run is over (all six built, or time up). */
export function useRunWithEnd(race: RaceState | null, seat: Seat | null, onEnd: (e: RaceEnd) => void, opts: { sound?: boolean } = {}) {
  const run = useRun(race, seat, opts)
  const cb = useRef(onEnd)
  cb.current = onEnd
  const latest = useRef({ progress: run.progress, limit: race?.rules.limit_ms ?? 30_000 })
  latest.current = { progress: run.progress, limit: race?.rules.limit_ms ?? 30_000 }
  const isEnded = !!run.progress?.ended
  // Depends only on "ended", so later polls of the race don't restart (or cancel) the 1.1 s pause.
  useEffect(() => {
    if (!isEnded) return
    const t = setTimeout(() => {
      const p = latest.current.progress!
      const timeMs = p.ended === 'finished' && p.finish_ms !== null ? p.finish_ms : (p.last_solve_ms ?? latest.current.limit)
      cb.current({ progress: p, timeMs })
    }, 1100)
    return () => clearTimeout(t)
  }, [isEnded])
  return run
}

interface Props {
  /** The race as returned by the start call (null after a refresh: it is fetched again). */
  initial: RaceState | null
  seat: Seat
  title: string
  onEnd: (e: RaceEnd) => void
  onAdmin?: () => void
}

/** Solo Rush race (kiosk, tablet and phone layouts). */
export function SoloRace({ initial, seat, title, onEnd, onAdmin }: Props) {
  const watch = useMemo(() => ({ race_id: seat.race_id, run_id: seat.run_id, token: seat.token }), [seat])
  const { race } = useRace(watch, { initial })
  if (!race) {
    return (
      <KioskFrame title={title} onAdmin={onAdmin}>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-[2.4rem] font-bold text-nc-blue-soft">Starting…</p>
        </div>
      </KioskFrame>
    )
  }
  return <SoloRaceView race={race} seat={seat} title={title} onEnd={onEnd} onAdmin={onAdmin} />
}

function SoloRaceView({ race: r, seat, title, onEnd, onAdmin }: { race: RaceState; seat: Seat; title: string; onEnd: (e: RaceEnd) => void; onAdmin?: () => void }) {
  const run = useRunWithEnd(r, seat, onEnd)
  const now = useServerNow(100)
  const started = r.go_at !== null && now >= r.go_at
  const phone = useIsPhone()
  const short = useMedia(SHORT_QUERY)
  const solved = run.progress?.solved.length ?? 0

  const board = (
    <PuzzleBoard
      puzzles={r.puzzles}
      progress={run.progress}
      started={started}
      onTap={run.tap}
      onSkip={run.skip}
      flash={run.flash}
      wrongTile={run.wrongTile}
      size={phone ? 'phone' : 'wide'}
      skipPenaltyMs={r.rules.skip_penalty_ms}
    />
  )

  if (phone && short) {
    return (
      <KioskFrame title={title} onAdmin={onAdmin} fit>
        <div className="grid flex-1 grid-cols-[1fr_11rem] gap-3">
          <div className="relative flex flex-col">{board}</div>
          <div className="flex flex-col items-center gap-2">
            <Constellation lit={solved} showNext={started && !run.ended} className="h-[6rem] w-full" />
            <Timer rules={r.rules} goAt={r.go_at} progress={run.progress} size="sm" ticks className="w-full" />
          </div>
        </div>
        <Countdown goAt={r.go_at} fixed />
      </KioskFrame>
    )
  }

  if (phone) {
    return (
      <KioskFrame title={title} onAdmin={onAdmin} fit>
        <div className="mb-3 flex items-center gap-3">
          <Constellation lit={solved} showNext={started && !run.ended} className="h-[4.2rem] w-[6rem] shrink-0" />
          <Timer rules={r.rules} goAt={r.go_at} progress={run.progress} size="sm" ticks className="flex-1" />
        </div>
        <div className="relative flex flex-1 flex-col">{board}</div>
        <Countdown goAt={r.go_at} fixed />
      </KioskFrame>
    )
  }

  return (
    <KioskFrame title={title} onAdmin={onAdmin}>
      <div className="relative grid min-h-0 flex-1 grid-cols-[1.55fr_1fr] gap-[1.6rem] portrait:grid-cols-1">
        <div className="relative flex min-h-0 flex-col">{board}</div>
        <aside className="panel flex min-h-0 flex-col gap-4 p-[1.4rem]">
          <Timer rules={r.rules} goAt={r.go_at} progress={run.progress} size="lg" ticks />
          <div className="flex min-h-[10rem] flex-1 items-center justify-center">
            <Constellation lit={solved} showNext={started && !run.ended} className="h-full max-h-[22rem] w-full" />
          </div>
          <LitList race={r} progress={run.progress} />
        </aside>
        <Countdown goAt={r.go_at} />
      </div>
    </KioskFrame>
  )
}
