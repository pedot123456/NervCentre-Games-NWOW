import { resolveAffiliationKey } from '@shared/affiliation'
import { feedbackModeOf, isQuizOption, QUIZ, quizScore, type FeedbackSaved, type FeedbackStatus, type FeedbackSubmission } from '@shared/feedback'
import { titleFor } from '@shared/game'
import { klDayKey } from '@shared/time'
import type { RunResult } from '@shared/types'
import { affiliationOf } from '@shared/validation'
import { Store, type RunRecord } from '../db/store'
import { hashToken } from '../game/engine'
import { getBoards, loadIdentity } from './boards'
import { httpError } from './errors'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ended = (r: RunRecord) => (r.status === 'finished' || r.status === 'timeout') && r.ended_at !== null

/** The run, only for the device holding its token. */
async function ownRun(store: Store, runId: string, token: string | undefined): Promise<RunRecord> {
  const run = UUID.test(runId) ? await store.getRun(runId) : null
  if (!run || !token || run.token_hash !== hashToken(token)) throw httpError(404, 'not_found', 'Game not found.')
  return run
}

/** Has this player (full name + project group / OPU, as on the boards) answered on this KL day? */
async function answeredOn(store: Store, run: RunRecord, day: string): Promise<boolean> {
  const player = await store.getPlayer(run.player_id)
  if (!player) return false
  const aliases = await store.projectAliases()
  const mine = resolveAffiliationKey(player.affil_key, aliases)
  const keys = await store.feedbackAffiliationsOn(player.name_key, day, run.is_test)
  return keys.some((k) => resolveAffiliationKey(k, aliases) === mine)
}

/** The result card for a finished run. */
export async function runResult(store: Store, runId: string, token: string | undefined, now: number): Promise<RunResult> {
  const run = await ownRun(store, runId, token)
  if (!ended(run)) throw httpError(409, 'not_ended', 'This game has not ended yet.')
  const race = (await store.getRace(run.race_id))!
  const solutions = await store.listSolutions()
  const total = race.puzzles.length
  let rankToday: number | null = null
  let playersToday = 0
  const boards = await getBoards(store, now, 100_000)
  playersToday = boards.stats.players_today
  if (!run.is_test && !run.removed_at) {
    const player = await store.getPlayer(run.player_id)
    if (player) {
      const id = await loadIdentity(store)
      const key = id.key(player)
      rankToday = boards.today.find((b) => b.player_key === key)?.rank ?? null
    }
  }
  const feedbackGiven = (await store.hasFeedback(run.id)) || (await answeredOn(store, run, klDayKey(now)))
  return {
    run_id: run.id,
    race_id: race.id,
    mode: race.mode,
    name: run.full_name,
    affiliation_type: run.affiliation_type,
    affiliation: affiliationOf(run),
    solved: run.solved,
    total,
    time_ms: run.time_ms ?? race.rules.limit_ms,
    finished: run.status === 'finished',
    penalty_ms: run.penalty_ms,
    wrong: run.wrong,
    skips: run.skips,
    title: titleFor(run.solved, total),
    rank_today: rankToday,
    players_today: playersToday,
    place: race.mode === 'solo' ? null : run.place,
    is_winner: run.is_winner,
    is_test: run.is_test,
    recap: race.puzzles.map((p, i) => ({
      solution_id: p.solution_id,
      name: p.name,
      description: solutions.find((s) => s.id === p.solution_id)?.description ?? '',
      solved: run.progress.solved.includes(i),
    })),
    feedback_given: feedbackGiven,
  }
}

/** GET /api/runs/:id/feedback – answers only once the game's score is in the database. */
export async function feedbackStatus(store: Store, runId: string, token: string | undefined, now: number): Promise<FeedbackStatus> {
  const run = await ownRun(store, runId, token)
  if (!ended(run)) throw httpError(409, 'not_ended', 'The score is not saved yet.')
  const day = klDayKey(now)
  const required = !(await store.hasFeedback(run.id)) && !(await answeredOn(store, run, day))
  return { score_saved: true, required, day }
}

/** POST /api/feedback – safe to resend with the same feedback_id (an offline answer syncing later). */
export async function submitFeedback(store: Store, f: FeedbackSubmission, now: number): Promise<FeedbackSaved> {
  if (await store.feedbackExists(f.feedback_id)) return { ok: true, status: 'duplicate' }
  const run = await ownRun(store, f.run_id, f.token)
  if (!ended(run)) throw httpError(409, 'not_ended', 'The score is not saved yet.')
  const race = (await store.getRace(run.race_id))!
  // Device clocks can be wrong: never before the game ended, never in the future.
  const at = Math.min(Math.max(f.answered_at ?? now, run.ended_at!), now)
  if ((await store.hasFeedback(run.id)) || (await answeredOn(store, run, klDayKey(at)))) {
    throw httpError(409, 'already_given', 'This player already answered today.')
  }
  const answers = { q1: f.q1_answer, q2: f.q2_answer, q3: f.q3_answer }
  for (const q of QUIZ) if (!isQuizOption(q, answers[q.id])) throw httpError(400, 'invalid_answer', 'Please answer all three questions.')
  const saved = await store.insertFeedback({
    feedback_id: f.feedback_id,
    session_id: run.id,
    player_id: run.player_id,
    team_id: race.mode === 'solo' ? null : race.id,
    full_name: run.full_name,
    affiliation_type: run.affiliation_type,
    project_name: run.project_name,
    opu: run.opu,
    q1_answer: f.q1_answer,
    q2_answer: f.q2_answer,
    q3_answer: f.q3_answer,
    quiz_score: quizScore(answers),
    game_mode: feedbackModeOf(race.mode),
    submitted_at: at,
    is_test: run.is_test,
  })
  if (!saved) {
    if (await store.feedbackExists(f.feedback_id)) return { ok: true, status: 'duplicate' }
    throw httpError(409, 'already_given', 'This player already answered today.')
  }
  return { ok: true, status: 'saved' }
}
