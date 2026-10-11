import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CheckCircle2, Hourglass, LogOut, PartyPopper, Smartphone, Users } from 'lucide-react'
import type { RaceState } from '@shared/types'
import { formatSeconds } from '@shared/time'
import { PartnerLogos, NwowBrand } from '../components/Brand'
import { Constellation } from '../components/Constellation'
import { Countdown } from '../components/Countdown'
import { FeedbackForm } from '../components/Feedback'
import { PuzzleBoard } from '../components/PuzzleBoard'
import { RaceLanes } from '../components/RaceLanes'
import { GeneralError, RegistrationFields, StartButton, focusFirstInvalid, toPlayer, useFieldRefs, useRegistration } from '../components/RegistrationForm'
import { ResultsView } from '../components/Results'
import { RevealContent } from '../components/Reveal'
import { Timer } from '../components/Timer'
import { SoundToggle } from '../components/ui'
import { configStore } from '../lib/data'
import { useServerNow } from '../lib/hooks'
import { fetchFeedbackStatus } from '../lib/results'
import { deviceId, loadSession, PHONE_SESSION, PHONE_SESSION_MS, saveSession } from '../lib/session'
import { emit } from '../lib/socket'
import { useStore } from '../lib/store'
import { useRace } from '../lib/useRace'
import { useRun, type Seat } from '../lib/useRun'
import { HowToScreen } from '../kiosk/HowToScreen'
import { ResultsLoading, useResult } from '../kiosk/PostGame'

type Step =
  | { s: 'code'; message?: string }
  | { s: 'register'; code: string }
  | { s: 'game'; code: string; seat: Seat; name: string }
  | { s: 'reveal'; code: string; seat: Seat; name: string; lit: number; timeMs: number; timeout: boolean }
  | { s: 'feedback'; code: string; seat: Seat; name: string }
  | { s: 'results'; code: string; seat: Seat; name: string }
  | { s: 'thanks' }
  | { s: 'closed' }

function Shell({ title, children, logos = true, fit = false }: { title: string; children: ReactNode; logos?: boolean; fit?: boolean }) {
  return (
    <div className={`${fit ? 'race-fit ' : ''}relative z-10 mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))]`}>
      <header className="mb-3 flex items-center gap-3">
        <NwowBrand compact />
        <p className="ml-auto truncate text-[0.8rem] font-bold uppercase tracking-[0.14em] text-nc-purple-soft">{title}</p>
        <SoundToggle className="!min-h-12 !min-w-12" />
      </header>
      {logos && (
        <div className="mb-4 flex justify-center">
          <PartnerLogos size="sm" />
        </div>
      )}
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  )
}

/** Phones in a Multiplayer Battle (#/join or #/join/1234). Refresh resumes the same step. */
export function PlayerApp({ code: linkCode }: { code: string | null }) {
  const [step, setStepState] = useState<Step>(() => {
    const saved = loadSession<Step>(PHONE_SESSION, PHONE_SESSION_MS)
    if (saved && saved.s !== 'code' && saved.s !== 'thanks' && saved.s !== 'closed' && (!linkCode || ('code' in saved && saved.code === linkCode))) return saved
    return linkCode ? { s: 'register', code: linkCode } : { s: 'code' }
  })
  const setStep = useCallback((next: Step) => {
    setStepState(next)
    saveSession(PHONE_SESSION, next.s === 'code' || next.s === 'thanks' || next.s === 'closed' ? null : next)
    window.scrollTo?.(0, 0)
  }, [])

  switch (step.s) {
    case 'code':
      return <CodeStep message={step.message} onCode={(code) => setStep({ s: 'register', code })} />
    case 'register':
      return <RegisterStep code={step.code} onJoined={(seat, name) => setStep({ s: 'game', code: step.code, seat, name })} onRoomError={(message) => setStep({ s: 'code', message })} />
    case 'game':
      return (
        <GameStep
          step={step}
          onRemoved={(message) => setStep({ s: 'code', message })}
          onClosed={() => setStep({ s: 'closed' })}
          onLeft={() => setStep({ s: 'code' })}
          onEnd={(lit, timeMs, timeout) => setStep({ ...step, s: 'reveal', lit, timeMs, timeout })}
        />
      )
    case 'reveal':
      return <RevealStep step={step} onDone={() => setStep({ s: 'feedback', code: step.code, seat: step.seat, name: step.name })} />
    case 'feedback':
      return <FeedbackPhone seat={step.seat} onDone={() => setStep({ s: 'results', code: step.code, seat: step.seat, name: step.name })} />
    case 'results':
      return <ResultsPhone seat={step.seat} code={step.code} onContinue={() => setStep({ s: 'thanks' })} />
    case 'thanks':
      return (
        <Shell title="Multiplayer Battle">
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <CheckCircle2 className="size-14 text-nc-green-soft" aria-hidden="true" />
            <h2 className="font-display text-[1.9rem] font-bold">Thanks for playing!</h2>
            <p className="text-white/70">See the leaderboard on the big screen.</p>
            <button type="button" className="btn btn-purple mt-3 w-full" onClick={() => setStep({ s: 'code' })}>
              Join another battle
            </button>
          </div>
        </Shell>
      )
    case 'closed':
      return (
        <Shell title="Multiplayer Battle">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <h2 className="font-display text-[1.7rem] font-bold">The host closed this room.</h2>
            <button type="button" className="btn btn-purple w-full" onClick={() => setStep({ s: 'code' })}>
              Join another room
            </button>
          </div>
        </Shell>
      )
  }
}

function CodeStep({ message, onCode }: { message?: string; onCode: (code: string) => void }) {
  const [code, setCode] = useState('')
  return (
    <Shell title="Multiplayer Battle">
      <form
        className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === 4) onCode(code)
        }}
      >
        <Smartphone className="size-12 text-nc-purple-soft" aria-hidden="true" />
        <h2 className="font-display text-[1.9rem] font-bold">Join a battle</h2>
        <p className="text-white/70">Enter the 4-digit room code shown on the big screen.</p>
        <input
          className="field text-center font-display text-[2.4rem] tracking-[0.5em]"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          autoComplete="off"
          aria-label="Room code"
          aria-invalid={!!message || undefined}
          value={code}
          autoFocus
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
        {message && <p className="font-semibold text-nc-red-soft">{message}</p>}
        <button type="submit" className="btn btn-purple w-full" disabled={code.length !== 4}>
          Next <ArrowRight className="size-[1em]" aria-hidden="true" />
        </button>
      </form>
    </Shell>
  )
}

function RegisterStep({ code, onJoined, onRoomError }: { code: string; onJoined: (seat: Seat, name: string) => void; onRoomError: (msg: string) => void }) {
  const config = useStore(configStore)
  const opus = config?.settings.opus ?? []
  const reg = useRegistration(opus)
  const refs = useFieldRefs()
  const [busy, setBusy] = useState(false)
  const [general, setGeneral] = useState<string | null>(null)

  const join = async () => {
    if (busy) return
    if (!reg.valid) {
      reg.revealAll()
      focusFirstInvalid(reg, refs)
      return
    }
    setBusy(true)
    setGeneral(null)
    const player = toPlayer(reg.value)
    const res = await emit('room:join', { code, player, device_id: deviceId('device') })
    setBusy(false)
    if (res.ok) return onJoined({ race_id: res.race.id, run_id: res.run_id, token: res.token }, player.full_name.trim().replace(/\s+/g, ' '))
    if (res.error === 'room_not_found' || res.error === 'room_full' || res.error === 'room_started') return onRoomError(res.message)
    if (res.errors) reg.setServerErrors(res.errors)
    else setGeneral(res.message)
  }

  return (
    <Shell title={`Room ${code}`}>
      <div className="reg-card p-[max(18px,1.4rem)]">
        <h2 className="mb-3 font-display text-[1.7rem] font-bold">Who’s playing?</h2>
        <RegistrationFields reg={reg} opus={opus} refs={refs} idPrefix="phone" onSubmitLast={join} />
        <StartButton ready={reg.valid} busy={busy} onClick={join} className="mt-2 !text-[max(20px,1.3rem)]">
          Join the battle
        </StartButton>
        <GeneralError msg={general} />
      </div>
    </Shell>
  )
}

function GameStep({
  step,
  onRemoved,
  onClosed,
  onLeft,
  onEnd,
}: {
  step: Extract<Step, { s: 'game' }>
  onRemoved: (msg: string) => void
  onClosed: () => void
  onLeft: () => void
  onEnd: (lit: number, timeMs: number, timeout: boolean) => void
}) {
  const config = useStore(configStore)
  const watch = useMemo(() => ({ race_id: step.seat.race_id, run_id: step.seat.run_id, token: step.seat.token }), [step.seat])
  const { race, error } = useRace(watch, { fast: true })

  useEffect(() => {
    if (!error) return
    if (error.error === 'removed') onRemoved(error.message)
    else if (error.error === 'forbidden' || error.error === 'not_found') onRemoved('This room is no longer available.')
  }, [error, onRemoved])
  useEffect(() => {
    if (race?.status === 'cancelled') onClosed()
  }, [race?.status, onClosed])

  if (!race) {
    return (
      <Shell title={`Room ${step.code}`}>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-[1.6rem] text-nc-purple-soft">Joining the room…</p>
        </div>
      </Shell>
    )
  }

  if (race.status === 'lobby') {
    const first = step.name.split(' ')[0]
    return (
      <Shell title={`Room ${step.code}`}>
        <div className="panel mb-4 flex flex-col items-center gap-2 p-5 text-center">
          <PartyPopper className="size-10 text-nc-lime" aria-hidden="true" />
          <h2 className="font-display text-[1.7rem] font-bold">You're in, {first}!</h2>
          <p className="text-white/70">Watch the big screen – the host starts the battle when everyone has joined.</p>
        </div>
        <p className="label mb-2 flex items-center gap-1.5">
          <Users className="size-4" aria-hidden="true" /> Players ({race.runs.length}/{race.max_players})
        </p>
        <ul className="flex flex-col gap-2">
          {race.runs.map((r) => {
            const me = r.id === step.seat.run_id
            return (
              <li key={r.id} className={`flex items-center gap-3 rounded-xl px-4 py-3 ${me ? 'bg-nc-lime text-sky' : 'bg-white/5'}`}>
                <p className="min-w-0 flex-1 truncate">
                  <b>{r.name}</b> <span className={me ? 'text-sky/80' : 'text-white/60'}>{r.affiliation}</span>
                </p>
                {me && <span className="text-[0.9rem] font-extrabold tracking-wider">YOU</span>}
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="btn btn-ghost mt-auto w-full"
          onClick={async () => {
            await emit('room:leave', step.seat)
            onLeft()
          }}
        >
          <LogOut className="size-[1em]" aria-hidden="true" /> Leave room
        </button>
      </Shell>
    )
  }

  if (race.status === 'howto') {
    return (
      <Shell title={`Room ${step.code}`}>
        <HowToScreen rules={race.rules} endsAt={race.howto_ends_at} seconds={config?.settings.howto_seconds ?? 10} heading="Get ready!" compact />
      </Shell>
    )
  }

  return <PhoneRace race={race} seat={step.seat} code={step.code} onEnd={onEnd} />
}

function PhoneRace({ race, seat, code, onEnd }: { race: RaceState; seat: Seat; code: string; onEnd: (lit: number, timeMs: number, timeout: boolean) => void }) {
  const run = useRun(race, seat)
  const now = useServerNow(100)
  const started = race.go_at !== null && now >= race.go_at
  const mine = race.runs.find((r) => r.id === seat.run_id)
  const p = run.progress
  const ended = !!p?.ended
  const everyoneDone = race.status === 'finished'
  const cb = useRef(onEnd)
  cb.current = onEnd
  const latest = useRef({ mine, limit: race.rules.limit_ms })
  latest.current = { mine, limit: race.rules.limit_ms }

  // Move on once the whole race is over (the reveal shows this player's own stars).
  useEffect(() => {
    if (!everyoneDone) return
    const t = setTimeout(() => {
      const m = latest.current.mine
      if (m) cb.current(m.progress.solved.length, m.time_ms ?? latest.current.limit, m.status === 'timeout')
    }, 1100)
    return () => clearTimeout(t)
  }, [everyoneDone])

  if (ended && p) {
    return (
      <Shell title={`Room ${code}`} logos={false}>
        <div className="panel mb-4 flex flex-col items-center gap-2 p-5 text-center">
          {p.ended === 'finished' ? <CheckCircle2 className="size-12 text-nc-green-soft" aria-hidden="true" /> : <Hourglass className="size-12 text-nc-red-soft" aria-hidden="true" />}
          <h2 className="font-display text-[1.7rem] font-bold">{p.ended === 'finished' && p.finish_ms !== null ? `Finished in ${formatSeconds(p.finish_ms)} s!` : "Time's up!"}</h2>
          <p className="text-white/70">Waiting for the other players…</p>
        </div>
        <RaceLanes race={race} size="md" started />
      </Shell>
    )
  }

  return (
    <Shell title={`Room ${code}`} logos={false} fit>
      <div className="mb-3 flex items-center gap-3">
        <Constellation lit={p?.solved.length ?? 0} showNext={started} className="h-[4.2rem] w-[6rem] shrink-0" />
        <Timer rules={race.rules} goAt={race.go_at} progress={p} size="sm" ticks className="flex-1" />
      </div>
      <div className="relative flex flex-1 flex-col">
        <PuzzleBoard
          puzzles={race.puzzles}
          progress={p}
          started={started}
          onTap={run.tap}
          onSkip={run.skip}
          flash={run.flash}
          wrongTile={run.wrongTile}
          size="phone"
          skipPenaltyMs={race.rules.skip_penalty_ms}
        />
      </div>
      <Countdown goAt={race.go_at} fixed />
    </Shell>
  )
}

function RevealStep({ step, onDone }: { step: Extract<Step, { s: 'reveal' }>; onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), step.lit >= 6 ? 5200 : 3600)
    return () => clearTimeout(t)
  }, [step.lit])
  return (
    <div className="relative z-10 flex min-h-dvh items-center justify-center p-4" onPointerDown={onDone} role="button" tabIndex={0} aria-label="Continue">
      <RevealContent lit={step.lit} name={step.name} timeMs={step.timeMs} timeout={step.timeout} compact />
    </div>
  )
}

function FeedbackPhone({ seat, onDone }: { seat: Seat; onDone: () => void }) {
  const [required, setRequired] = useState<boolean | null>(null)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const signal = { cancelled: false }
    void fetchFeedbackStatus(seat, signal).then((s) => {
      if (signal.cancelled) return
      if (!s || !s.required) done.current()
      else setRequired(true)
    })
    return () => {
      signal.cancelled = true
    }
  }, [seat])
  if (!required) {
    return (
      <Shell title="Multiplayer Battle">
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <span className="size-[2.2rem] animate-spin rounded-full border-4 border-nc-blue-soft/30 border-t-nc-blue-soft" aria-hidden="true" />
          <p className="font-display text-[1.4rem] font-bold text-nc-blue-soft">Saving your score…</p>
        </div>
      </Shell>
    )
  }
  return (
    <div className="fb-page relative z-10 min-h-dvh">
      <div className="mx-auto max-w-[34rem] px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <FeedbackForm seat={seat} phone onDone={onDone} />
      </div>
    </div>
  )
}

function ResultsPhone({ seat, code, onContinue }: { seat: Seat; code: string; onContinue: () => void }) {
  const result = useResult(seat)
  const title = !result ? '' : result.is_winner ? 'You won the battle!' : result.place === 2 ? 'You came 2nd' : result.place === 3 ? 'You came 3rd' : result.place === 4 ? 'You came 4th' : 'Your results'
  return (
    <Shell title={`Room ${code}`}>
      {!result ? (
        <ResultsLoading />
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-[1.8rem] font-bold">{title}</h2>
          <ResultsView result={result} compact />
          <button type="button" className="btn btn-go w-full" onClick={onContinue}>
            Continue <ArrowRight className="size-[1em]" aria-hidden="true" />
          </button>
        </div>
      )}
    </Shell>
  )
}
