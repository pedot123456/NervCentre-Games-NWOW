import { Check, Crown, Hourglass, Wifi, WifiOff, Zap } from 'lucide-react'
import type { RaceState, RunPublic } from '@shared/types'
import { formatSeconds } from '@shared/time'
import { Constellation } from './Constellation'

/** Live order: final place if known; otherwise more solved, then whoever solved last sooner, then lane. */
export function liveOrder(runs: RunPublic[]): RunPublic[] {
  return [...runs].sort((a, b) => {
    if (a.place !== null && b.place !== null) return a.place - b.place
    const sa = a.progress.solved.length
    const sb = b.progress.solved.length
    if (sa !== sb) return sb - sa
    const la = a.progress.last_solve_ms ?? Infinity
    const lb = b.progress.last_solve_ms ?? Infinity
    if (la !== lb) return la - lb
    return a.lane - b.lane
  })
}

/** Stars incl. partial progress through the current name (for the bar). */
function fraction(run: RunPublic, race: RaceState): number {
  const total = race.answer_lengths.length || 6
  const p = run.progress
  let partial = 0
  const cur = p.queue[0]
  if (!p.ended && cur !== undefined && race.answer_lengths[cur]) partial = p.progress / race.answer_lengths[cur]
  return Math.min(1, (p.solved.length + partial) / total)
}

function Status({ run, started }: { run: RunPublic; started: boolean }) {
  const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-bold'
  if (run.status === 'finished') {
    return (
      <span className={`${base} bg-nc-green text-white`}>
        <Check className="size-4" strokeWidth={3} aria-hidden="true" /> {formatSeconds(run.time_ms)} s
      </span>
    )
  }
  if (run.status === 'timeout')
    return (
      <span className={`${base} bg-white/10`}>
        <Hourglass className="size-4" aria-hidden="true" /> Time up
      </span>
    )
  if (!run.connected)
    return (
      <span className={`${base} bg-nc-red/30 text-nc-red-soft`}>
        <WifiOff className="size-4" aria-hidden="true" /> Offline
      </span>
    )
  if (!started)
    return (
      <span className={`${base} bg-nc-blue/40`}>
        <Wifi className="size-4" aria-hidden="true" /> Ready
      </span>
    )
  return (
    <span className={`${base} bg-nc-purple/50 text-nc-purple-soft`}>
      <Zap className="size-4" aria-hidden="true" /> Racing
    </span>
  )
}

export function RaceLanes({ race, size = 'lg', started }: { race: RaceState; size?: 'lg' | 'md'; started: boolean }) {
  const runs = liveOrder(race.runs)
  const leader = runs[0]
  const total = race.answer_lengths.length || 6
  return (
    <div className="flex flex-col gap-3">
      {runs.map((run, i) => {
        const isLeader = run === leader && (run.progress.solved.length > 0 || run.place === 1)
        const winner = run.is_winner
        const penalties = run.progress.penalty_ms
        return (
          <div
            key={run.id}
            className={`panel grid items-center ${size === 'lg' ? 'grid-cols-[3.4rem_minmax(0,1.1fr)_9rem_minmax(0,1.6fr)_auto] gap-4 p-4 phone:grid-cols-[2.4rem_1fr_auto] phone:gap-3' : 'grid-cols-[2.4rem_minmax(0,1fr)_6rem_minmax(0,1.2fr)] gap-3 p-3 phone:grid-cols-[2.4rem_1fr_6rem]'} ${isLeader ? 'border-nc-yellow/60' : ''}`}
          >
            <div className={`grid size-12 place-items-center rounded-full font-display text-[1.4rem] font-bold ${size === 'md' ? 'size-10 text-[1.1rem]' : ''} ${isLeader ? 'bg-nc-yellow text-sky' : 'bg-white/10'}`}>
              {winner ? <Crown className="size-6" aria-hidden="true" /> : i + 1}
            </div>
            <div className="min-w-0">
              <p className={`truncate font-display font-bold ${size === 'lg' ? 'text-[1.7rem] phone:text-[1.2rem]' : 'text-[1.3rem]'}`}>{run.name}</p>
              <p className="truncate text-[1.05rem] text-white/60">{run.affiliation}</p>
            </div>
            <Constellation lit={run.progress.solved.length} className={`${size === 'lg' ? 'h-[5.6rem] w-[8rem]' : 'h-[4.2rem] w-[6rem]'} phone:hidden`} />
            <div className={`min-w-0 ${size === 'lg' ? 'phone:col-span-3' : 'col-span-1 phone:col-span-3'}`}>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[1.05rem]">
                <b>
                  {run.progress.solved.length}/{total} stars
                </b>
                {penalties > 0 && <span className="font-bold text-nc-red-soft">+{formatSeconds(penalties)} s</span>}
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-nc-purple to-nc-purple-soft transition-[width] duration-300" style={{ width: `${fraction(run, race) * 100}%` }} />
              </div>
              {size === 'md' && (
                <div className="mt-2">
                  <Status run={run} started={started} />
                </div>
              )}
            </div>
            {size === 'lg' && (
              <div className="phone:col-start-3 phone:row-start-1">
                <Status run={run} started={started} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
