import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Crown, ListOrdered, Swords } from 'lucide-react'
import type { RaceState, RunProgress } from '@shared/types'
import { formatSeconds } from '@shared/time'
import type { PlayerInput } from '@shared/validation'
import { Constellation } from '../components/Constellation'
import { Countdown } from '../components/Countdown'
import { PuzzleBoard } from '../components/PuzzleBoard'
import { GeneralError, RegistrationFields, focusFirstInvalid, toPlayer, useFieldRefs, useRegistration } from '../components/RegistrationForm'
import { ResultsView } from '../components/Results'
import { RevealContent } from '../components/Reveal'
import { Timer } from '../components/Timer'
import { configStore } from '../lib/data'
import { useIdle, useServerNow } from '../lib/hooks'
import { useStore } from '../lib/store'
import { useRace } from '../lib/useRace'
import type { Seat } from '../lib/useRun'
import { KioskFrame } from './Frame'
import { Footer, ResultsLoading, useResult } from './PostGame'
import { useRunWithEnd } from './RaceScreen'
import { serverCheck } from './Register'

// ── Registration ────────────────────────────────────────────────────────────

export function H2HRegister({ onBack, onHome, onAdmin, onDone }: { onBack: () => void; onHome: () => void; onAdmin: () => void; onDone: (players: [PlayerInput, PlayerInput]) => void }) {
  const config = useStore(configStore)
  const opus = config?.settings.opus ?? []
  const left = useRegistration(opus)
  const right = useRegistration(opus)
  const leftRefs = useFieldRefs()
  const rightRefs = useFieldRefs()
  const [busy, setBusy] = useState(false)
  const [general, setGeneral] = useState<string | null>(null)
  useIdle((config?.settings.idle_seconds ?? 30) * 2, onHome)

  const start = async () => {
    if (busy) return
    if (!left.valid || !right.valid) {
      left.revealAll()
      right.revealAll()
      if (!left.valid) focusFirstInvalid(left, leftRefs)
      else focusFirstInvalid(right, rightRefs)
      return
    }
    setBusy(true)
    setGeneral(null)
    const players: [PlayerInput, PlayerInput] = [toPlayer(left.value), toPlayer(right.value)]
    const [a, b] = await Promise.all(players.map(serverCheck))
    setBusy(false)
    if (a.errors === null && b.errors === null) return onDone(players)
    if (a.errors) left.setServerErrors(a.errors)
    if (b.errors) right.setServerErrors(b.errors)
    setGeneral(a.message ?? b.message)
  }

  const card = (n: 1 | 2) => {
    const reg = n === 1 ? left : right
    const refs = n === 1 ? leftRefs : rightRefs
    return (
      <div className="reg-card p-[max(16px,1.4rem)]">
        <h2 className="mb-3 flex items-center gap-3 font-display text-[max(20px,1.7rem)] font-bold">
          <span className="grid size-10 place-items-center rounded-full bg-nc-blue text-[1.2rem] text-white">{n}</span>
          {n === 1 ? 'Left player' : 'Right player'}
        </h2>
        <RegistrationFields
          reg={reg}
          opus={opus}
          refs={refs}
          idPrefix={`h2h${n}`}
          tight
          autoFocus={n === 1}
          onSubmitLast={() => (n === 1 ? rightRefs.full_name.current?.focus() : void start())}
        />
      </div>
    )
  }

  return (
    <KioskFrame title="Head-to-Head" onBack={onBack} onHome={onHome} onAdmin={onAdmin} scroll>
      <div className="grid grid-cols-2 gap-[1.6rem] portrait:grid-cols-1">
        {card(1)}
        {card(2)}
      </div>
      <div className="mt-5 flex flex-col items-center">
        <button type="button" className="btn btn-green btn-xl min-w-[26rem]" aria-disabled={!left.valid || !right.valid || busy} onClick={start}>
          <Swords className="size-[1em]" aria-hidden="true" />
          {busy ? 'Checking…' : 'Start Head-to-Head'}
        </button>
        <div className="w-full max-w-[50rem]">
          <GeneralError msg={general} />
        </div>
      </div>
    </KioskFrame>
  )
}

// ── Race ────────────────────────────────────────────────────────────────────

export interface H2HSession {
  race_id: string
  host_token: string
  seats: Seat[]
}

function Half({ race, seat, started, ticks, onEnd, otherDone, lane }: { race: RaceState; seat: Seat; started: boolean; ticks: boolean; onEnd: (p: RunProgress) => void; otherDone: boolean; lane: number }) {
  const runInfo = race.runs.find((r) => r.id === seat.run_id)
  const run = useRunWithEnd(race, seat, (e) => onEnd(e.progress))
  return (
    <div className="relative flex min-h-0 flex-col gap-3" data-testid={`half-${lane}`}>
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[1.7rem] font-bold">{runInfo?.name}</p>
          <p className="truncate text-[1.05rem] text-white/60">{runInfo?.affiliation}</p>
        </div>
        <Constellation lit={run.progress?.solved.length ?? 0} showNext={started && !run.ended} className="h-[6.2rem] w-[8.6rem] shrink-0" />
        <Timer rules={race.rules} goAt={race.go_at} progress={run.progress} size="md" ticks={ticks} className="w-[14rem]" />
      </div>
      <PuzzleBoard
        puzzles={race.puzzles}
        progress={run.progress}
        started={started}
        onTap={run.tap}
        onSkip={run.skip}
        flash={run.flash}
        wrongTile={run.wrongTile}
        size="half"
        skipPenaltyMs={race.rules.skip_penalty_ms}
        waitingOther={run.ended && !otherDone}
      />
    </div>
  )
}

/** Two halves, both players tapping at the same time. Moves on when both runs are over. */
export function H2HRace({ session, initial, onEnd, onAdmin }: { session: H2HSession; initial: RaceState | null; onEnd: (race: RaceState) => void; onAdmin: () => void }) {
  const watch = useMemo(() => ({ race_id: session.race_id, host_token: session.host_token }), [session])
  const { race, refresh } = useRace(watch, { initial, fast: true })
  const now = useServerNow(100)
  const [done, setDone] = useState<[boolean, boolean]>([false, false])

  useEffect(() => {
    if (!done[0] || !done[1]) return
    let alive = true
    // Wait for the server's final places, then move on.
    const poll = async () => {
      for (let i = 0; i < 20 && alive; i++) {
        const r = await refresh()
        if (r && r.status === 'finished') return alive && onEnd(r)
        await new Promise((res) => setTimeout(res, 500))
      }
      if (alive && race) onEnd(race)
    }
    void poll()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  if (!race) {
    return (
      <KioskFrame title="Head-to-Head" onAdmin={onAdmin}>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-[2.4rem] font-bold text-nc-blue-soft">Starting…</p>
        </div>
      </KioskFrame>
    )
  }
  const started = race.go_at !== null && now >= race.go_at
  return (
    <KioskFrame title="Head-to-Head" onAdmin={onAdmin}>
      <div className="relative grid min-h-0 flex-1 grid-cols-[1fr_2px_1fr] gap-4">
        <Half lane={0} race={race} seat={session.seats[0]} started={started} ticks={!done[0]} onEnd={() => setDone((d) => [true, d[1]])} otherDone={done[1]} />
        <div className="bg-nc-blue-soft/25" aria-hidden="true" />
        <Half lane={1} race={race} seat={session.seats[1]} started={started} ticks={done[0] && !done[1]} onEnd={() => setDone((d) => [d[0], true])} otherDone={done[0]} />
        <Countdown goAt={race.go_at} />
      </div>
    </KioskFrame>
  )
}

// ── After the race ──────────────────────────────────────────────────────────

/** Two compact reveals; the winner's column glows yellow. Moves on after 5.6 s or a tap. */
export function H2HReveal({ race, onDone }: { race: RaceState; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), 5600)
    return () => clearTimeout(t)
  }, [])
  const winner = race.runs.find((r) => r.is_winner)
  return (
    <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center gap-8 p-8" onPointerDown={onDone} role="button" tabIndex={0} aria-label="Continue">
      <h2 className="flex items-center gap-3 font-display text-[3rem] font-bold">
        {winner ? (
          <>
            <Crown className="size-[1em] text-nc-yellow" aria-hidden="true" /> {winner.name} wins!
          </>
        ) : (
          "It's a draw!"
        )}
      </h2>
      <div className="grid w-full max-w-[100rem] grid-cols-2 gap-6">
        {race.runs.map((r, i) => (
          <div key={r.id} className={`rounded-3xl p-6 ${r.is_winner ? 'bg-nc-yellow/10 ring-2 ring-nc-yellow/60' : ''}`}>
            <RevealContent lit={r.progress.solved.length} name={r.name} timeMs={r.time_ms ?? race.rules.limit_ms} timeout={r.status === 'timeout'} compact sound={i === 0} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Column({ seat, winner }: { seat: Seat; winner: boolean }) {
  const result = useResult(seat)
  if (!result) return <ResultsLoading />
  return (
    <div className={`rounded-3xl p-4 ${winner ? 'bg-nc-yellow/8 ring-2 ring-nc-yellow/50' : ''}`}>
      <h3 className="mb-3 font-display text-[1.8rem] font-bold">
        {result.name} <span className="text-[1.1rem] font-normal text-white/60">· {result.affiliation}</span>
      </h3>
      <ResultsView result={result} compact />
    </div>
  )
}

export function H2HResults({ race, session, onLeaderboard, onHome, onAdmin }: { race: RaceState; session: H2HSession; onLeaderboard: () => void; onHome: () => void; onAdmin: () => void }) {
  const config = useStore(configStore)
  const idle = useIdle(config?.settings.idle_seconds ?? 30, onHome)
  const winner = race.runs.find((r) => r.is_winner)
  return (
    <KioskFrame title="Head-to-Head results" onHome={onHome} onAdmin={onAdmin} scroll>
      <h2 className="mb-4 flex items-center gap-3 font-display text-[2.6rem] font-bold">
        {winner ? (
          <>
            <Crown className="size-[1em] text-nc-yellow" aria-hidden="true" /> {winner.name} wins in {formatSeconds(winner.time_ms)} s!
          </>
        ) : (
          <>
            <Swords className="size-[1em]" aria-hidden="true" /> A draw – play again to settle it!
          </>
        )}
      </h2>
      <div className="grid grid-cols-2 gap-6 portrait:grid-cols-1">
        {session.seats.map((s) => (
          <Column key={s.run_id} seat={s} winner={race.runs.find((r) => r.id === s.run_id)?.is_winner ?? false} />
        ))}
      </div>
      <Footer idle={idle}>
        <button type="button" className="btn btn-go btn-xl" onClick={onLeaderboard}>
          <ListOrdered className="size-[1em]" aria-hidden="true" /> Leaderboard <ArrowRight className="size-[1em]" aria-hidden="true" />
        </button>
      </Footer>
    </KioskFrame>
  )
}
