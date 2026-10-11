import { useEffect, useState } from 'react'
import { BrandMark, PartnerLogos } from '../components/Brand'

/** 1 s splash: logos, PMX mark, title, progress bar. A tap skips it. */
export function Splash({ title, subtitle, onDone }: { title: string; subtitle: string; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1000)
    const t2 = setTimeout(onDone, 1400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onDone])
  const words = title.trim().split(' ')
  const last = words.pop()
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-between bg-[radial-gradient(ellipse_120%_80%_at_30%_-10%,#20419a_0%,#13286a_45%,#0b1a47_100%)] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] transition-opacity duration-[400ms] ${leaving ? 'opacity-0' : 'opacity-100'}`}
      onPointerDown={onDone}
      data-testid="splash"
    >
      <div className="grid-lines absolute inset-0" aria-hidden="true" />
      <div className="relative animate-rise pt-[max(clamp(1.25rem,5vh,3.5rem),env(safe-area-inset-top))]">
        <PartnerLogos size="lg" />
      </div>
      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-5 animate-pop">
          <div className="absolute -inset-[35%] rounded-full bg-nc-green/25 blur-2xl" aria-hidden="true" />
          <BrandMark className="relative size-[clamp(4.5rem,11vh,8rem)]" />
        </div>
        <p className="label mb-3 !text-nc-lime">PMX · Digital Project Management</p>
        <h1 className="font-display text-[clamp(2.4rem,4.5vw+2vh,6rem)] font-bold leading-[0.95] tracking-tight">
          {words.join(' ')} <span className="text-gradient">{last}</span>
        </h1>
        <p className="mt-4 font-display text-[clamp(1.1rem,1.2vw+0.8vh,1.9rem)] font-medium text-nc-lime">{subtitle}</p>
      </div>
      <div className="relative flex flex-col items-center gap-3">
        <div className="h-1.5 w-[min(22rem,70vw)] overflow-hidden rounded-full bg-white/15">
          <div className="h-full origin-left bg-gradient-to-r from-nc-green to-nc-lime [animation:splash-fill_1000ms_linear_both]" />
        </div>
        <p className="font-display text-[0.8rem] font-semibold tracking-[0.3em] text-white/60">GET READY</p>
      </div>
    </div>
  )
}
