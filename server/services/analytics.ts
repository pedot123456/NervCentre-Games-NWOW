import { opuKey } from '@shared/affiliation'
import type { DashboardData } from '@shared/dashboard'
import type { FeedbackBreakdownRow, FeedbackDashboard, FeedbackFilter, FeedbackMode, QuizResult } from '@shared/feedback'
import { feedbackModeOf, QUIZ, type QuizId } from '@shared/feedback'
import { DAY_MS, klDayKey, klDayRange, klHour } from '@shared/time'
import type { GameMode } from '@shared/types'
import { AFFILIATION_TYPES, type AffiliationType } from '@shared/validation'
import type { EndedRun, FeedbackRecord, Store } from '../db/store'
import { loadIdentity, type Identity } from './boards'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayLabel = (day: string) => {
  const [, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]}`
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const minOf = (xs: number[]) => (xs.length ? Math.min(...xs) : null)

export interface DashFilter {
  /** KL day "YYYY-MM-DD", or null for every day. */
  day: string | null
  mode: GameMode | 'all'
}

/** "today" → the KL day; "all" / empty → null. */
export function parseDay(raw: string | undefined, now: number): string | null {
  if (!raw || raw === 'all') return null
  if (raw === 'today') return klDayKey(now)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

export function rangeOf(day: string | null): { from?: number; to?: number } {
  if (!day) return {}
  const { start, end } = klDayRange(day)
  return { from: start, to: end }
}

export async function filteredRuns(store: Store, f: DashFilter, opts: { includeTest?: boolean; includeRemoved?: boolean } = {}): Promise<EndedRun[]> {
  const runs = await store.endedRuns({ ...rangeOf(f.day), ...opts })
  return f.mode === 'all' ? runs : runs.filter((r) => r.mode === f.mode)
}

const solvedAll = (r: EndedRun) => r.total > 0 && r.solved >= r.total

export async function dashboard(store: Store, f: DashFilter): Promise<DashboardData> {
  const [settings, id, solutions, everything] = await Promise.all([store.getSettings(), loadIdentity(store), store.listSolutions(), store.endedRuns({ includeTest: true })])
  const days = [...new Set(everything.filter((r) => !r.is_test && !r.removed_at).map((r) => klDayKey(r.ended_at)))].sort().reverse()
  const inRange = (r: EndedRun) => {
    if (f.mode !== 'all' && r.mode !== f.mode) return false
    if (!f.day) return true
    const { start, end } = klDayRange(f.day)
    return r.ended_at >= start && r.ended_at < end
  }
  const runs = everything.filter((r) => inRange(r) && !r.is_test && !r.removed_at)
  const rehearsal = everything.filter((r) => inRange(r) && r.is_test).length
  const feedback = (await store.listFeedback(rangeOf(f.day))).filter((x) => f.mode === 'all' || x.race_mode === f.mode)

  const completed = runs.filter(solvedAll)
  const players = new Set(runs.map((r) => id.key(r)))

  // Timeline: by hour for one day, by day otherwise.
  let timeline: DashboardData['timeline'] = []
  if (f.day) {
    // From the first to the last hour with games (an empty day has no columns).
    const hours = runs.map((r) => klHour(r.ended_at))
    const lo = hours.length ? Math.min(...hours) : 0
    const hi = hours.length ? Math.max(...hours) : -1
    for (let h = lo; h <= hi; h++) {
      const at = runs.filter((r) => klHour(r.ended_at) === h)
      timeline.push({ label: `${String(h).padStart(2, '0')}:00`, games: at.length, players: new Set(at.map((r) => id.key(r))).size })
    }
  } else if (runs.length) {
    const first = klDayRange(runs[0].ended_at).start
    const last = klDayRange(runs[runs.length - 1].ended_at).start
    for (let t = first; t <= last; t += DAY_MS) {
      const key = klDayKey(t)
      const at = runs.filter((r) => klDayKey(r.ended_at) === key)
      timeline.push({ label: dayLabel(key), games: at.length, players: new Set(at.map((r) => id.key(r))).size })
    }
  }

  const maxSolved = Math.max(6, ...runs.map((r) => r.total))
  const solved_distribution = Array.from({ length: maxSolved + 1 }, (_, n) => ({ solved: n, games: runs.filter((r) => r.solved === n).length }))

  const solutionStats = solutions.map((s) => {
    let rounds = 0
    let solved = 0
    let wrong = 0
    let skips = 0
    for (const r of runs) {
      const i = r.puzzle_ids.indexOf(s.id)
      if (i < 0) continue
      rounds++
      if (r.progress.solved.includes(i)) solved++
      wrong += r.progress.stats[i]?.wrong ?? 0
      skips += r.progress.stats[i]?.skips ?? 0
    }
    return { id: s.id, name: s.name, rounds, solved, solve_rate: rounds ? solved / rounds : null, wrong, avg_wrong: rounds ? wrong / rounds : null, skips }
  })

  const split = (type: AffiliationType) => {
    const of = runs.filter((r) => r.affiliation_type === type)
    return { players: new Set(of.map((r) => id.key(r))).size, games: of.length }
  }

  const opuRows = new Map<string, { name: string; players: Set<string>; games: number; best: number[] }>()
  for (const o of settings.opus) opuRows.set(opuKey(o), { name: o, players: new Set(), games: 0, best: [] })
  for (const r of runs) {
    if (r.affiliation_type !== 'business' || !r.opu) continue
    const k = opuKey(r.opu)
    const row = opuRows.get(k) ?? { name: r.opu, players: new Set(), games: 0, best: [] }
    row.players.add(id.key(r))
    row.games++
    if (solvedAll(r)) row.best.push(r.time_ms)
    opuRows.set(k, row)
  }

  const projectRows = new Map<string, { key: string; label: string; players: Set<string>; games: number; best: number[] }>()
  for (const r of runs) {
    if (r.affiliation_type !== 'project' || !r.project_name) continue
    const g = id.project(r.project_name)
    const row = projectRows.get(g.key) ?? { key: g.key, label: g.label, players: new Set(), games: 0, best: [] }
    row.players.add(id.key(r))
    row.games++
    if (solvedAll(r)) row.best.push(r.time_ms)
    projectRows.set(g.key, row)
  }

  return {
    filter: { day: f.day, mode: f.mode },
    days,
    kpis: {
      players: players.size,
      games: runs.length,
      completed: completed.length,
      completion_rate: runs.length ? completed.length / runs.length : null,
      avg_finish_ms: avg(completed.map((r) => r.time_ms)),
      fastest_ms: minOf(completed.map((r) => r.time_ms)),
      avg_solved: avg(runs.map((r) => r.solved)),
      battles: new Set(runs.filter((r) => r.mode !== 'solo').map((r) => r.race_id)).size,
      feedback: feedback.length,
      avg_quiz_score: avg(quizRows(feedback).map((x) => x.quiz_score!)),
      rehearsal_games: rehearsal,
    },
    timeline_unit: f.day ? 'hour' : 'day',
    timeline,
    solved_distribution,
    solutions: solutionStats,
    affiliation_split: { project: split('project'), business: split('business'), contractor: split('contractor') },
    opus: [...opuRows.values()].map((o) => ({ name: o.name, players: o.players.size, games: o.games, best_time_ms: minOf(o.best) })),
    projects: [...projectRows.values()]
      .map((p) => ({ key: p.key, label: p.label, players: p.players.size, games: p.games, best_time_ms: minOf(p.best) }))
      .sort((a, b) => b.players - a.players || b.games - a.games || a.label.localeCompare(b.label)),
    modes: (['solo', 'battle', 'h2h'] as GameMode[]).map((mode) => ({ mode, games: runs.filter((r) => r.mode === mode).length })),
    quiz: quizResults(quizRows(feedback)).map((q) => ({ id: q.id, short: q.short, answered: q.answered, correct: q.correct })),
  }
}



// ── Feedback section ────────────────────────────────────────────────────────

export function parseFeedbackFilter(q: Record<string, string | undefined>): FeedbackFilter {
  const day = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const opu = q.opu?.trim() || null
  const affiliation = opu ? 'business' : (AFFILIATION_TYPES.find((t) => t === q.affiliation) ?? 'all')
  return {
    from: day(q.from),
    to: day(q.to),
    mode: q.mode === 'solo' || q.mode === 'team' ? q.mode : 'all',
    affiliation,
    opu,
  }
}

const feedbackRange = (f: FeedbackFilter) => ({
  from: f.from ? klDayRange(f.from).start : undefined,
  to: f.to ? klDayRange(f.to).end : undefined,
})

function matches(f: FeedbackFilter, x: { mode: FeedbackMode; affiliation_type: AffiliationType; opu: string | null }) {
  if (f.mode !== 'all' && x.mode !== f.mode) return false
  if (f.affiliation !== 'all' && x.affiliation_type !== f.affiliation) return false
  if (f.opu && opuKey(x.opu ?? '') !== opuKey(f.opu)) return false
  return true
}

const answerOf = (x: FeedbackRecord, id: QuizId) => ({ q1: x.q1_answer, q2: x.q2_answer, q3: x.q3_answer })[id]

/** Answers given to the quiz (answers to the earlier questions have no quiz score). */
const quizRows = (rows: FeedbackRecord[]) => rows.filter((x) => x.quiz_score !== null)

function quizResults(rows: FeedbackRecord[]): QuizResult[] {
  return QUIZ.map((q) => {
    const answered = rows.filter((x) => answerOf(x, q.id) !== null)
    return {
      id: q.id,
      short: q.short,
      text: q.text,
      correct_option: q.options.find((o) => o.id === q.correct)!.label,
      answered: answered.length,
      correct: answered.filter((x) => answerOf(x, q.id) === q.correct).length,
      options: q.options.map((o) => ({ id: o.id, label: o.label, count: answered.filter((x) => answerOf(x, q.id) === o.id).length, correct: o.id === q.correct })),
    }
  })
}

/** Feedback answers for the filters (rehearsal answers left out unless asked). */
export async function feedbackRows(store: Store, f: FeedbackFilter, includeTest = false): Promise<FeedbackRecord[]> {
  const rows = await store.listFeedback({ ...feedbackRange(f), includeTest })
  return rows.filter((x) => matches(f, { mode: x.game_mode, affiliation_type: x.affiliation_type, opu: x.opu }))
}

function breakdown(rows: FeedbackRecord[], keyOf: (x: FeedbackRecord) => { key: string; label: string } | null): FeedbackBreakdownRow[] {
  const by = new Map<string, { label: string; rows: FeedbackRecord[] }>()
  for (const x of rows) {
    const k = keyOf(x)
    if (!k) continue
    const cur = by.get(k.key) ?? { label: k.label, rows: [] }
    cur.rows.push(x)
    by.set(k.key, cur)
  }
  return [...by.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      responses: v.rows.length,
      avg_score: avg(quizRows(v.rows).map((x) => x.quiz_score!)),
      correct: Object.fromEntries(QUIZ.map((q) => [q.id, v.rows.filter((x) => answerOf(x, q.id) === q.correct).length])) as Record<QuizId, number>,
    }))
    .sort((a, b) => b.responses - a.responses || a.label.localeCompare(b.label))
}

export async function feedbackDashboard(store: Store, f: FeedbackFilter): Promise<FeedbackDashboard> {
  const [settings, id] = await Promise.all([store.getSettings(), loadIdentity(store)])
  const all = await feedbackRows(store, f, true)
  const rows = all.filter((x) => !x.is_test)
  const runs = (await store.endedRuns(feedbackRange(f))).filter((r) => matches(f, { mode: feedbackModeOf(r.mode), affiliation_type: r.affiliation_type, opu: r.opu }))
  const opus = [...settings.opus]
  for (const x of rows) if (x.opu && !opus.some((o) => opuKey(o) === opuKey(x.opu!))) opus.push(x.opu)
  return {
    filter: f,
    opus,
    rehearsal_responses: all.length - rows.length,
    responses: rows.length,
    completed_games: runs.length,
    response_rate: runs.length ? rows.length / runs.length : null,
    avg_score: avg(quizRows(rows).map((x) => x.quiz_score!)),
    score_distribution: [0, 1, 2, 3].map((score) => ({ score, count: rows.filter((x) => x.quiz_score === score).length })),
    questions: quizResults(quizRows(rows)),
    by_opu: breakdown(rows, (x) => (x.affiliation_type === 'business' && x.opu ? { key: opuKey(x.opu), label: x.opu } : null)),
    by_project: breakdown(rows, (x) => (x.affiliation_type === 'project' && x.project_name ? id.project(x.project_name) : null)),
  }
}

export type { Identity }
