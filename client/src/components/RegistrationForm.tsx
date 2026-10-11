import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Briefcase, Building2, Check, CircleAlert, HardHat, ShieldCheck } from 'lucide-react'
import { OpuSelect } from './OpuSelect'
import { AFFILIATION_LABELS, AFFILIATION_TYPES, CONSENT_TEXT, checkRegistration, isOtherOpu, LIMITS, MESSAGES, type AffiliationType, type Field, type FieldErrors, type PlayerInput } from '@shared/validation'

export interface RegValue {
  full_name: string
  affiliation_type: AffiliationType | null
  /** Project name (Project) or company name (Contractor). */
  project_name: string
  opu: string | null
  /** The OPU typed in after picking "Others". */
  opu_other: string
  consent: boolean
}

export const emptyReg = (): RegValue => ({ full_name: '', affiliation_type: null, project_name: '', opu: null, opu_other: '', consent: false })

export const toPlayer = (v: RegValue): PlayerInput => ({
  full_name: v.full_name,
  affiliation_type: v.affiliation_type,
  project_name: v.affiliation_type === 'project' || v.affiliation_type === 'contractor' ? v.project_name : null,
  opu: v.affiliation_type === 'business' ? (isOtherOpu(v.opu) ? v.opu_other : v.opu) : null,
  consent: v.consent,
})

/** Form state + the device-side check (the server checks again, including blocked words). */
export function useRegistration(opus: readonly string[]) {
  const [value, setValue] = useState<RegValue>(emptyReg)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [showAll, setShowAll] = useState(false)
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const check = useMemo(() => checkRegistration(toPlayer(value), opus), [value, opus])
  const deviceErrors: FieldErrors = check.ok ? {} : check.errors
  const visible: FieldErrors = {}
  for (const f of ['full_name', 'affiliation_type', 'project_name', 'opu', 'consent'] as Field[]) {
    const msg = serverErrors[f] ?? ((showAll || touched[f]) && deviceErrors[f])
    if (msg) visible[f] = msg
  }
  return {
    value,
    valid: check.ok,
    errors: visible,
    firstInvalid: check.ok ? null : check.field,
    update(patch: Partial<RegValue>) {
      setValue((v) => {
        const next = { ...v, ...patch }
        // Switching between Project, Business and Contractor clears the other fields.
        if (patch.affiliation_type && patch.affiliation_type !== v.affiliation_type) {
          next.project_name = ''
          next.opu = null
          next.opu_other = ''
        }
        return next
      })
      setServerErrors((e) => {
        const n = { ...e }
        for (const k of Object.keys(patch)) delete n[(k === 'opu_other' ? 'opu' : k) as Field]
        if (patch.affiliation_type) {
          delete n.project_name
          delete n.opu
        }
        return n
      })
    },
    touch(f: Field) {
      setTouched((t) => ({ ...t, [f]: true }))
    },
    revealAll() {
      setShowAll(true)
    },
    setServerErrors,
    reset() {
      setValue(emptyReg())
      setTouched({})
      setShowAll(false)
      setServerErrors({})
    },
  }
}

export type Registration = ReturnType<typeof useRegistration>

function ErrorLine({ id, msg }: { id: string; msg?: string | false }) {
  return (
    <p id={id} className="reg-error" aria-live="polite">
      {msg && (
        <>
          <CircleAlert className="mt-[0.1em] size-[1.05em] shrink-0" aria-hidden="true" />
          {msg}
        </>
      )}
    </p>
  )
}

export interface FieldRefs {
  full_name: RefObject<HTMLInputElement | null>
  affiliation_type: RefObject<HTMLButtonElement | null>
  project_name: RefObject<HTMLInputElement | null>
  opu: RefObject<HTMLButtonElement | null>
  opu_other: RefObject<HTMLInputElement | null>
  consent: RefObject<HTMLButtonElement | null>
}

export function useFieldRefs(): FieldRefs {
  return {
    full_name: useRef<HTMLInputElement>(null),
    affiliation_type: useRef<HTMLButtonElement>(null),
    project_name: useRef<HTMLInputElement>(null),
    opu: useRef<HTMLButtonElement>(null),
    opu_other: useRef<HTMLInputElement>(null),
    consent: useRef<HTMLButtonElement>(null),
  }
}


/** The registration fields (full name, Project / Business / Contractor, project name, OPU or company name, consent). */
export function RegistrationFields({
  reg,
  opus,
  refs,
  idPrefix,
  tight = false,
  autoFocus = false,
  onSubmitLast,
}: {
  reg: Registration
  opus: readonly string[]
  refs: FieldRefs
  idPrefix: string
  tight?: boolean
  autoFocus?: boolean
  /** Enter in the last text field. */
  onSubmitLast: () => void
}) {
  const { value, errors } = reg
  const id = (f: string) => `${idPrefix}-${f}`
  const gap = tight ? 'mb-2' : 'mb-3'
  return (
    <div>
      <div className={gap}>
        <label className="reg-label" htmlFor={id('name')}>
          Full name
        </label>
        <input
          ref={refs.full_name}
          id={id('name')}
          className="reg-field"
          placeholder="e.g. Nur Aisyah binti Ahmad"
          maxLength={LIMITS.name.max}
          autoCapitalize="words"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          autoFocus={autoFocus}
          value={value.full_name}
          aria-invalid={!!errors.full_name || undefined}
          aria-describedby={id('name-err')}
          onChange={(e) => reg.update({ full_name: e.target.value })}
          onBlur={() => value.full_name && reg.touch('full_name')}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              reg.touch('full_name')
              refs.affiliation_type.current?.focus()
            }
          }}
        />
        <ErrorLine id={id('name-err')} msg={errors.full_name} />
      </div>

      <div className={gap}>
        <span className="reg-label" id={id('from')}>
          You are from
        </span>
        <div className="grid grid-cols-3 gap-[max(10px,0.8rem)]" role="radiogroup" aria-labelledby={id('from')} aria-describedby={id('from-err')}>
          {AFFILIATION_TYPES.map((t, i) => {
            const on = value.affiliation_type === t
            const Icon = t === 'project' ? HardHat : t === 'business' ? Briefcase : Building2
            return (
              <button
                key={t}
                ref={i === 0 ? refs.affiliation_type : undefined}
                type="button"
                role="radio"
                aria-checked={on}
                aria-invalid={!!errors.affiliation_type || undefined}
                className="reg-toggle"
                data-testid={`from-${t}`}
                tabIndex={on || (!value.affiliation_type && i === 0) ? 0 : -1}
                onClick={() => {
                  reg.update({ affiliation_type: t })
                  reg.touch('affiliation_type')
                  setTimeout(() => (t !== 'business' ? refs.project_name.current?.focus() : undefined), 60)
                }}
                onKeyDown={(e) => {
                  if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                    e.preventDefault()
                    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
                    const j = (i + step + AFFILIATION_TYPES.length) % AFFILIATION_TYPES.length
                    reg.update({ affiliation_type: AFFILIATION_TYPES[j] })
                    ;(e.currentTarget.parentElement?.children[j] as HTMLElement)?.focus()
                  }
                }}
              >
                {on ? <Check className="size-[1.1em]" strokeWidth={3} aria-hidden="true" /> : <Icon className="size-[1.1em] text-nc-blue" aria-hidden="true" />}
                {AFFILIATION_LABELS[t]}
              </button>
            )
          })}
        </div>
        <ErrorLine id={id('from-err')} msg={errors.affiliation_type} />
      </div>

      <AnimatePresence initial={false}>
        {value.affiliation_type && (
          <motion.div
            key={value.affiliation_type}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
            data-testid="conditional"
          >
            <div className={`${gap} px-0.5 pt-0.5`}>
              {value.affiliation_type !== 'business' ? (
                <>
                  <label className="reg-label" htmlFor={id('project')}>
                    {value.affiliation_type === 'project' ? 'Project name' : 'Company name'}
                  </label>
                  <input
                    ref={refs.project_name}
                    id={id('project')}
                    className="reg-field"
                    data-testid="project-name"
                    placeholder={value.affiliation_type === 'project' ? 'e.g. Kasawari CCS' : 'e.g. ABC Engineering Sdn Bhd'}
                    maxLength={LIMITS.project.max}
                    autoCapitalize="words"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    value={value.project_name}
                    aria-invalid={!!errors.project_name || undefined}
                    aria-describedby={id('project-err')}
                    onChange={(e) => reg.update({ project_name: e.target.value })}
                    onBlur={() => value.project_name && reg.touch('project_name')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        reg.touch('project_name')
                        onSubmitLast()
                      }
                    }}
                  />
                  <ErrorLine id={id('project-err')} msg={errors.project_name} />
                </>
              ) : (
                <>
                  <label className="reg-label" htmlFor={id('opu')}>
                    OPU
                  </label>
                  <OpuSelect
                    ref={refs.opu}
                    id={id('opu')}
                    value={value.opu}
                    opus={opus}
                    invalid={!!errors.opu}
                    describedBy={id('opu-err')}
                    onChange={(v) => {
                      reg.update({ opu: v })
                      if (isOtherOpu(v)) setTimeout(() => refs.opu_other.current?.focus(), 60)
                      else reg.touch('opu')
                    }}
                    onBlur={() => !isOtherOpu(value.opu) && reg.touch('opu')}
                  />
                  {isOtherOpu(value.opu) && (
                    <>
                      <label className="reg-label mt-3" htmlFor={id('opu-other')}>
                        Your OPU
                      </label>
                      <input
                        ref={refs.opu_other}
                        id={id('opu-other')}
                        className="reg-field"
                        data-testid="opu-other"
                        placeholder="Type your OPU"
                        maxLength={LIMITS.project.max}
                        autoCapitalize="words"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        enterKeyHint="go"
                        value={value.opu_other}
                        aria-invalid={!!errors.opu || undefined}
                        aria-describedby={id('opu-err')}
                        onChange={(e) => reg.update({ opu_other: e.target.value })}
                        onBlur={() => value.opu_other && reg.touch('opu')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            reg.touch('opu')
                            onSubmitLast()
                          }
                        }}
                      />
                    </>
                  )}
                  <ErrorLine id={id('opu-err')} msg={errors.opu && isOtherOpu(value.opu) ? MESSAGES.opu_other : errors.opu} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <button
          ref={refs.consent}
          type="button"
          role="checkbox"
          aria-checked={value.consent}
          aria-invalid={!!errors.consent || undefined}
          aria-describedby={id('consent-err')}
          data-testid="consent"
          className={`flex w-full items-start gap-3 rounded-xl border-2 p-[max(12px,0.85rem)] text-left transition-colors ${value.consent ? 'border-nc-lime bg-nc-lime/15' : errors.consent ? 'border-nc-red' : 'border-line'}`}
          onClick={() => {
            reg.update({ consent: !value.consent })
            reg.touch('consent')
          }}
        >
          <span className={`grid size-[max(28px,2rem)] shrink-0 place-items-center rounded-lg border-2 ${value.consent ? 'border-nc-lime bg-nc-lime' : 'border-muted'}`}>
            {value.consent && <Check className="size-[70%] text-nc-navy" strokeWidth={3.5} aria-hidden="true" />}
          </span>
          <span className="text-[max(15px,1.05rem)] font-medium leading-snug">
            <ShieldCheck className="mr-1 inline size-[1.1em] align-[-0.2em] text-nc-green" aria-hidden="true" />
            {CONSENT_TEXT}
          </span>
        </button>
        <ErrorLine id={id('consent-err')} msg={errors.consent} />
      </div>
    </div>
  )
}

/** Moves focus to the first problem (after a tap on a not-yet-valid Start). */
export function focusFirstInvalid(reg: Registration, refs: FieldRefs) {
  const f = reg.firstInvalid
  if (!f) return
  const el = (f === 'opu' && isOtherOpu(reg.value.opu) ? refs.opu_other.current : refs[f].current) ?? (f === 'opu' || f === 'project_name' ? refs.affiliation_type.current : null)
  el?.focus()
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
}

/** Start: looks disabled until the form is valid, but a tap still reveals every problem inline. */
export function StartButton({ ready, busy, onClick, children, className = '' }: { ready: boolean; busy: boolean; onClick: () => void; children?: ReactNode; className?: string }) {
  return (
    <button type="button" className={`btn btn-green btn-xl w-full text-[max(20px,1.6rem)] ${className}`} aria-disabled={!ready || busy} onClick={onClick}>
      {busy ? (
        'Checking…'
      ) : (
        <>
          {children ?? 'Start'}
          <ArrowRight className="size-[1em]" aria-hidden="true" />
        </>
      )}
    </button>
  )
}

export function GeneralError({ msg }: { msg: string | null }) {
  if (!msg) return null
  return (
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-nc-red/35 bg-nc-red/8 px-4 py-3 font-semibold text-nc-red" role="alert">
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      {msg}
    </div>
  )
}
