import type { GameMode } from './types'
import { checkProjectName, type AffiliationType } from './validation'

/**
 * Booth feedback: three one-tap questions between the end of a game and the result card.
 * Asked once per player per KL day (player = normalised full name + project name or OPU, as on the
 * boards); a replay the same day goes straight to the result card.
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
  q1: 'Was the information shared at the booth relevant to your project or business needs?',
  q2: 'Would you consider adopting or exploring any of the solutions showcased?',
  q2_chips: 'Which ones? (optional – pick any)',
  q3: 'Did the booth help you better understand the available digital solutions?',
  submit: 'See My Result',
} as const

/**
 * The solutions players can pick under question 2 (independent of the game's word-tile solutions).
 * "Others" lets them type a name; it is stored as "other:<name>" in q2_interested_solutions.
 */
export const FEEDBACK_SOLUTIONS = [
  { id: 'orion', name: 'ORION' },
  { id: 'project-command-centre', name: 'Project Command Centre' },
  { id: 'myicons', name: 'MYICONS' },
  { id: 'quality-plus', name: 'Quality+' },
  { id: 'project-production-management', name: 'Project Production Management' },
] as const

export const OTHER_SOLUTION_PREFIX = 'other:'
export const OTHER_SOLUTION_LABEL = 'Others'

/** "other:Digital Twin" → "Digital Twin"; null for a listed solution id. */
export const otherSolutionName = (v: string): string | null => (v.startsWith(OTHER_SOLUTION_PREFIX) ? v.slice(OTHER_SOLUTION_PREFIX.length) : null)

/** Display name of a stored answer: the listed name, or "Others: <typed name>". */
export function solutionLabel(v: string): string {
  const other = otherSolutionName(v)
  if (other !== null) return `${OTHER_SOLUTION_LABEL}: ${other}`
  return FEEDBACK_SOLUTIONS.find((s) => s.id === v)?.name ?? v
}

/**
 * Cleans the answers to question 2: listed ids and at most one typed-in name (checked like a
 * project name, blocked words included); unknown ids and repeats are dropped.
 */
export function cleanInterest(raw: readonly string[] | null | undefined, profanity: readonly string[] = []): string[] {
  const out: string[] = []
  let other = false
  for (const v of raw ?? []) {
    const typed = otherSolutionName(v)
    if (typed !== null) {
      const c = checkProjectName(typed, profanity)
      if (c.ok && !other) {
        out.push(OTHER_SOLUTION_PREFIX + c.value)
        other = true
      }
    } else if (FEEDBACK_SOLUTIONS.some((s) => s.id === v) && !out.includes(v)) {
      out.push(v)
    }
  }
  return out
}

/** Distinct players per listed solution, then per typed-in name (grouped ignoring case), highest first. */
export function interestCounts(rows: readonly { player_id: string; q2_would_explore: boolean; q2_interested_solutions: string[] | null }[]): { id: string; name: string; players: number }[] {
  const yes = rows.filter((x) => x.q2_would_explore)
  const listed = FEEDBACK_SOLUTIONS.map((s) => ({
    id: s.id as string,
    name: s.name as string,
    players: new Set(yes.filter((x) => x.q2_interested_solutions?.includes(s.id)).map((x) => x.player_id)).size,
  }))
  const others = new Map<string, { name: string; players: Set<string> }>()
  for (const x of yes) {
    for (const v of x.q2_interested_solutions ?? []) {
      const typed = otherSolutionName(v)
      if (typed === null) continue
      const key = typed.toLowerCase()
      const o = others.get(key) ?? { name: typed, players: new Set<string>() }
      o.players.add(x.player_id)
      others.set(key, o)
    }
  }
  const typed = [...others.entries()].map(([key, o]) => ({ id: OTHER_SOLUTION_PREFIX + key, name: `${OTHER_SOLUTION_LABEL}: ${o.name}`, players: o.players.size }))
  return [...listed, ...typed].sort((a, b) => b.players - a.players)
}

/** Label under the stars for ratings 1–5. */
export const UNDERSTANDING_LABELS = ['', 'Not at all', 'A little', 'Somewhat', 'Yes', 'Very much'] as const

/** POST /api/feedback. `feedback_id` is made on the device, so a retry after a dropped connection is never counted twice. */
export interface FeedbackSubmission {
  feedback_id: string
  run_id: string
  token: string
  q1_relevant: boolean
  q2_would_explore: boolean
  /** FEEDBACK_SOLUTIONS ids and/or one "other:<name>" – only with a Yes to question 2 (optional, any number). */
  q2_interested_solutions: string[] | null
  q3_understanding_rating: number
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
  q1_yes: number
  q2_yes: number
  q3_average: number | null
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
  q1: { yes: number; no: number }
  q2: { yes: number; no: number }
  q3: { average: number | null; distribution: { rating: number; count: number }[] }
  /** Distinct players who picked each solution under question 2, highest first. */
  solutions: { id: string; name: string; players: number }[]
  /** Business answers per OPU (most answers first). */
  by_opu: FeedbackBreakdownRow[]
  /** Project answers per project name (spellings grouped, Admin merges applied). */
  by_project: FeedbackBreakdownRow[]
}
