import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Crown, ListOrdered, Play, RotateCw, Smartphone, UserPlus, Wifi, WifiOff, X } from 'lucide-react'
import type { RaceState } from '@shared/types'
import { formatSeconds } from '@shared/time'
import { Constellation } from '../components/Constellation'
import { Countdown } from '../components/Countdown'
import { Qr } from '../components/Qr'
import { liveOrder, RaceLanes } from '../components/RaceLanes'
import { Timer } from '../components/Timer'
import { configStore, refreshBoards } from '../lib/data'
import { useIdle, useServerNow } from '../lib/hooks'
import { deviceId } from '../lib/session'
import { emit } from '../lib/socket'
import { sfx } from '../lib/sound'
import { useStore } from '../lib/store'
import { useRace } from '../lib/useRace'
import { KioskFrame } from './Frame'
import { Footer } from './PostGame'
import { HowToScreen } from './HowToScreen'

export interface BattleSession {
  race_id: string
  host_token: string
}

/** The address phones open: Admin's network address, else this page's own address. */
export function publicBase(setting: string | undefined): string {
  return (setting?.trim() || location.origin).replace(/\/+$/, '')
}

const isLocal = (url: string) => /^(https?:\/\/)?(localhost|127\.|\[::1\])/i.test(url)

interface Props {
  session: BattleSession | null
  onSession: (s: BattleSession | null) => void
  onHome: () => void
  onLeaderboard: (race: RaceState) => void
  onAdmin: () => void
}

export function BattleHost({ session, onSession, onHome, onLeaderboard, onAdmin }: Props) {
  const config = useStore(configStore)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [busy, setBusy] = useState(false)
  const watch = useMemo(() => (session ? { race_id: session.race_id, host_token: session.host_token } : null), [session])
  const { race, setRace, error: watchError } = useRace(watch, { fast: true })

  const openingRef = useRef(false)
  const open = async () => {
    if (openingRef.current) return
    openingRef.current = true
    setOpening(true)
    setError(null)
    const res = await emit('room:create', { kiosk_id: deviceId('kiosk') })
    openingRef.current = false
    setOpening(false)
    if (!res.ok) return setError(res.message)
    setRace(res.race)
    onSession({ race_id: res.race.id, host_token: res.host_token })
  }

  useEffect(() => {
    if (!session && !opening && !error) void open()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // A player joining plays the join sound.
  const count = race?.runs.length ?? 0
  const prevCount = useRef(count)
  useEffect(() => {
    if (race?.status === 'lobby' && count > prevCount.current) sfx.join()
    prevCount.current = count
  }, [count, race?.status])

  const cancel = async () => {
    if (session && race?.status === 'lobby') await emit('room:cancel', { race_id: session.race_id, host_token: session.host_token })
    onSession(null)
    onHome()
  }
  const newRoom = () => {
    onSession(null)
    setRace(null)
    setError(null)
  }

  const status = race?.status
  const title = !race || status === 'lobby' ? 'Multiplayer Battle · Lobby' : status === 'howto' ? 'Multiplayer Battle · Get ready' : 'Multiplayer Battle'
  const canLeave = !race || status === 'lobby' || status === 'finished' || status === 'cancelled'

  if (error || (watchError && !race)) {
    return (
      <KioskFrame title={title} onBack={onHome} onHome={onHome} onAdmin={onAdmin}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-[1.6rem] font-semibold text-nc-red-soft">{error ?? watchError?.message}</p>
          <button type="button" className="btn btn-purple btn-xl" onClick={newRoom}>
            Try again
          </button>
        </div>
      </KioskFrame>
    )
  }

  if (!race || !session) {
    return (
      <KioskFrame title={title} onBack={onHome} onHome={onHome} onAdmin={onAdmin}>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-display text-[2rem] text-nc-purple-soft">Opening a battle room…</p>
        </div>
      </KioskFrame>
    )
  }

  return (
    <KioskFrame title={title} onBack={canLeave ? cancel : undefined} onHome={canLeave ? cancel : undefined} onAdmin={onAdmin} scroll={status === 'lobby' || status === 'finished'}>
      {status === 'lobby' && (
        <Lobby
          race={race}
          base={publicBase(config?.settings.public_base_url)}
          busy={busy}
          onKick={(runId) => void emit('room:kick', { race_id: session.race_id, host_token: session.host_token, run_id: runId })}
          onCancel={cancel}
          onStart={async () => {
            setBusy(true)
            const res = await emit('room:start', { race_id: session.race_id, host_token: session.host_token })
            setBusy(false)
            if (res.ok) setRace(res.race)
          }}
        />
      )}
      {status === 'howto' && (
        <HowToScreen
          rules={race.rules}
          endsAt={race.howto_ends_at}
          seconds={config?.settings.howto_seconds ?? 10}
          heading="Get ready – how to play"
          footer={
            <div className="flex flex-wrap gap-2">
              {race.runs.map((r) => (
                <span key={r.id} className="rounded-full bg-nc-purple px-4 py-1.5 text-[1.1rem] font-bold">
                  {r.name}
                </span>
              ))}
            </div>
          }
        />
      )}
      {status === 'running' && <LiveRace race={race} />}
      {status === 'finished' && <Podium race={race} onHome={cancel} onLeaderboard={() => onLeaderboard(race)} onNew={newRoom} />}
      {status === 'cancelled' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <p className="font-display text-[2.4rem] font-bold">This room was closed.</p>
          <div className="flex gap-3">
            <button type="button" className="btn btn-ghost btn-xl" onClick={() => (onSession(null), onHome())}>
              Back to start
            </button>
            <button type="button" className="btn btn-purple btn-xl" onClick={newRoom}>
              Open a new room
            </button>
          </div>
        </div>
      )}
    </KioskFrame>
  )
}

function Lobby({ race, base, busy, onKick, onStart, onCancel }: { race: RaceState; base: string; busy: boolean; onKick: (runId: string) => void; onStart: () => void; onCancel: () => void }) {
  const code = race.room_code ?? ''
  const joinUrl = `${base}/#/join/${code}`
  const host = base.replace(/^https?:\/\//, '')
  const players = race.runs
  const max = race.max_players
  return (
    <div className="grid flex-1 grid-cols-[1fr_1.15fr] items-start gap-8 phone:grid-cols-1 portrait:grid-cols-1">
      <section className="panel flex flex-col items-center gap-[1.2rem] border-nc-purple-soft/40 p-8 text-center">
        <h2 className="font-display text-[2.6rem] font-bold">Join the battle</h2>
        <p className="text-[1.3rem] text-white/75">Scan with your phone camera, or open the link and enter the room code.</p>
        <Qr text={joinUrl} className="size-[15rem]" />
        <div>
          <p className="label !text-nc-purple-soft">Room code</p>
          <p className="font-display text-[5.6rem] font-bold leading-none tracking-[0.25em]" aria-label={`Room code ${code.split('').join(' ')}`}>
            {code}
          </p>
        </div>
        <p className="rounded-lg bg-white/5 px-3 py-1.5 font-mono text-[1.05rem] text-nc-blue-soft">{host}/#/join</p>
        {isLocal(base) && (
          <div className="flex items-start gap-2 rounded-xl border border-nc-yellow/50 bg-nc-yellow/15 px-4 py-3 text-left text-[1.05rem] text-nc-yellow">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            Phones can't open "localhost". Set the booth laptop's network address in Admin → Settings.
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-display text-[2rem] font-bold">
          <Smartphone className="size-8 text-nc-purple-soft" aria-hidden="true" /> Players {players.length}/{max}
        </h2>
        <div className="flex flex-col gap-[0.8rem]" data-testid="lobby-players">
          {Array.from({ length: max }, (_, i) => {
            const p = players[i]
            if (!p) {
              return (
                <div key={`empty-${i}`} className="flex items-center gap-4 rounded-[1.25rem] border-2 border-dashed border-nc-blue-soft/25 p-4 text-[1.3rem] text-white/45">
                  <span className="grid size-12 place-items-center rounded-full border-2 border-dashed border-white/25">
                    <UserPlus className="size-5" aria-hidden="true" />
                  </span>
                  Waiting for a player…
                </div>
              )
            }
            return (
              <div key={p.id} className="panel flex animate-rise items-center gap-4 p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-nc-purple font-display text-[1.3rem] font-bold">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[1.6rem] font-bold">{p.name}</p>
                  <p className="truncate text-[1.05rem] text-white/60">{p.affiliation}</p>
                </div>
                {p.connected ? (
                  <span className="flex items-center gap-1.5 text-nc-green-soft">
                    <Wifi className="size-5" aria-hidden="true" /> Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-nc-red-soft">
                    <WifiOff className="size-5" aria-hidden="true" /> Offline
                  </span>
                )}
                <button type="button" className="btn btn-ghost tap-w px-0" aria-label={`Remove ${p.name}`} data-testid="kick" onClick={() => onKick(p.id)}>
                  <X className="size-5" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex gap-3">
          <button type="button" className="btn btn-ghost btn-xl" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-purple btn-xl flex-1" disabled={players.length < 2 || busy} onClick={onStart}>
            <Play className="size-[1em] fill-current" aria-hidden="true" />
            {busy ? 'Starting…' : players.length < 2 ? 'Need at least 2 players' : `Start battle (${players.length} players)`}
          </button>
        </div>
      </section>
    </div>
  )
}

function LiveRace({ race }: { race: RaceState }) {
  const now = useServerNow(200)
  const started = race.go_at !== null && now >= race.go_at
  return (
    <div className="relative flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-[2.4rem] font-bold">Live race · Room {race.room_code}</h2>
        <Timer rules={race.rules} goAt={race.go_at} size="md" caption="RACE CLOCK" className="w-[26rem]" />
      </div>
      <RaceLanes race={race} size="lg" started={started} />
      <Countdown goAt={race.go_at} />
    </div>
  )
}

function Podium({ race, onHome, onLeaderboard, onNew }: { race: RaceState; onHome: () => void; onLeaderboard: () => void; onNew: () => void }) {
  const config = useStore(configStore)
  const idle = useIdle(config?.settings.idle_seconds ?? 30, onHome)
  const winner = race.runs.find((r) => r.is_winner)
  useEffect(() => {
    void refreshBoards()
    if (winner) {
      const t = setTimeout(() => sfx.reveal(), 400)
      return () => clearTimeout(t)
    }
  }, [winner])
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid flex-1 grid-cols-[1fr_1.2fr] items-start gap-8 portrait:grid-cols-1">
        <section className="flex flex-col items-center text-center">
          {winner ? (
            <>
              <Crown className="size-16 text-nc-yellow" aria-hidden="true" />
              <h2 className="mt-2 font-display text-[3.4rem] font-bold">{winner.name} wins!</h2>
              <p className="text-[1.5rem] text-white/70">{winner.affiliation}</p>
              <Constellation lit={winner.progress.solved.length} logo="full" sequence className="my-4 w-full max-w-[44rem]" />
              <p className="font-display text-[2rem] font-bold text-nc-yellow">
                {winner.progress.solved.length}/{race.answer_lengths.length || 6} stars · {formatSeconds(winner.time_ms)} s
              </p>
            </>
          ) : (
            <h2 className="mt-10 font-display text-[2.6rem] font-bold">No winner this time – nobody lit a star!</h2>
          )}
        </section>
        <section>
          <RaceLanes race={{ ...race, runs: liveOrder(race.runs) }} size="lg" started />
        </section>
      </div>
      <Footer idle={idle}>
        <button type="button" className="btn btn-ghost btn-xl" onClick={onLeaderboard}>
          <ListOrdered className="size-[1em]" aria-hidden="true" /> Leaderboard
        </button>
        <button type="button" className="btn btn-purple btn-xl" onClick={onNew}>
          <RotateCw className="size-[1em]" aria-hidden="true" /> New battle
        </button>
      </Footer>
    </div>
  )
}
