import type { ReactNode } from 'react'
import { Lightbulb, MousePointerClick, SkipForward, Sparkles, Timer, X } from 'lucide-react'
import type { GameRules } from '@shared/types'

function Panel({ n, icon, title, children }: { n: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="panel flex flex-col gap-3 p-[1.4rem]">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-nc-blue font-display text-[1.5rem] font-bold">{n}</span>
        <span className="text-nc-lime">{icon}</span>
        <h3 className="font-display text-[1.7rem] font-bold leading-tight phone:text-[1.3rem]">{title}</h3>
      </div>
      <div className="text-[1.25rem] phone:text-[1.05rem]">{children}</div>
    </section>
  )
}

/** The three How to Play panels (penalties follow the settings). */
export function HowToPanels({ rules }: { rules: GameRules }) {
  const secs = Math.round(rules.limit_ms / 1000)
  return (
    <div className="grid grid-cols-3 gap-4 phone:grid-cols-1 portrait:grid-cols-1">
      <Panel n={1} icon={<Lightbulb className="size-8" />} title="Read the clue">
        <p className="rounded-xl bg-white/5 px-3 py-2 font-display font-semibold text-white/90">“Submits and tracks technical queries digitally”</p>
      </Panel>
      <Panel n={2} icon={<MousePointerClick className="size-8" />} title="Tap the words in order">
        <div className="mb-2 flex flex-wrap gap-2">
          <span className="rounded-lg bg-nc-lime px-2.5 py-1 font-display font-bold text-sky">1 · PTQ</span>
          <span className="rounded-lg bg-nc-lime px-2.5 py-1 font-display font-bold text-sky">2 · Online</span>
          <span className="rounded-lg border-2 border-nc-blue-soft/30 px-2.5 py-0.5 font-display font-bold text-white/35">Portal</span>
        </div>
        <p className="text-white/70">Each name you build lights a star.</p>
      </Panel>
      <Panel n={3} icon={<Sparkles className="size-8" />} title={`Light all stars in ${secs} s`}>
        <ul className="flex flex-col gap-1.5">
          <li className="flex items-center gap-2">
            <X className="size-5 text-nc-red-soft" aria-hidden="true" /> Wrong tile: <b className="text-nc-red-soft">+{rules.wrong_penalty_ms / 1000} s</b>
          </li>
          <li className="flex items-center gap-2">
            <SkipForward className="size-5 text-nc-blue-soft" aria-hidden="true" /> Skip (try it later): <b className="text-nc-red-soft">+{rules.skip_penalty_ms / 1000} s</b>
          </li>
          <li className="flex items-center gap-2">
            <Timer className="size-5 text-nc-yellow" aria-hidden="true" /> Fastest time wins
          </li>
        </ul>
      </Panel>
    </div>
  )
}
