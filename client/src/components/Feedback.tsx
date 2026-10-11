import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'
import { FEEDBACK_COPY, optionLabel, QUIZ, quizScore, type QuizAnswers, type QuizQuestion } from '@shared/feedback'
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

/** Radio-group keyboard support: arrows move focus between the options. */
function radioKeys(count: number) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const items = [...e.currentTarget.children] as HTMLElement[]
    const i = items.indexOf(document.activeElement as HTMLElement)
    items[(Math.max(0, i) + step + count) % count]?.focus()
  }
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

/** Four options; the first tap is the answer, then the right one is shown. */
function Options({ q, value, onPick }: { q: QuizQuestion; value: string | null; onPick: (id: string) => void }) {
  const answered = value !== null
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={q.text} onKeyDown={radioKeys(q.options.length)}>
        {q.options.map((o, i) => {
          const picked = value === o.id
          const result = !answered ? undefined : o.id === q.correct ? 'correct' : picked ? 'wrong' : 'dim'
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={picked}
              aria-disabled={answered}
              tabIndex={picked || (!answered && i === 0) ? 0 : -1}
              className="fb-choice"
              data-result={result}
              data-testid={`quiz-${q.id}-${o.id}`}
              onClick={() => !answered && onPick(o.id)}
            >
              {result === 'correct' && <Check className="size-[1.1em] shrink-0" strokeWidth={3} aria-hidden="true" />}
              {result === 'wrong' && <X className="size-[1.1em] shrink-0" strokeWidth={3} aria-hidden="true" />}
              {o.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 min-h-[1.4em] text-center font-extrabold" aria-live="polite">
        {answered &&
          (value === q.correct ? (
            <span className="text-nc-green">✅ {FEEDBACK_COPY.correct}</span>
          ) : (
            <span className="text-nc-red">
              {FEEDBACK_COPY.wrong} {optionLabel(q, q.correct)}.
            </span>
          ))}
      </p>
    </>
  )
}

/** The three-question quiz between the reveal and the result card. */
export function FeedbackForm({ seat, who, phone = false, onDone }: Props) {
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({})
  const [sending, setSending] = useState(false)
  const feedbackId = useRef(uuid())
  const ready = QUIZ.every((q) => answers[q.id])

  const send = async () => {
    if (!ready || sending) return
    setSending(true)
    // Stored on the device first: even offline the player sees the result straight away.
    void submitFeedback({ feedback_id: feedbackId.current, run_id: seat.run_id, token: seat.token, q1_answer: answers.q1!, q2_answer: answers.q2!, q3_answer: answers.q3! })
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

      {QUIZ.map((q, i) => (
        <Question key={q.id} n={i + 1} text={q.text} phone={phone}>
          <Options q={q} value={answers[q.id] ?? null} onPick={(id) => setAnswers((a) => ({ ...a, [q.id]: id }))} />
        </Question>
      ))}

      <div className={phone ? 'sticky bottom-0 -mx-4 bg-gradient-to-t from-surface via-surface to-surface/0 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-6' : 'sticky bottom-0 bg-surface pt-1'}>
        {ready && (
          <p className="mb-2 text-center font-extrabold text-nc-blue" data-testid="quiz-score">
            You got {quizScore(answers)} of {QUIZ.length} right!
          </p>
        )}
        <button type="button" className="fb-submit" data-ready={ready} aria-disabled={!ready} aria-busy={sending} disabled={sending} onClick={send} data-testid="feedback-submit">
          {sending ? <span className="fb-spinner" aria-label="Sending" /> : <span aria-hidden="true">🏆</span>}
          {FEEDBACK_COPY.submit}
        </button>
      </div>
    </div>
  )
}
