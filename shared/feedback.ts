import type { GameMode } from './types'
import type { AffiliationType } from './validation'

/**
 * Booth quiz: three one-tap multiple-choice questions between the end of a game and the result card.
 * Each answer shows straight away whether it was right. Asked once per player per KL day
 * (player = normalised full name + project name, OPU or company, as on the boards); a replay the
 * same day goes straight to the result card.
 */

export type FeedbackMode = 'solo' | 'team'

/** Solo Rush → solo; Multiplayer Battle and Head-to-Head → team (each player answers for themselves). */
export const feedbackModeOf = (mode: GameMode): FeedbackMode => (mode === 'solo' ? 'solo' : 'team')

export const FEEDBACK_MODE_LABELS: Record<FeedbackMode, string> = {
  solo: 'Solo',
  team: 'Team',
}

export const FEEDBACK_COPY = {
  heading: '🎉 Great game! Your score is ready.',
  intro: 'Answer 3 quick questions to see your result.',
  correct: 'Correct!',
  wrong: 'Not quite – the answer is',
  submit: 'See My Result',
} as const

export type QuizId = 'q1' | 'q2' | 'q3'

export interface QuizQuestion {
  id: QuizId
  /** Short name for Admin charts and exports. */
  short: string
  text: string
  options: readonly { id: string; label: string }[]
  /** Option id of the right answer. */
  correct: string
}

export const QUIZ: readonly QuizQuestion[] = [
  {
    id: 'q1',
    short: 'Featured solution',
    text: 'Which of the following is one of the featured solutions?',
    options: [
      { id: 'orion', label: 'ORION' },
      { id: 'myicons', label: 'MYICONS' },
      { id: 'pcc', label: 'PCC' },
      { id: 'all', label: 'All of the above' },
    ],
    correct: 'all',
  },
  {
    id: 'q2',
    short: 'Project delivery domains',
    text: 'How many key project delivery domains or areas are presented?',
    options: [
      { id: '4', label: '4' },
      { id: '3', label: '3' },
      { id: '5', label: '5' },
      { id: '1', label: '1' },
    ],
    correct: '5',
  },
  {
    id: 'q3',
    short: 'Project Management Solutions',
    text: 'How many Project Management Solutions are featured?',
    options: [
      { id: '25', label: '25' },
      { id: '29', label: '29' },
      { id: '32', label: '32' },
      { id: '35', label: '35' },
    ],
    correct: '32',
  },
]

export type QuizAnswers = Record<QuizId, string>

export const isQuizOption = (q: QuizQuestion, answer: unknown): answer is string => q.options.some((o) => o.id === answer)

/** Number of right answers (0–3). */
export const quizScore = (a: Partial<Record<QuizId, string | null>>): number => QUIZ.filter((q) => a[q.id] === q.correct).length

/** Option label for an answer id ("all" → "All of the above"). */
export const optionLabel = (q: QuizQuestion, answer: string | null): string => q.options.find((o) => o.id === answer)?.label ?? ''

/** POST /api/feedback. `feedback_id` is made on the device, so a retry after a dropped connection is never counted twice. */
export interface FeedbackSubmission {
  feedback_id: string
  run_id: string
  token: string
  /** Option ids picked for the three questions. */
  q1_answer: string
  q2_answer: string
  q3_answer: string
  /** When "See My Result" was tapped, on the server clock as the device knew it (an offline answer syncs later). */
  answered_at: number
}

export interface FeedbackSaved {
  ok: true
  /** duplicate = this exact answer had already arrived (a retry). */
  status: 'saved' | 'duplicate'
}

/** GET /api/runs/:id/feedback – answers only once the game's score is in the database. */
export interface FeedbackStatus {
  score_saved: true
  /** False when this player already answered today: go straight to the result card. */
  required: boolean
  /** KL day "YYYY-MM-DD". */
  day: string
}

// ── Admin: Feedback section ─────────────────────────────────────────────────

export interface FeedbackFilter {
  /** KL days "YYYY-MM-DD", both inclusive; null = open-ended. */
  from: string | null
  to: string | null
  mode: FeedbackMode | 'all'
  affiliation: AffiliationType | 'all'
  /** One OPU (Business answers only); null = every OPU. */
  opu: string | null
}

export interface FeedbackBreakdownRow {
  key: string
  label: string
  responses: number
  /** Average right answers (0–3). */
  avg_score: number | null
  /** Right answers per question. */
  correct: Record<QuizId, number>
}

/** Results of one quiz question. */
export interface QuizResult {
  id: QuizId
  short: string
  text: string
  correct_option: string
  answered: number
  correct: number
  /** How many picked each option (in the order shown to players). */
  options: { id: string; label: string; count: number; correct: boolean }[]
}

export interface FeedbackDashboard {
  filter: FeedbackFilter
  /** OPU choices for the filter: the Admin list plus any OPU found in answers. */
  opus: string[]
  /** Rehearsal answers for the same filters (left out of everything else). */
  rehearsal_responses: number
  responses: number
  /** Games played to the end (all solved or out of time) for the same filters. */
  completed_games: number
  /** responses ÷ completed_games */
  response_rate: number | null
  /** Average right answers (0–3). */
  avg_score: number | null
  /** Players by number of right answers 0–3. */
  score_distribution: { score: number; count: number }[]
  questions: QuizResult[]
  /** Business answers per OPU (most answers first). */
  by_opu: FeedbackBreakdownRow[]
  /** Project answers per project name (spellings grouped, Admin merges applied). */
  by_project: FeedbackBreakdownRow[]
}
