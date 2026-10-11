import type { GameMode } from './types'

/** Admin dashboard payload (GET /api/admin/dashboard). */
export interface DashboardData {
  filter: { day: string | null; mode: GameMode | 'all' }
  /** KL days that have games (newest first) for the date filter. */
  days: string[]
  kpis: {
    players: number
    games: number
    /** Games where all solutions were built. */
    completed: number
    completion_rate: number | null
    /** Average finishing time of completed games. */
    avg_finish_ms: number | null
    fastest_ms: number | null
    avg_solved: number | null
    battles: number
    /** Feedback answers (real games only). */
    feedback: number
    /** Average right quiz answers (0–3). */
    avg_quiz_score: number | null
    /** Rehearsal games in the same period (not counted anywhere else). */
    rehearsal_games: number
  }
  timeline_unit: 'hour' | 'day'
  timeline: { label: string; games: number; players: number }[]
  solved_distribution: { solved: number; games: number }[]
  solutions: {
    id: string
    name: string
    /** Games in which this solution appeared. */
    rounds: number
    solved: number
    solve_rate: number | null
    wrong: number
    avg_wrong: number | null
    skips: number
  }[]
  /** Project vs Business: players and games. */
  affiliation_split: Record<'project' | 'business' | 'contractor', { players: number; games: number }>
  /** Players per OPU (every OPU in the Admin list, in list order, plus any no longer listed). */
  opus: { name: string; players: number; games: number; best_time_ms: number | null }[]
  /** Players per project (spellings grouped, Admin merges applied). */
  projects: { key: string; label: string; players: number; games: number; best_time_ms: number | null }[]
  modes: { mode: GameMode; games: number }[]
  /** Right answers per quiz question. */
  quiz: { id: string; short: string; answered: number; correct: number }[]
}

export const EXPORT_TABLES = ['games', 'participants', 'feedback', 'projects', 'opus', 'solutions'] as const
export type ExportTable = (typeof EXPORT_TABLES)[number]
