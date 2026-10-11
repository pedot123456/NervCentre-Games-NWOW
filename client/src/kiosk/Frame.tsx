import type { ReactNode } from 'react'
import { ArrowLeft, House } from 'lucide-react'
import { PmxBrand } from '../components/Brand'
import { FullscreenToggle, IconButton, SoundToggle } from '../components/ui'

interface Props {
  title?: ReactNode
  onBack?: () => void
  onHome?: () => void
  onAdmin?: () => void
  right?: ReactNode
  children: ReactNode
  /** Content scrolls instead of fitting the screen. */
  scroll?: boolean
  className?: string
}

/**
 * The page shell of every kiosk screen after Home: header (Back, PMX brand, title, controls,
 * Home, sound, full screen) and the page. Back and Home never show during a race or the feedback.
 */
export function KioskFrame({ title, onBack, onHome, onAdmin, right, children, scroll = false, className = '' }: Props) {
  return (
    <div
      className={`relative z-10 mx-auto flex w-full max-w-[112rem] flex-col px-[2.4rem] pb-[1.4rem] pt-[max(1.1rem,env(safe-area-inset-top))] phone:min-h-dvh phone:px-4 portrait:min-h-dvh max-[700px]:min-h-dvh ${scroll ? 'min-h-dvh' : 'h-dvh phone:h-auto portrait:h-auto max-[700px]:h-auto'}`}
    >
      <header className="mb-4 flex flex-wrap items-center gap-4 phone:gap-x-2 phone:gap-y-3">
        {onBack && (
          <IconButton label="Back" onClick={onBack}>
            <ArrowLeft className="size-[1.5rem]" />
          </IconButton>
        )}
        <PmxBrand onAdmin={onAdmin} />
        {title && (
          <>
            <div className="h-[2.4rem] w-px bg-white/20 phone:hidden" aria-hidden="true" />
            <h1 className="min-w-0 flex-1 truncate font-display text-[1.6rem] font-bold phone:order-last phone:w-full phone:flex-none phone:text-[1.2rem]" data-testid="title">
              {title}
            </h1>
          </>
        )}
        {!title && <div className="flex-1" />}
        {right && <div className="flex items-center gap-2 phone:order-last phone:w-full">{right}</div>}
        <div className="flex items-center gap-2 phone:ml-auto">
          {onHome && (
            <button type="button" className="btn btn-ghost tap-w phone:px-0" onClick={onHome} data-testid="home-button" aria-label="Home">
              <House className="size-[1.4rem]" />
              <span className="phone:hidden">Home</span>
            </button>
          )}
          <SoundToggle />
          <FullscreenToggle />
        </div>
      </header>
      <main className={`relative flex min-h-0 flex-1 flex-col ${className}`}>{children}</main>
    </div>
  )
}
