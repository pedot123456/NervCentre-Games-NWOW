import { useId } from 'react'
import nervcentreLogo from '../assets/nervcentre-logo.png'
import petronasLogo from '../assets/petronas-logo.png'
import { useLongPress } from '../lib/hooks'

/** NWOW mark (hexagon + connected nodes) in the brand Soft Green → Green. */
export function BrandMark({ className = '' }: { className?: string }) {
  const id = `bm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#BFD730" />
          <stop offset="1" stopColor="#00A19C" />
        </linearGradient>
      </defs>
      <path d="M24 3.5 41.8 13.75v20.5L24 44.5 6.2 34.25v-20.5Z" fill="rgb(32 65 154 / 0.55)" stroke={`url(#${id})`} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="m16.5 16.5 15 15M31.5 16.5l-15 15" stroke={`url(#${id})`} strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="3.2" fill="#fff" />
      <circle cx="16.5" cy="16.5" r="2" fill="#BFD730" />
      <circle cx="31.5" cy="16.5" r="2" fill="#BFD730" />
      <circle cx="16.5" cy="31.5" r="2" fill="#00A19C" />
      <circle cx="31.5" cy="31.5" r="2" fill="#00A19C" />
    </svg>
  )
}

/** "NWOW · Digital Project Management" – a 2.5 s press opens Admin (staff shortcut). */
export function NwowBrand({ onAdmin, compact = false }: { onAdmin?: () => void; compact?: boolean }) {
  const hold = useLongPress(() => onAdmin?.(), 2500)
  return (
    <div className="flex min-w-0 select-none items-center gap-3" {...(onAdmin ? hold : {})} data-testid="nwow-brand">
      <BrandMark className={`${compact ? 'size-10' : 'size-[3rem]'} shrink-0 drop-shadow-[0_0_14px_rgba(191,215,48,0.35)]`} />
      <div className="min-w-0 leading-tight">
        <div className={`font-display font-bold tracking-[0.12em] ${compact ? 'text-lg' : 'text-[1.45rem]'}`}>NWOW</div>
        {/* On a narrow portrait tablet the subline gives way so the page title next to it stays readable. */}
        <div className={`truncate font-semibold uppercase text-nc-lime/80 ${compact ? 'text-[max(11px,0.58rem)] tracking-[0.06em]' : 'text-[max(11px,0.72rem)] tracking-[0.2em] portrait:max-[900px]:hidden phone:hidden'}`}>Digital Project Management</div>
      </div>
    </div>
  )
}

const SIZES = {
  sm: 'text-[0.82rem]',
  md: 'text-[1.15rem]',
  lg: 'text-[clamp(1.35rem,2.6vh+0.9vw,2.5rem)]',
}

/**
 * PETRONAS + NERVCENTRE logo strip. PETRONAS (dark lettering) sits on a white panel and NERVCENTRE
 * (the version for dark backgrounds) on a brand-blue panel, joined by a diagonal split. Sized in em.
 */
export function PartnerLogos({ size = 'md', className = '' }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <div
      className={`flex h-[2.6em] select-none items-stretch overflow-hidden rounded-full bg-[linear-gradient(135deg,#20419A_0%,#13286a_100%)] shadow-[0_0.7em_1.8em_-0.6em_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.25)] ${SIZES[size]} ${className}`}
      data-testid="partner-logos"
    >
      <div className="flex items-center bg-white pl-[1.2em] pr-[1.65em] [clip-path:polygon(0_0,100%_0,calc(100%_-_0.85em)_100%,0_100%)]">
        <img src={petronasLogo} alt="PETRONAS" draggable={false} className="h-[1.6em] w-auto" />
      </div>
      <div className="flex items-center pl-[0.7em] pr-[1.25em]">
        <img src={nervcentreLogo} alt="NERVCENTRE" draggable={false} className="h-[1.32em] w-auto" />
      </div>
    </div>
  )
}
