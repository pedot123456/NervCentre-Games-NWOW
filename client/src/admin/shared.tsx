import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'

export function SectionCard({ title, actions, children, className = '', bodyClass = 'p-5' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          {title && <h2 className="text-lg font-extrabold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

const NOTE = {
  info: { cls: 'border-nc-blue/25 bg-nc-blue/5 text-nc-blue', icon: Info },
  error: { cls: 'border-error/35 bg-error/5 text-error', icon: CircleAlert },
  ok: { cls: 'border-nc-green/35 bg-nc-green/5 text-[#00726e]', icon: CircleCheck },
  warn: { cls: 'border-nc-yellow/50 bg-nc-yellow/15 text-[#7a5200]', icon: TriangleAlert },
} as const

export function Note({ tone = 'info', children, className = '' }: { tone?: keyof typeof NOTE; children: ReactNode; className?: string }) {
  const n = NOTE[tone]
  const Icon = n.icon
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${n.cls} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

/** Two-step button: the first tap turns it red with "Tap again to …"; it resets after 4 s. */
export function ConfirmButton({ label, confirm, onConfirm, icon, className = 'btn-light', disabled }: { label: ReactNode; confirm: string; onConfirm: () => void; icon?: ReactNode; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn min-h-0 px-3 py-2 text-sm ${armed ? 'border-error bg-error text-white hover:bg-error' : className}`}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
          return
        }
        setArmed(true)
        timer.current = setTimeout(() => setArmed(false), 4000)
      }}
    >
      {icon}
      {armed ? `Tap again to ${confirm}` : label}
    </button>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-nc-green' : 'bg-[#c5cfdb]'}`}
      >
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${checked ? 'left-[1.4rem]' : 'left-0.5'}`} />
      </button>
      <span>
        <span className="font-semibold">
          {label} <span className="font-normal text-muted">({checked ? 'On' : 'Off'})</span>
        </span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  )
}

export function StatTile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="card px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">{value}</p>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
    </div>
  )
}

export function FieldLabel({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      {children}
    </label>
  )
}

export const TH = 'px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted'
export const TD = 'px-4 py-2.5 align-top'

export function Tag({ tone, children }: { tone: 'blue' | 'purple' | 'green' | 'grey' | 'red' | 'yellow'; children: ReactNode }) {
  const cls = {
    blue: 'bg-nc-blue/10 text-nc-blue',
    purple: 'bg-nc-purple/10 text-nc-purple',
    green: 'bg-nc-green/15 text-[#00726e]',
    grey: 'bg-[#eef1f5] text-muted',
    red: 'bg-error/10 text-error',
    yellow: 'bg-nc-yellow/20 text-[#7a5200]',
  }[tone]
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}>{children}</span>
}

/** Loads data; `reload()` fetches again; `every` refreshes on an interval. */
export function useAdminData<T>(load: () => Promise<T>, deps: unknown[], every?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const ref = useRef(load)
  ref.current = load
  useEffect(() => {
    let alive = true
    ref
      .current()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  useEffect(() => {
    if (!every) return
    const t = setInterval(() => setTick((x) => x + 1), every)
    return () => clearInterval(t)
  }, [every])
  return { data, error, reload: () => setTick((x) => x + 1), setData }
}
