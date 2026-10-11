import { forwardRef, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, X } from 'lucide-react'
import { opuSections } from '@shared/affiliation'
import { isOtherOpu } from '@shared/validation'

interface Props {
  id: string
  value: string | null
  opus: readonly string[]
  invalid?: boolean
  describedBy?: string
  onChange: (v: string) => void
  onBlur?: () => void
}

/** The OPU field: a field-sized button that opens the grouped bottom sheet. */
export const OpuSelect = forwardRef<HTMLButtonElement, Props>(function OpuSelect({ id, value, opus, invalid, describedBy, onChange, onBlur }, ref) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        ref={ref}
        id={id}
        type="button"
        className="reg-field flex items-center justify-between gap-3 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => setOpen(true)}
      >
        <span className={`truncate ${value ? '' : 'font-medium text-muted'}`}>{value ?? 'Select your OPU'}</span>
        <ChevronDown className="size-6 shrink-0 text-muted" aria-hidden="true" />
      </button>
      <OpuSheet
        open={open}
        value={value}
        opus={opus}
        onClose={() => {
          setOpen(false)
          onBlur?.()
        }}
        onPick={(v) => {
          onChange(v)
          setOpen(false)
        }}
      />
    </>
  )
})

function OpuSheet({ open, value, opus, onClose, onPick }: { open: boolean; value: string | null; opus: readonly string[]; onClose: () => void; onPick: (v: string) => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const sections = opuSections(opus.some((o) => isOtherOpu(o)) ? opus : [...opus, 'Others'])

  // While the sheet is open the page doesn't scroll; focus moves into the sheet.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const back = document.activeElement as HTMLElement | null
    setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>('[aria-selected="true"]') ?? panel.current?.querySelector<HTMLElement>('.reg-option')
      target?.focus()
    }, 50)
    return () => {
      document.body.style.overflow = prev
      back?.focus?.()
    }
  }, [open])

  const onKey = (e: KeyboardEvent) => {
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      // Focus stays inside the sheet.
      e.preventDefault()
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length]?.focus()
    } else if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      const options = items.filter((b) => b.classList.contains('reg-option'))
      const j = options.indexOf(document.activeElement as HTMLElement)
      let next = j
      if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = options.length - 1
      else next = j + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1)
      e.preventDefault()
      options[Math.max(0, Math.min(options.length - 1, next))]?.focus()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" onKeyDown={onKey}>
          <motion.div className="absolute inset-0 bg-[#050d24]/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label="Select your OPU"
            data-testid="opu-sheet"
            className="reg-card relative flex max-h-[88dvh] w-full max-w-[max(60rem,860px)] flex-col rounded-b-none px-[max(16px,1.4rem)] pb-[max(16px,env(safe-area-inset-bottom))] pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="font-display text-[max(20px,1.6rem)] font-bold">Select your OPU</h2>
              <button type="button" className="grid size-14 shrink-0 place-items-center rounded-xl border-2 border-line" aria-label="Close" onClick={onClose}>
                <X className="size-6" />
              </button>
            </div>
            <div className="-mx-1 overflow-y-auto overscroll-contain px-1 pb-2" role="listbox" aria-label="OPU">
              {sections.map((sec) => (
                <section key={sec.group ?? '_'} className="mb-3" data-testid="opu-group">
                  {sec.group && <h3 className="mb-2 text-[max(12px,0.8rem)] font-bold uppercase tracking-[0.14em] text-muted">{sec.group}</h3>}
                  <div className="grid grid-cols-2 gap-2.5 min-[700px]:grid-cols-3 min-[1000px]:grid-cols-4">
                    {sec.items.map((it) => {
                      const selected = it.value === value
                      return (
                        <button key={it.value} type="button" role="option" aria-selected={selected} className="reg-option" data-testid="opu-option" onClick={() => onPick(it.value)}>
                          <span>{it.label}</span>
                          {selected && <Check className="size-5 shrink-0" strokeWidth={3} aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
