import { useCallback, useEffect, useState } from 'react'
import type { RaceState } from '@shared/types'
import type { PlayerInput } from '@shared/validation'
import { Reveal } from '../components/Reveal'
import { configStore } from '../lib/data'
import { deviceId, KIOSK_SESSION, KIOSK_SESSION_MS, loadSession, saveSession } from '../lib/session'
import { emit } from '../lib/socket'
import { useStore } from '../lib/store'
import type { Seat } from '../lib/useRun'
import { BattleHost, type BattleSession } from './BattleHost'
import { KioskFrame } from './Frame'
import { H2HRace, H2HRegister, H2HResults, H2HReveal, type H2HSession } from './HeadToHead'
import { Home } from './Home'
import { HowToScreen } from './HowToScreen'
import { FeedbackStep, LeaderboardScreen, ResultsScreen, type BoardTab, type Me } from './PostGame'
import { SoloRace } from './RaceScreen'
import { Register } from './Register'
import { Splash } from './Splash'

const affiliationOf = (p: PlayerInput) => (p.affiliation_type === 'business' ? p.opu : p.project_name) ?? ''


type Step =
  | { s: 'home' }
  | { s: 'register' }
  | { s: 'howto'; player: PlayerInput }
  | { s: 'race'; seat: Seat; title: string; me: Me }
  | { s: 'reveal'; seat: Seat; me: Me; lit: number; timeMs: number; timeout: boolean; name: string }
  | { s: 'feedback'; seat: Seat; me: Me }
  | { s: 'results'; seat: Seat; me: Me }
  | { s: 'leaderboard'; tab: BoardTab; me: Me | null; back: Step | null }
  | { s: 'battle'; session: BattleSession | null }
  | { s: 'h2h-register' }
  | { s: 'h2h-howto'; players: [PlayerInput, PlayerInput] }
  | { s: 'h2h-race'; session: H2HSession; me: Me }
  | { s: 'h2h-reveal'; session: H2HSession; race: RaceState; me: Me }
  | { s: 'h2h-feedback'; session: H2HSession; race: RaceState; me: Me; index: 0 | 1 }
  | { s: 'h2h-results'; session: H2HSession; race: RaceState; me: Me }

/** The kiosk (#/): Solo Rush, Multiplayer Battle host and Head-to-Head, resumed after a refresh. */
export function KioskApp({ onAdmin }: { onAdmin: () => void }) {
  const config = useStore(configStore)
  const [step, setStepState] = useState<Step>(() => loadSession<Step>(KIOSK_SESSION, KIOSK_SESSION_MS) ?? { s: 'home' })
  const [splash, setSplash] = useState(() => step.s === 'home')
  const [solo, setSolo] = useState<{ race: RaceState | null; status: 'howto' | 'starting'; error: string | null }>({ race: null, status: 'howto', error: null })
  const [h2hRace, setH2hRace] = useState<RaceState | null>(null)

  const setStep = useCallback((next: Step) => {
    setStepState(next)
    saveSession(KIOSK_SESSION, next.s === 'home' ? null : next)
    window.scrollTo?.(0, 0)
  }, [])
  const home = useCallback(() => setStep({ s: 'home' }), [setStep])

  useEffect(() => {
    if (step.s === 'howto' || step.s === 'h2h-howto') setSolo({ race: null, status: 'howto', error: null })
  }, [step.s])

  const startSolo = async (player: PlayerInput) => {
    setSolo((x) => ({ ...x, status: 'starting', error: null }))
    const res = await emit('solo:start', { player, kiosk_id: deviceId('kiosk') })
    if (!res.ok) return setSolo((x) => ({ ...x, error: res.message }))
    setSolo({ race: res.race, status: 'starting', error: null })
    const seat = { race_id: res.race.id, run_id: res.run_id, token: res.token }
    const name = player.full_name.trim().replace(/\s+/g, ' ')
    setStep({ s: 'race', seat, title: `${name} · ${affiliationOf(player)}`, me: { run_ids: [res.run_id], people: [{ name, affiliation: affiliationOf(player) }] } })
  }

  const startH2H = async (players: [PlayerInput, PlayerInput]) => {
    setSolo((x) => ({ ...x, status: 'starting', error: null }))
    const res = await emit('h2h:start', { players, kiosk_id: deviceId('kiosk') })
    if (!res.ok) return setSolo((x) => ({ ...x, error: res.message }))
    setH2hRace(res.race)
    const seats = res.runs.map((r) => ({ race_id: res.race.id, run_id: r.run_id, token: r.token }))
    const me: Me = { run_ids: seats.map((s) => s.run_id), people: players.map((p) => ({ name: p.full_name, affiliation: affiliationOf(p) })) }
    setStep({ s: 'h2h-race', session: { race_id: res.race.id, host_token: res.host_token, seats }, me })
  }

  const rules = solo.race?.rules ?? {
    limit_ms: (config?.settings.timer_seconds ?? 30) * 1000,
    wrong_penalty_ms: config?.settings.wrong_penalty_ms ?? 1000,
    skip_penalty_ms: config?.settings.skip_penalty_ms ?? 2000,
    hard_mode: config?.settings.hard_mode ?? false,
  }
  const howtoSeconds = config?.settings.howto_seconds ?? 10

  switch (step.s) {
    case 'home':
      return (
        <>
          <Home
            onBegin={() => setStep({ s: 'register' })}
            onBattle={() => setStep({ s: 'battle', session: null })}
            onH2H={() => setStep({ s: 'h2h-register' })}
            onLeaderboard={() => setStep({ s: 'leaderboard', tab: 'today', me: null, back: null })}
            onAdmin={onAdmin}
          />
          {splash && (
            <Splash title={config?.settings.event_title ?? 'PMX Digital Challenge'} subtitle={config?.settings.event_subtitle ?? 'Powering Project Delivery Through Digital'} onDone={() => setSplash(false)} />
          )}
        </>
      )

    case 'register':
      return <Register onBack={home} onHome={home} onAdmin={onAdmin} onDone={(player) => setStep({ s: 'howto', player })} />

    case 'howto':
      return (
        <KioskFrame title={`Solo Rush · ${step.player.full_name}`} onBack={solo.status === 'howto' ? () => setStep({ s: 'register' }) : undefined} onHome={solo.status === 'howto' || solo.error ? home : undefined} onAdmin={onAdmin}>
          <HowToScreen
            rules={rules}
            seconds={howtoSeconds}
            status={solo.status}
            error={solo.error}
            onReady={() => void startSolo(step.player)}
            onEnd={() => void startSolo(step.player)}
            onRetry={() => void startSolo(step.player)}
          />
        </KioskFrame>
      )

    case 'race':
      return (
        <SoloRace
          initial={solo.race?.id === step.seat.race_id ? solo.race : null}
          seat={step.seat}
          title={step.title}
          onAdmin={onAdmin}
          onEnd={(e) =>
            setStep({ s: 'reveal', seat: step.seat, me: step.me, lit: e.progress.solved.length, timeMs: e.timeMs, timeout: e.progress.ended === 'timeout', name: step.me.people[0].name })
          }
        />
      )

    case 'reveal':
      return <Reveal lit={step.lit} name={step.name} timeMs={step.timeMs} timeout={step.timeout} onDone={() => setStep({ s: 'feedback', seat: step.seat, me: step.me })} />

    case 'feedback':
      return <FeedbackStep seat={step.seat} onAdmin={onAdmin} onIdle={home} onDone={() => setStep({ s: 'results', seat: step.seat, me: step.me })} />

    case 'results':
      return <ResultsScreen seat={step.seat} onHome={home} onAdmin={onAdmin} onLeaderboard={() => setStep({ s: 'leaderboard', tab: 'today', me: step.me, back: step })} />

    case 'leaderboard':
      return <LeaderboardScreen initial={step.tab} me={step.me} onBack={() => (step.back ? setStep(step.back) : home())} onHome={home} onAdmin={onAdmin} />

    case 'battle':
      return (
        <BattleHost
          session={step.session}
          onSession={(session) => setStep({ s: 'battle', session })}
          onHome={home}
          onAdmin={onAdmin}
          onLeaderboard={(race) =>
            setStep({
              s: 'leaderboard',
              tab: 'wins',
              me: { run_ids: race.runs.map((r) => r.id), people: race.runs.filter((r) => r.is_winner).map((r) => ({ name: r.name, affiliation: r.affiliation })) },
              back: { s: 'battle', session: step.session },
            })
          }
        />
      )

    case 'h2h-register':
      return <H2HRegister onBack={home} onHome={home} onAdmin={onAdmin} onDone={(players) => setStep({ s: 'h2h-howto', players })} />

    case 'h2h-howto':
      return (
        <KioskFrame
          title={`Head-to-Head · ${step.players[0].full_name} vs ${step.players[1].full_name}`}
          onBack={solo.status === 'howto' ? () => setStep({ s: 'h2h-register' }) : undefined}
          onHome={solo.status === 'howto' || solo.error ? home : undefined}
          onAdmin={onAdmin}
        >
          <HowToScreen
            rules={rules}
            seconds={howtoSeconds}
            status={solo.status}
            error={solo.error}
            onReady={() => void startH2H(step.players)}
            onEnd={() => void startH2H(step.players)}
            onRetry={() => void startH2H(step.players)}
          />
        </KioskFrame>
      )

    case 'h2h-race':
      return <H2HRace session={step.session} initial={h2hRace?.id === step.session.race_id ? h2hRace : null} onAdmin={onAdmin} onEnd={(race) => setStep({ s: 'h2h-reveal', session: step.session, race, me: step.me })} />

    case 'h2h-reveal':
      return <H2HReveal race={step.race} onDone={() => setStep({ s: 'h2h-feedback', session: step.session, race: step.race, me: step.me, index: 0 })} />

    case 'h2h-feedback': {
      const seat = step.session.seats[step.index]
      const name = step.race.runs.find((r) => r.id === seat.run_id)?.name ?? ''
      return (
        <FeedbackStep
          key={seat.run_id}
          seat={seat}
          who={`Player ${step.index + 1} of 2 · ${name}`}
          onAdmin={onAdmin}
          onIdle={home}
          onDone={() =>
            step.index === 0
              ? setStep({ ...step, index: 1 })
              : setStep({ s: 'h2h-results', session: step.session, race: step.race, me: step.me })
          }
        />
      )
    }

    case 'h2h-results':
      return <H2HResults race={step.race} session={step.session} onHome={home} onAdmin={onAdmin} onLeaderboard={() => setStep({ s: 'leaderboard', tab: 'today', me: step.me, back: step })} />
  }
}
