import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RotateCw, Timer } from 'lucide-react'
import type { GameRules } from '@shared/types'
import { HowToPanels } from '../components/HowTo'
import { useServerNow } from '../lib/hooks'
import { serverNow } from '../lib/socket'

interface Props {
  rules: GameRules
  /** Server time when the how-to ends (Battle: synchronised). Otherwise it runs `seconds` from now. */
  endsAt?: number | null
  seconds?: number
  heading?: string
  /** Solo / Head-to-Head: the "I'm ready!" button. */
  onReady?: () => void
  /** Called once when the time is up (or ready was tapped). */
  onEnd?: () => void
  status?: 'howto' | 'starting'
  error?: string | null
  onRetry?: () => void
  footer?: ReactNode
  compact?: boolean
}

/** How to Play: three panels, a countdown in seconds and a lime progress bar. */
export function HowToScreen({ rules, endsAt, seconds = 10, heading = 'How to play', onReady, onEnd, status = 'howto', error, onRetry, footer, compact = false }: Props) {
  const [localEnd] = useState(() => serverNow() + seconds * 1000)
  const end = endsAt ?? localEnd
  const total = endsAt ? Math.max(1, seconds) * 1000 : seconds * 1000
  const now = useServerNow(100)
  const left = Math.max(0, end - now)
  const fired = useRef(false)

  useEffect(() => {
    if (left <= 0 && !fired.current && status === 'howto') {
      fired.current = true
      onEnd?.()
    }
  }, [left, onEnd, status])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-[1.6rem] font-semibold text-nc-red-soft">{error}</p>
        {onRetry && (
          <button type="button" className="btn btn-go btn-xl" onClick={onRetry}>
            <RotateCw className="size-[1em]" aria-hidden="true" /> Try again
          </button>
        )}
      </div>
    )
  }
  if (status === 'starting') return <Starting />
  return (
    <div className={`flex flex-1 flex-col justify-center gap-[1.2rem] ${compact ? 'py-2' : ''}`} data-testid="howto-screen">
      <div className="flex items-end justify-between gap-4">
        <h2 className={`font-display font-bold ${compact ? 'text-[1.8rem]' : 'text-[3rem] phone:text-[1.8rem]'}`}>{heading}</h2>
        <p className="flex items-center gap-2 font-display text-[2rem] font-bold text-nc-yellow phone:text-[1.5rem]">
          <Timer className="size-[0.9em]" aria-hidden="true" /> {Math.ceil(left / 1000)} s
        </p>
      </div>
      <HowToPanels rules={rules} />
      <div className="flex items-center gap-4">
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-nc-lime transition-[width] duration-100" style={{ width: `${Math.min(100, (1 - left / total) * 100)}%` }} />
        </div>
        {onReady && (
          <button type="button" className="btn btn-go" onClick={onReady}>
            I'm ready!
          </button>
        )}
      </div>
      {footer}
    </div>
  )
}

/** "Starting…" while the game is set up on the server; says so when that takes a while (cold start). */
function Starting() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="font-display text-[2.4rem] font-bold text-nc-blue-soft">Starting…</p>
      {slow && <p className="text-[1.2rem] text-white/60">Waiting for the game server – this can take a few seconds.</p>}
    </div>
  )
}
