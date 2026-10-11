import { useEffect, useRef } from 'react'
import { useServerNow } from '../lib/hooks'
import { sfx } from '../lib/sound'

/**
 * 3-2-1-GO! over the race area, driven by SERVER time so every screen in a battle shows the same
 * number. Before 3 s: "Get ready…"; GO! shows for 0.7 s, then the overlay goes.
 */
export function Countdown({ goAt, fixed = false, sound = true }: { goAt: number | null; fixed?: boolean; sound?: boolean }) {
  const now = useServerNow(50)
  const last = useRef<string | null>(null)
  const d = goAt === null ? Infinity : goAt - now
  let label: string | null = null
  if (d > 3000) label = 'ready'
  else if (d > 2000) label = '3'
  else if (d > 1000) label = '2'
  else if (d > 0) label = '1'
  else if (d > -700) label = 'GO!'

  useEffect(() => {
    if (!label || label === last.current) return
    last.current = label
    if (!sound) return
    if (label === 'GO!') sfx.go()
    else if (label !== 'ready') sfx.count()
  }, [label, sound])

  if (!label) return null
  return (
    <div
      className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 z-30 grid place-items-center rounded-2xl bg-sky/55 backdrop-blur-[2px]`}
      data-testid="countdown"
      aria-live="assertive"
    >
      {label === 'ready' ? (
        <p className="font-display text-[2.4rem] font-bold text-nc-blue-soft">Get ready…</p>
      ) : (
        <span
          key={label}
          className={`animate-count font-display text-[min(16rem,40vw)] font-bold leading-none drop-shadow-[0_0_40px_rgba(176,127,214,0.8)] ${label === 'GO!' ? 'text-nc-lime' : 'text-white'}`}
        >
          {label}
        </span>
      )}
    </div>
  )
}
