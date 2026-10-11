import { useEffect, useRef } from 'react'
import { Sparkles, Timer } from 'lucide-react'
import { formatSeconds } from '@shared/time'
import { sfx } from '../lib/sound'
import { Constellation } from './Constellation'

interface Props {
  lit: number
  total?: number
  name: string
  timeMs: number
  /** Ran out of time (else the round completed). */
  timeout: boolean
  compact?: boolean
  sound?: boolean
}

/** The constellation lighting star by star over the NERVCENTRE logo, then the result line. */
export function RevealContent({ lit, total = 6, name, timeMs, timeout, compact = false, sound = true }: Props) {
  const all = lit >= total
  useEffect(() => {
    if (!sound) return
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 0; i < Math.min(lit, total); i++) timers.push(setTimeout(() => sfx.star(), 250 + i * 320))
    if (all) timers.push(setTimeout(() => sfx.reveal(), 250 + (total - 1) * 320 + 100))
    return () => timers.forEach(clearTimeout)
  }, [lit, total, all, sound])

  return (
    <div className="flex w-full flex-col items-center gap-6 text-center">
      <Constellation lit={lit} logo="full" sequence className={compact ? 'w-full max-w-[34rem]' : 'w-[min(80rem,92%)] phone:w-full phone:max-w-[34rem]'} />
      <div className="animate-rise [animation-delay:1.6s]">
        {all ? (
          <p className={`flex items-center justify-center gap-3 font-display font-bold text-white ${compact ? 'text-[1.8rem]' : 'text-[3.6rem] phone:text-[1.8rem]'}`}>
            <Sparkles className="size-[0.9em] text-nc-purple-soft" aria-hidden="true" /> All 6 solutions – fully lit!
          </p>
        ) : (
          <p className={`font-display font-bold ${compact ? 'text-[1.6rem]' : 'text-[3.2rem] phone:text-[1.6rem]'}`}>
            {timeout ? "Time's up!" : 'Round complete'} {lit} of {total} stars lit
          </p>
        )}
        <p className={`mt-3 flex items-center justify-center gap-2 text-nc-yellow ${compact ? 'text-[1.2rem]' : 'text-[2rem] phone:text-[1.2rem]'}`}>
          <Timer className="size-[0.9em]" aria-hidden="true" />
          {name} · <b className="font-display font-bold tabular-nums">{formatSeconds(timeMs)} s</b>
        </p>
      </div>
    </div>
  )
}

/** Full-screen reveal; moves on by itself after 5.2 s (all six) or 3.6 s, or on a tap. */
export function Reveal(props: Props & { onDone: () => void }) {
  const { onDone, ...rest } = props
  const all = rest.lit >= (rest.total ?? 6)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const t = setTimeout(() => done.current(), all ? 5200 : 3600)
    return () => clearTimeout(t)
  }, [all])
  return (
    <div className="relative z-10 flex min-h-dvh items-center justify-center p-8" onPointerDown={onDone} role="button" tabIndex={0} aria-label="Continue">
      <RevealContent {...rest} />
    </div>
  )
}
