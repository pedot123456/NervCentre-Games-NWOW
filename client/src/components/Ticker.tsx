import { Fragment } from 'react'
import { NWOW_SOLUTION_NAMES } from '@shared/catalogue'

/** The 34 NWOW catalogue solutions scrolling along the bottom of Home. */
export function Ticker() {
  const names = [...NWOW_SOLUTION_NAMES, ...NWOW_SOLUTION_NAMES]
  return (
    <div
      className="relative z-10 w-full overflow-hidden border-t border-nc-blue-soft/15 bg-sky-950/60 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-3 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
      data-testid="ticker"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee items-center gap-8">
        {names.map((n, i) => (
          <Fragment key={i}>
            <span className="whitespace-nowrap font-display text-[0.85rem] font-semibold uppercase tracking-[0.22em] text-nc-lime/55">{n}</span>
            <span className="size-1.5 shrink-0 rotate-45 bg-nc-green" />
          </Fragment>
        ))}
      </div>
    </div>
  )
}
