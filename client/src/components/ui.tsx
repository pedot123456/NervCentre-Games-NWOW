import type { ReactNode } from 'react'
import { FlaskConical, Maximize, Minimize, Settings, Volume2, VolumeX, WifiOff } from 'lucide-react'
import { useFullscreen } from '../lib/hooks'
import { connectionStore } from '../lib/socket'
import { mutedStore, sfx } from '../lib/sound'
import { useStore } from '../lib/store'

const TONES = {
  blue: 'border-nc-blue-soft/40 bg-nc-blue/40 text-nc-blue-soft',
  purple: 'border-nc-purple-soft/40 bg-nc-purple/40 text-nc-purple-soft',
  green: 'border-nc-green/50 bg-nc-green/20 text-nc-green-soft',
  yellow: 'border-nc-yellow/60 bg-nc-yellow/15 text-nc-yellow',
  red: 'border-nc-red/50 bg-nc-red/25 text-nc-red-soft',
  lime: 'border-nc-lime/60 bg-nc-lime/15 text-nc-lime',
} as const

export function Pill({ tone = 'blue', children, className = '' }: { tone?: keyof typeof TONES; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.9rem] font-bold ${TONES[tone]} ${className}`}>{children}</span>
}

export function RehearsalBadge({ on }: { on?: boolean }) {
  if (!on) return null
  return (
    <div className="pointer-events-none fixed left-1/2 top-2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full bg-nc-yellow px-4 py-1.5 text-[0.85rem] font-extrabold uppercase tracking-[0.18em] text-sky shadow-lg">
        <FlaskConical className="size-4" aria-hidden="true" />
        Rehearsal – not counted
      </div>
    </div>
  )
}

export function ConnectionBanner() {
  const state = useStore(connectionStore)
  if (state === 'online') return null
  return (
    <div className="pointer-events-none fixed left-1/2 top-12 z-[65] -translate-x-1/2" role="status" aria-live="polite">
      <div className="flex items-center gap-2 rounded-full bg-nc-red px-4 py-2 text-[0.95rem] font-bold text-white shadow-lg">
        <WifiOff className="size-4" aria-hidden="true" />
        {state === 'connecting' ? 'Connecting to the game server…' : 'Connection lost – reconnecting…'}
      </div>
    </div>
  )
}

/** Icon-only header button: a 56 px ghost square. */
export function IconButton({ label, onClick, children, className = '' }: { label: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" className={`btn btn-ghost tap-w shrink-0 px-0 ${className}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useStore(mutedStore)
  return (
    <IconButton
      label={muted ? 'Sound on' : 'Sound off'}
      className={className}
      onClick={() => {
        mutedStore.set(!muted)
        if (muted) sfx.unlock()
      }}
    >
      {muted ? <VolumeX className="size-[1.5rem]" /> : <Volume2 className="size-[1.5rem]" />}
    </IconButton>
  )
}

export function FullscreenToggle() {
  const [on, toggle] = useFullscreen()
  return (
    <IconButton label={on ? 'Exit full screen' : 'Full screen'} onClick={toggle} className="phone:hidden">
      {on ? <Minimize className="size-[1.5rem]" /> : <Maximize className="size-[1.5rem]" />}
    </IconButton>
  )
}

export function IdleHint({ seconds }: { seconds: number }) {
  return <p className="text-[0.95rem] text-white/45">Back to the home page in {seconds} s if nobody taps.</p>
}

export function AdminGear({ onAdmin }: { onAdmin: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdmin}
      aria-label="Admin"
      className="fixed bottom-[3.6rem] right-3 z-20 grid size-14 place-items-center rounded-full text-white/25 transition-colors hover:text-white/60"
    >
      <Settings className="size-6" />
    </button>
  )
}

/** Centred status text ("Loading…", "Starting…"). */
export function StatusText({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'purple' | 'red' }) {
  const color = tone === 'purple' ? 'text-nc-purple-soft' : tone === 'red' ? 'text-nc-red-soft' : 'text-nc-blue-soft'
  return <p className={`font-display text-[2rem] font-bold ${color}`}>{children}</p>
}
