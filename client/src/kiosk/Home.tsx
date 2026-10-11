import { ArrowRight, Columns2, Crown, Hand, Medal, Smartphone, Sparkles, Timer, Trophy, Users } from 'lucide-react'
import { formatSeconds } from '@shared/time'
import { PartnerLogos, NwowBrand } from '../components/Brand'
import { Ticker } from '../components/Ticker'
import { AdminGear, FullscreenToggle, SoundToggle } from '../components/ui'
import { boardsStore, configStore, useLive } from '../lib/data'
import { useIsPhone } from '../lib/hooks'
import { useStore } from '../lib/store'

interface Props {
  onBegin: () => void
  onBattle: () => void
  onH2H: () => void
  onLeaderboard: () => void
  onAdmin: () => void
}

function TitleText({ title }: { title: string }) {
  const words = title.trim().split(' ')
  const last = words.pop()
  return (
    <>
      {words.join(' ')} <span className="text-gradient">{last}</span>
    </>
  )
}

/** The attract screen. */
export function Home({ onBegin, onBattle, onH2H, onLeaderboard, onAdmin }: Props) {
  const config = useStore(configStore)
  const boards = useStore(boardsStore)
  const live = useLive()
  const phone = useIsPhone()
  const settings = config?.settings
  const secs = settings?.timer_seconds ?? 30
  const lobby = live.find((r) => r.mode === 'battle' && r.status === 'lobby' && !r.is_test)
  const top = boards?.today.slice(0, 5) ?? []

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="relative mx-auto flex w-full max-w-[112rem] flex-wrap items-center gap-4 px-[2.4rem] pt-[max(1.1rem,env(safe-area-inset-top))] phone:px-4">
        <NwowBrand onAdmin={onAdmin} />
        <div className="absolute left-1/2 top-4 -translate-x-1/2 phone:static phone:order-last phone:flex phone:w-full phone:translate-x-0 phone:justify-center portrait:static portrait:order-last portrait:flex portrait:w-full portrait:translate-x-0 portrait:justify-center">
          <PartnerLogos size="md" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle />
          <FullscreenToggle />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[112rem] flex-1 grid-cols-[1.25fr_1fr] items-center gap-12 px-[2.4rem] py-6 phone:grid-cols-1 phone:gap-6 phone:px-4 portrait:grid-cols-1">
        <section className="flex flex-col items-start">
          <p className="label mb-3 flex items-center gap-2 !text-nc-lime">
            <span className="live-dot" /> Word Rush · Booth game
          </p>
          <h1 className="font-display text-[5.4rem] font-bold leading-[0.95] tracking-tight phone:text-[2.5rem]">
            <TitleText title={settings?.event_title ?? 'NWOW Digital Challenge'} />
          </h1>
          <p className="mt-4 font-display text-[1.75rem] font-semibold text-nc-lime phone:text-[1.2rem]">{settings?.event_subtitle ?? 'Powering Project Delivery Through Digital'}</p>
          <p className="mt-3 max-w-[48rem] text-[1.2rem] text-white/80">
            Build the names of our 6 digital solutions from the word tiles in{' '}
            <b className="inline-flex items-center gap-1 whitespace-nowrap text-nc-yellow">
              <Timer className="size-[1em]" aria-hidden="true" /> {secs} seconds
            </b>
            . Each name lights a star – the fastest time wins.
          </p>

          <button
            type="button"
            className="btn btn-go mt-7 min-h-[max(80px,7rem)] w-full max-w-[52rem] rounded-[1.5rem] font-display text-[max(26px,2.6rem)] tracking-tight phone:min-h-[4.8rem] phone:text-[1.7rem]"
            onClick={onBegin}
          >
            <Hand className="size-[1.1em]" aria-hidden="true" />
            Tap to Begin
            <ArrowRight className="size-[0.9em]" aria-hidden="true" />
          </button>
          <div className={`mt-3 grid w-full max-w-[52rem] gap-3 ${phone ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button type="button" className="btn btn-purple btn-xl px-[1.2rem] text-[1.3rem]" onClick={onBattle}>
              <Smartphone className="size-[1.2em]" aria-hidden="true" /> Multiplayer Battle
            </button>
            {!phone && (
              <button type="button" className="btn btn-blue btn-xl px-[1.2rem] text-[1.3rem]" onClick={onH2H}>
                <Columns2 className="size-[1.2em]" aria-hidden="true" /> Head-to-Head
              </button>
            )}
          </div>

          {lobby ? (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-nc-purple-soft/50 bg-nc-purple/45 px-5 py-3 text-[1.2rem] font-semibold">
              <Smartphone className="size-6 shrink-0" aria-hidden="true" />
              <span>
                Battle room <b className="font-display text-[1.45rem] tracking-[0.2em]">{lobby.room_code}</b> is open – join on your phone!
              </span>
            </div>
          ) : (
            <div className="mt-7 flex flex-wrap gap-[2.2rem]">
              {[
                { icon: <Sparkles />, value: '6', label: 'Digital solutions' },
                { icon: <Timer />, value: `${secs}s`, label: 'To light them all' },
                { icon: <Users />, value: '2–4', label: 'Players per battle' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl border border-nc-green/40 bg-nc-green/15 text-nc-lime [&>svg]:size-6">{s.icon}</span>
                  <div>
                    <p className="font-display text-[1.75rem] font-bold leading-none">{s.value}</p>
                    <p className="mt-1 text-[0.78rem] font-semibold uppercase tracking-[0.12em] text-white/60">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel p-[1.8rem]">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="label flex items-center gap-2 !text-nc-lime">
                <span className="live-dot" /> Live · Today
              </p>
              <h2 className="mt-1 font-display text-[2.1rem] font-bold">Top Players</h2>
            </div>
            <Trophy className="size-11 text-nc-yellow drop-shadow-[0_0_14px_rgba(253,185,36,0.45)]" aria-hidden="true" />
          </div>
          {top.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-nc-blue-soft/35 px-5 py-10 text-center">
              <p className="font-display text-[1.4rem] font-semibold">No scores yet today</p>
              <p className="mt-1 text-white/70">Be the first to light up the constellation.</p>
            </div>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {top.map((r) => (
                <li key={r.player_key} className={`flex items-center gap-4 rounded-2xl px-4 py-2.5 ${r.rank === 1 ? 'border border-nc-yellow/40 bg-nc-yellow/10' : 'border border-white/8 bg-white/5'}`}>
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-xl border-2 font-display text-[1.2rem] font-bold ${r.rank === 1 ? 'border-nc-yellow text-nc-yellow' : r.rank <= 3 ? 'border-nc-lime text-nc-lime' : 'border-white/20'}`}
                  >
                    {r.rank === 1 ? (
                      <Crown className="size-6" aria-label="1st" />
                    ) : r.rank <= 3 ? (
                      <span className="flex items-center gap-0.5 text-[1rem]">
                        <Medal className="size-4" aria-hidden="true" />
                        {r.rank}
                      </span>
                    ) : (
                      r.rank
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[1.3rem] font-semibold">{r.name}</p>
                    <p className="truncate text-[0.95rem] text-white/70">
                      {r.affiliation} · {r.solved}/6 stars
                    </p>
                  </div>
                  <span className={`font-display text-[1.6rem] font-bold tabular-nums ${r.rank === 1 ? 'text-nc-yellow' : 'text-nc-lime'}`}>{formatSeconds(r.time_ms)}s</span>
                </li>
              ))}
            </ol>
          )}
          <button type="button" className="btn btn-ghost btn-xl mt-4 w-full text-[1.35rem]" onClick={onLeaderboard}>
            View Leaderboard <ArrowRight className="size-[1em]" aria-hidden="true" />
          </button>
        </section>
      </main>

      <Ticker />
      <AdminGear onAdmin={onAdmin} />
    </div>
  )
}
