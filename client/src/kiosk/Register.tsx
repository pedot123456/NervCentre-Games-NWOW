import { useState } from 'react'
import { Timer } from 'lucide-react'
import type { FieldErrors, PlayerInput } from '@shared/validation'
import { focusFirstInvalid, GeneralError, RegistrationFields, StartButton, toPlayer, useFieldRefs, useRegistration } from '../components/RegistrationForm'
import { configStore } from '../lib/data'
import { useIdle } from '../lib/hooks'
import { getJson } from '../lib/socket'
import { useStore } from '../lib/store'
import { KioskFrame } from './Frame'

/**
 * Device check, then the server check (incl. blocked words). Returns the server's field errors, or null when OK.
 * When the check can't be done (no connection, server error), the details are kept as they are: the
 * server checks them again when the game starts.
 */
export async function serverCheck(p: PlayerInput): Promise<{ errors: FieldErrors | null; message: string | null }> {
  const res = await getJson<{ ok: true }>('/api/players/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(p) })
  const body = res.body as { errors?: FieldErrors }
  if (!res.ok && res.status === 400 && body.errors) return { errors: body.errors, message: null }
  return { errors: null, message: null }
}

/** Solo registration ("Who's playing?"). */
export function Register({ onBack, onHome, onAdmin, onDone }: { onBack: () => void; onHome: () => void; onAdmin: () => void; onDone: (p: PlayerInput) => void }) {
  const config = useStore(configStore)
  const opus = config?.settings.opus ?? []
  const secs = config?.settings.timer_seconds ?? 30
  const reg = useRegistration(opus)
  const refs = useFieldRefs()
  const [busy, setBusy] = useState(false)
  const [general, setGeneral] = useState<string | null>(null)
  useIdle((config?.settings.idle_seconds ?? 30) * 2, onHome)

  const start = async () => {
    if (busy) return
    if (!reg.valid) {
      reg.revealAll()
      focusFirstInvalid(reg, refs)
      return
    }
    setBusy(true)
    setGeneral(null)
    const player = toPlayer(reg.value)
    const res = await serverCheck(player)
    setBusy(false)
    if (res.errors === null) return onDone(player)
    reg.setServerErrors(res.errors)
    setGeneral(res.message)
    const first = (['full_name', 'affiliation_type', 'project_name', 'opu', 'consent'] as const).find((f) => res.errors?.[f])
    if (first) refs[first].current?.focus()
  }

  return (
    <KioskFrame title="Register to play" onBack={onBack} onHome={onHome} onAdmin={onAdmin} scroll>
      <div className="flex flex-1 flex-col items-center pb-2">
        <div className="reg-card w-full max-w-[50rem] p-[max(18px,1.9rem)]">
          <h2 className="font-display text-[max(24px,2.2rem)] font-bold">Who’s playing?</h2>
          <p className="mb-4 mt-1 flex items-start gap-2 text-[max(15px,1.05rem)] text-muted">
            <Timer className="mt-[0.2em] size-[1.1em] shrink-0 text-nc-green" aria-hidden="true" />
            Your name goes on the leaderboard with your project, OPU or company – then you have {secs} seconds.
          </p>
          <RegistrationFields reg={reg} opus={opus} refs={refs} idPrefix="solo" autoFocus onSubmitLast={start} />
          <StartButton ready={reg.valid} busy={busy} onClick={start} className="mt-2" />
          <GeneralError msg={general} />
        </div>
      </div>
    </KioskFrame>
  )
}
