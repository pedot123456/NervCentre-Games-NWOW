import type { ReactNode } from 'react'
import { CheckCircle2, CircleDashed, Compass, Crown, Hash, Sparkles, Timer, Trophy, X } from 'lucide-react'
import { TITLE_HINTS } from '@shared/game'
import type { RunResult } from '@shared/types'
import { formatSeconds } from '@shared/time'

const TITLES: Record<string, { cls: string; icon: ReactNode }> = {
  'NC Master': { cls: 'bg-nc-yellow text-sky', icon: <Crown className="size-[1em]" aria-hidden="true" /> },
  'NC Explorer': { cls: 'bg-nc-lime text-sky', icon: <Compass className="size-[1em]" aria-hidden="true" /> },
  'NC Rookie': { cls: 'bg-nc-purple text-white', icon: <Sparkles className="size-[1em]" aria-hidden="true" /> },
}

export function TitleBadge({ title, size = 'lg' }: { title: string; size?: 'lg' | 'md' }) {
  const t = TITLES[title] ?? TITLES['NC Rookie']
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full font-display font-bold ${t.cls} ${size === 'lg' ? 'px-5 py-2 text-[1.8rem] phone:text-[1.3rem]' : 'px-4 py-1.5 text-[1.3rem]'}`}>
      {t.icon}
      {title}
    </span>
  )
}

function Stat({ icon, label, children, tone }: { icon: ReactNode; label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="panel p-5 phone:p-4">
      <p className="label flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className={`mt-2 font-display text-[2.8rem] font-bold leading-tight tabular-nums phone:text-[1.8rem] ${tone ?? ''}`}>{children}</p>
    </div>
  )
}

function placeText(r: RunResult): string {
  if (r.is_winner) return 'Winner!'
  if (r.place === null) return '—'
  return r.place === 2 ? '2nd' : r.place === 3 ? '3rd' : `${r.place}th`
}

/** Title badge, four stat panels, a summary line and the recap of the six solutions. */
export function ResultsView({ result, compact = false }: { result: RunResult; compact?: boolean }) {
  const timeout = !result.finished
  const s = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  const parts = [s(result.wrong, 'wrong tile', 'wrong tiles'), s(result.skips, 'skip', 'skips')]
  if (!compact) parts.push(s(result.players_today, 'player today', 'players today'))
  const summary = parts.join(' · ') + (timeout ? ' · the clock ran out' : '')
  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-5'}`}>
      <div className="flex flex-wrap items-center gap-4">
        <TitleBadge title={result.title} size={compact ? 'md' : 'lg'} />
        <p className="text-[1.3rem] text-white/75 phone:text-[1.05rem]">{TITLE_HINTS[result.title]}</p>
      </div>
      <div className={`grid gap-4 ${compact ? 'grid-cols-2' : 'grid-cols-4 phone:grid-cols-2 portrait:grid-cols-2'}`}>
        <Stat icon={<Timer className="size-4 text-nc-yellow" aria-hidden="true" />} label={timeout ? 'Time used' : 'Finishing time'} tone="text-nc-yellow">
          {formatSeconds(result.time_ms)} s
        </Stat>
        <Stat icon={<Sparkles className="size-4 text-nc-purple-soft" aria-hidden="true" />} label="Stars lit">
          {result.solved}/{result.total}
        </Stat>
        {result.mode === 'solo' ? (
          <Stat icon={<Hash className="size-4" aria-hidden="true" />} label="Rank today">
            {result.is_test ? 'Rehearsal' : result.rank_today !== null ? `#${result.rank_today}` : '—'}
          </Stat>
        ) : (
          <Stat icon={<Trophy className="size-4 text-nc-yellow" aria-hidden="true" />} label={result.mode === 'battle' ? 'Battle place' : 'Head-to-Head'}>
            {placeText(result)}
          </Stat>
        )}
        <Stat icon={<X className="size-4 text-nc-red-soft" aria-hidden="true" />} label="Penalties">
          +{formatSeconds(result.penalty_ms)} s
        </Stat>
      </div>
      <p className="text-[1.1rem] text-white/65">{summary}</p>
      <section>
        <p className="label mb-2 flex items-center gap-1.5">
          <Sparkles className="size-4 text-nc-purple-soft" aria-hidden="true" /> The 6 digital solutions
        </p>
        <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2 phone:grid-cols-1'}`}>
          {result.recap.map((r) => (
            <div key={r.solution_id} className={`flex gap-3 rounded-xl border px-4 py-2.5 ${r.solved ? 'border-nc-green/50 bg-nc-green/10' : 'border-nc-blue-soft/20'}`}>
              {r.solved ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-nc-green-soft" aria-label="Built" /> : <CircleDashed className="mt-0.5 size-5 shrink-0 text-white/50" aria-label="Not built" />}
              <div className="min-w-0">
                <p className="font-display text-[1.2rem] font-bold">{r.name}</p>
                <p className="text-[1rem] text-white/70">{r.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
