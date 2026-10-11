import { FlaskConical, Gamepad2, House, Radio, Swords, Timer, Trophy, Users, Crown, Smartphone } from 'lucide-react'
import type { RaceState } from '@shared/types'
import { MODE_LABELS } from '@shared/types'
import { formatSeconds, KL_OFFSET_MS } from '@shared/time'
import { PartnerLogos, PmxBrand } from '../components/Brand'
import { TimesTable, WinsTable } from '../components/Boards'
import { Constellation } from '../components/Constellation'
import { Qr } from '../components/Qr'
import { RaceLanes } from '../components/RaceLanes'
import { Pill } from '../components/ui'
import { boardsStore, configStore, useLive } from '../lib/data'
import { useServerNow } from '../lib/hooks'
import { useStore } from '../lib/store'
import { publicBase } from '../kiosk/BattleHost'

/** "14:05" in Kuala Lumpur time. */
function klClock(ts: number): string {
  const d = new Date(ts + KL_OFFSET_MS)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Which race to feature: a running battle (or its how-to), then any running race, then an open lobby, then a just-finished race. */
function featured(live: RaceState[]): RaceState | null {
  const open = (r: RaceState) => r.status === 'running' || r.status === 'howto'
  return (
    live.find((r) => r.mode === 'battle' && open(r)) ??
    live.find((r) => open(r)) ??
    live.find((r) => r.status === 'lobby') ??
    [...live].filter((r) => r.status === 'finished').sort((a, b) => (b.ended_at ?? 0) - (a.ended_at ?? 0))[0] ??
    null
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="panel flex items-center gap-4 px-5 py-4">
      <span className="text-nc-blue-soft [&>svg]:size-[2.4rem]">{icon}</span>
      <div>
        <p className="label">{label}</p>
        <p className="font-display text-[2.4rem] font-bold leading-none">{value}</p>
      </div>
    </div>
  )
}

/** The TV screen (#/display): live leaderboard, live race, stats. */
export function DisplayApp() {
  const config = useStore(configStore)
  const boards = useStore(boardsStore)
  const live = useLive()
  const now = useServerNow(15_000)
  const settings = config?.settings
  const race = featured(live)
  const fastest = boards?.stats.fastest_today ?? null

  return (
    <div className="relative z-10 mx-auto flex h-dvh w-full max-w-[110rem] flex-col gap-[1.2rem] px-[2.4rem] py-[1.4rem] phone:h-auto phone:min-h-dvh phone:px-4 portrait:h-auto portrait:min-h-dvh">
      <header className="flex flex-wrap items-center gap-4">
        <PmxBrand />
        <div className="h-[2.4rem] w-px bg-white/20" aria-hidden="true" />
        <h1 className="font-display text-[2rem] font-bold">{settings?.event_title ?? 'PMX Digital Challenge'}</h1>
        <div className="flex-1" />
        <PartnerLogos size="md" />
        {settings?.rehearsal_mode && (
          <span className="flex items-center gap-1.5 rounded-full bg-nc-yellow px-3 py-1 text-[0.85rem] font-extrabold uppercase tracking-[0.18em] text-sky">
            <FlaskConical className="size-4" aria-hidden="true" /> Rehearsal
          </span>
        )}
        <p className="font-display text-[1.6rem] text-white/70 tabular-nums">{klClock(now)}</p>
        <a href="#/" className="btn btn-ghost tap-w px-0 opacity-60" aria-label="Home">
          <House className="size-[1.4rem]" />
        </a>
      </header>

      <div className="grid grid-cols-3 gap-4 phone:grid-cols-1">
        <Stat icon={<Users />} label="Players today" value={boards?.stats.players_today ?? 0} />
        <Stat icon={<Gamepad2 />} label="Games today" value={boards?.stats.games_today ?? 0} />
        <Stat icon={<Trophy />} label="Players all-time" value={boards?.stats.players_total ?? 0} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.25fr_1fr] gap-[1.2rem] portrait:grid-cols-1 phone:grid-cols-1">
        <section className="panel min-h-0 overflow-hidden p-5">
          <h2 className="mb-3 flex items-center gap-2 font-display text-[1.9rem] font-bold">
            <Trophy className="size-8 text-nc-yellow" aria-hidden="true" /> Fastest times today
          </h2>
          <TimesTable rows={boards?.today ?? []} size="md" emptyText="No games yet today – be the first on the board!" />
        </section>

        <div className="flex min-h-0 flex-col gap-[1.2rem]">
          <section className="panel border-nc-yellow/40 p-5">
            <p className="label flex items-center gap-1.5 !text-nc-yellow">
              <Timer className="size-4" aria-hidden="true" /> Fastest of the day
            </p>
            {fastest ? (
              <div className="mt-1 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-[2.6rem] font-bold leading-tight">{fastest.name}</p>
                  <p className="truncate text-[1.25rem] text-white/70">{fastest.affiliation}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-[3.4rem] font-bold leading-none text-nc-yellow tabular-nums">{formatSeconds(fastest.time_ms)} s</p>
                  <p className="text-white/70">{fastest.solved}/6 stars</p>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[1.3rem] text-white/70">Waiting for the first game of the day…</p>
            )}
          </section>

          <section className="panel min-h-0 flex-1 overflow-hidden p-5">
            {race ? <LivePanel race={race} base={publicBase(settings?.public_base_url)} /> : <WinsPanel />}
          </section>
        </div>
      </div>
    </div>
  )
}

function LivePanel({ race, base }: { race: RaceState; base: string }) {
  const now = useServerNow(500)
  const mode = race.status === 'lobby' ? 'Multiplayer Battle lobby' : MODE_LABELS[race.mode]
  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="flex flex-wrap items-center gap-2 font-display text-[1.6rem] font-bold">
        <Radio className="size-6 animate-pulse-soft text-nc-red-soft" aria-hidden="true" /> Live now <span className="text-[1.05rem] font-semibold text-white/70">· {mode}</span>
        {race.is_test && <Pill tone="yellow">Rehearsal</Pill>}
      </h2>
      {race.status === 'lobby' && (
        <div className="flex items-center gap-6">
          <Qr text={`${base}/#/join/${race.room_code}`} className="size-[11rem] shrink-0" />
          <div className="min-w-0">
            <p className="label !text-nc-purple-soft">Battle room open – join now!</p>
            <p className="font-display text-[4.4rem] font-bold leading-none tracking-[0.22em]">{race.room_code}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {race.runs.length ? (
                race.runs.map((r) => (
                  <span key={r.id} className="rounded-full bg-nc-purple px-3 py-1 font-bold">
                    {r.name}
                  </span>
                ))
              ) : (
                <span className="text-white/60">Waiting for players…</span>
              )}
            </div>
          </div>
        </div>
      )}
      {(race.status === 'running' || race.status === 'howto') && <RaceLanes race={race} size="md" started={race.go_at !== null && now >= race.go_at} />}
      {race.status === 'finished' && <JustFinished race={race} />}
    </div>
  )
}

function JustFinished({ race }: { race: RaceState }) {
  const top = [...race.runs].sort((a, b) => (a.place ?? 9) - (b.place ?? 9))[0]
  if (!top) return null
  const multi = race.mode !== 'solo'
  const winner = multi ? race.runs.find((r) => r.is_winner) : top
  const who = winner ?? top
  return (
    <div className="flex items-center gap-6">
      <Constellation lit={who.progress.solved.length} logo="mark" className="h-[9rem] w-[12rem] shrink-0" />
      <div className="min-w-0">
        <p className="label">{MODE_LABELS[race.mode]} · Just finished</p>
        <p className="flex items-center gap-2 font-display text-[2.4rem] font-bold">
          {multi && winner && <Crown className="size-[0.9em] text-nc-yellow" aria-hidden="true" />}
          {who.name}
        </p>
        <p className="text-[1.2rem] text-white/80">
          {who.progress.solved.length}/{race.answer_lengths.length || 6} stars · <b className="text-nc-yellow">{formatSeconds(who.time_ms)} s</b>
        </p>
      </div>
    </div>
  )
}

function WinsPanel() {
  const boards = useStore(boardsStore)
  return (
    <div className="flex h-full flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-[1.6rem] font-bold">
        <Swords className="size-6 text-nc-purple-soft" aria-hidden="true" /> Multiplayer wins today
      </h2>
      <WinsTable rows={(boards?.wins_today ?? []).slice(0, 5)} size="sm" />
      <p className="mt-auto flex items-center gap-2 text-white/70">
        <Smartphone className="size-5" aria-hidden="true" /> Start a Multiplayer Battle on the kiosk – join with your phone.
      </p>
    </div>
  )
}
