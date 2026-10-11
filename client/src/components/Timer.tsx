import { useEffect, useRef } from 'react'
import { AlarmClock, Timer as TimerIcon } from 'lucide-react'
import { remainingMs } from '@shared/game'
import type { GameRules, RunProgress } from '@shared/types'
import { formatSeconds } from '@shared/time'
import { useServerNow } from '../lib/hooks'
import { sfx } from '../lib/sound'

const SIZES = {
  lg: { num: 'text-[5.2rem]', icon: 'size-[3.2rem]' },
  md: { num: 'text-[3.4rem]', icon: 'size-[2.2rem]' },
  sm: { num: 'text-[2.4rem]', icon: 'size-[1.6rem]' },
}

interface Props {
  rules: GameRules
  goAt: number | null
  /** The run's progress (penalties move the clock forward). Omit for the plain race clock. */
  progress?: RunProgress | null
  size?: keyof typeof SIZES
  /** Plays the tick sound in the last 5 s (only one timer per screen should). */
  ticks?: boolean
  caption?: string
  className?: string
}

/** Counts down from the limit to 0.00 (to 0.01 s); red, pulsing and ticking in the last 5 s. */
export function Timer({ rules, goAt, progress, size = 'lg', ticks = false, caption, className = '' }: Props) {
  const now = useServerNow(0)
  const elapsed = goAt === null ? 0 : Math.max(0, now - goAt)
  const p = progress ?? null
  let left = p ? remainingMs(p, rules, elapsed) : Math.max(0, rules.limit_ms - elapsed)
  if (p?.ended) left = p.ended === 'finished' && p.finish_ms !== null ? Math.max(0, rules.limit_ms - p.finish_ms) : 0
  if (goAt === null || now < goAt) left = rules.limit_ms
  const urgent = left <= 5000
  const over = left <= 0
  const lastTick = useRef<number | null>(null)

  useEffect(() => {
    if (!ticks || !urgent || over || p?.ended || goAt === null || now < goAt) return
    const sec = Math.ceil(left / 1000)
    if (lastTick.current !== sec) {
      lastTick.current = sec
      sfx.tick()
    }
  }, [ticks, urgent, over, left, p?.ended, goAt, now])

  const s = SIZES[size]
  const color = urgent ? 'text-nc-red-soft' : 'text-nc-yellow'
  const label = caption ?? (over ? "TIME'S UP" : urgent ? 'HURRY!' : 'TIME LEFT')
  const Icon = urgent ? AlarmClock : TimerIcon
  return (
    <div className={`flex flex-col items-stretch ${className}`}>
      <div className={`flex items-center justify-center gap-3 ${color}`} role="timer" aria-label={`${formatSeconds(left)} seconds left`}>
        <Icon className={`${s.icon} shrink-0`} aria-hidden="true" />
        <span className={`font-display font-bold tabular-nums leading-none ${s.num} ${urgent && !over ? 'animate-tick' : ''}`}>
          {formatSeconds(left)}
          <span className="ml-1 text-[1.4rem] font-semibold opacity-80">s</span>
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${urgent ? 'bg-nc-red-soft' : 'bg-nc-yellow'}`} style={{ width: `${(left / rules.limit_ms) * 100}%` }} />
      </div>
      <p className={`mt-2 text-center text-[0.95rem] font-bold uppercase tracking-[0.18em] ${urgent && !caption ? 'text-nc-red-soft' : 'text-nc-yellow/80'}`}>{label}</p>
    </div>
  )
}
