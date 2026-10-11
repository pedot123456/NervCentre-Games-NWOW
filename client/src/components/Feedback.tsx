import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Star } from 'lucide-react'
import { FEEDBACK_COPY, FEEDBACK_SOLUTIONS, OTHER_SOLUTION_LABEL, OTHER_SOLUTION_PREFIX, UNDERSTANDING_LABELS } from '@shared/feedback'
import { cleanText, LIMITS } from '@shared/validation'
import { uuid } from '@shared/random'
import { submitFeedback } from '../lib/feedback'
import type { Seat } from '../lib/useRun'

interface Props {
  seat: Pick<Seat, 'run_id' | 'token'>
  /** Head-to-Head: "Player 1 of 2 · Name". */
  who?: string
  phone?: boolean
  onDone: () => void
}

/** Radio-group keyboard support: arrows move and select. */
function radioKeys(count: number, current: number, pick: (i: number) => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!next) return
    e.preventDefault()
    const i = (Math.max(0, current) + next + count) % count
    pick(i)
    ;(e.currentTarget.children[i] as HTMLElement | undefined)?.focus()
  }
}

function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean) => void; label: string }) {
  const options = [true, false]
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={label} onKeyDown={radioKeys(2, value === null ? -1 : value ? 0 : 1, (i) => onChange(options[i]))}>
      {options.map((v, i) => {
        const on = value === v
        return (
          <button key={String(v)} type="button" role="radio" aria-checked={on} tabIndex={on || (value === null && i === 0) ? 0 : -1} className="fb-choice" onClick={() => onChange(v)}>
            {on ? <Check className="size-[1.1em]" strokeWidth={3} aria-hidden="true" /> : <span aria-hidden="true">{v ? '👍' : '👎'}</span>}
            {v ? 'Yes' : 'No'}
          </button>
        )
      })}
    </div>
  )
}

function Question({ n, text, children, phone }: { n: number; text: string; children: ReactNode; phone?: boolean }) {
  return (
    <section className="rounded-[1.1rem] border border-line bg-white p-[max(14px,1.1rem)]">
      <h3 className={`fb-question mb-3 ${phone ? 'text-[1.05rem]' : 'text-[1.25rem]'}`}>
        <span className="fb-num">{n}</span>
        {text}
      </h3>
      {children}
    </section>
  )
}

/** Question 2 answers: the picked chips, plus the typed-in name when "Others" is ticked. */
function interest(chips: string[], otherOn: boolean, otherText: string): string[] | null {
  const typed = otherOn ? cleanText(otherText) : ''
  const all = typed ? [...chips, OTHER_SOLUTION_PREFIX + typed] : chips
  return all.length ? all : null
}

/** Three one-tap questions between the reveal and the result card. */
export function FeedbackForm({ seat, who, phone = false, onDone }: Props) {
  const [q1, setQ1] = useState<boolean | null>(null)
  const [q2, setQ2] = useState<boolean | null>(null)
  const [chips, setChips] = useState<string[]>([])
  const [otherOn, setOtherOn] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [q3, setQ3] = useState(0)
  const [pop, setPop] = useState(0)
  const [sending, setSending] = useState(false)
  const feedbackId = useRef(uuid())
  const ready = q1 !== null && q2 !== null && q3 > 0

  const send = async () => {
    if (!ready || sending) return
    setSending(true)
    // Stored on the device first: even offline the player sees the result straight away.
    void submitFeedback({
      feedback_id: feedbackId.current,
      run_id: seat.run_id,
      token: seat.token,
      q1_relevant: q1!,
      q2_would_explore: q2!,
      q2_interested_solutions: q2 ? interest(chips, otherOn, otherText) : null,
      q3_understanding_rating: q3,
    })
    setTimeout(onDone, 350)
  }

  return (
    <div className="fb-page flex flex-col gap-3" data-testid="feedback-form">
      <header className="mb-1">
        {who && (
          <span className="mb-2 inline-block rounded-full bg-nc-blue px-3 py-1 text-[0.95rem] font-extrabold text-white" data-testid="feedback-who">
            {who}
          </span>
        )}
        <h2 className={`fb-title ${phone ? 'text-[1.3rem]' : 'text-[2rem]'}`}>{FEEDBACK_COPY.heading}</h2>
        <p className="font-semibold text-text/75">{FEEDBACK_COPY.intro}</p>
      </header>

      <Question n={1} text={FEEDBACK_COPY.q1} phone={phone}>
        <YesNo value={q1} onChange={setQ1} label={FEEDBACK_COPY.q1} />
      </Question>

      <Question n={2} text={FEEDBACK_COPY.q2} phone={phone}>
        <YesNo
          value={q2}
          label={FEEDBACK_COPY.q2}
          onChange={(v) => {
            setQ2(v)
            if (!v) {
              setChips([])
              setOtherOn(false)
              setOtherText('')
            }
          }}
        />
        <AnimatePresence initial={false}>
          {q2 && (
            <motion.div initial={{ height: 0, opacity: 0, y: -6 }} animate={{ height: 'auto', opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -6 }} transition={{ duration: 0.24 }} className="overflow-hidden">
              <p className="mb-2 mt-3 font-bold text-muted">{FEEDBACK_COPY.q2_chips}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={FEEDBACK_COPY.q2_chips}>
                {FEEDBACK_SOLUTIONS.map((s) => {
                  const on = chips.includes(s.id)
                  return (
                    <button key={s.id} type="button" role="checkbox" aria-checked={on} className="fb-chip" onClick={() => setChips((c) => (on ? c.filter((x) => x !== s.id) : [...c, s.id]))}>
                      {on && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
                      {s.name}
                    </button>
                  )
                })}
                <button type="button" role="checkbox" aria-checked={otherOn} className="fb-chip" data-testid="fb-other" onClick={() => setOtherOn((o) => !o)}>
                  {otherOn && <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
                  {OTHER_SOLUTION_LABEL}
                </button>
              </div>
              {otherOn && (
                <input
                  className="fb-other mt-3"
                  data-testid="fb-other-text"
                  aria-label="Name of the solution"
                  placeholder="Name of the solution"
                  maxLength={LIMITS.project.max}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  value={otherText}
                  onChange={(e) => setOtherText(e.target.value)}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Question>

      <Question n={3} text={FEEDBACK_COPY.q3} phone={phone}>
        <div className="flex justify-center gap-2" role="radiogroup" aria-label={FEEDBACK_COPY.q3} onKeyDown={radioKeys(5, q3 - 1, (i) => setQ3(i + 1))}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={q3 === n}
              aria-label={`${n} – ${UNDERSTANDING_LABELS[n]}`}
              tabIndex={q3 === n || (q3 === 0 && n === 1) ? 0 : -1}
              className="fb-star"
              data-on={n <= q3}
              data-pop={pop === n}
              onClick={() => {
                setQ3(n)
                setPop(n)
              }}
            >
              <Star />
            </button>
          ))}
        </div>
        <p className="mt-1 min-h-[1.4em] text-center font-extrabold text-nc-blue">{q3 ? UNDERSTANDING_LABELS[q3] : ''}</p>
      </Question>

      <div className={phone ? 'sticky bottom-0 -mx-4 bg-gradient-to-t from-surface via-surface to-surface/0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-6' : 'sticky bottom-0 bg-surface pt-1'}>
        <button type="button" className="fb-submit" data-ready={ready} aria-disabled={!ready} aria-busy={sending} disabled={sending} onClick={send} data-testid="feedback-submit">
          {sending ? <span className="fb-spinner" aria-label="Sending" /> : <span aria-hidden="true">🏆</span>}
          {FEEDBACK_COPY.submit}
        </button>
      </div>
    </div>
  )
}
