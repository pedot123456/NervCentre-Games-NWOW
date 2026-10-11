import { groupProjects, projectLabeler, resolveAffiliationKey } from '@shared/affiliation'
import { compareRuns } from '@shared/game'
import { klDayKey, klDayRange } from '@shared/time'
import type { BoardRow, Boards, Settings, WinsRow } from '@shared/types'
import { affiliationOf } from '@shared/validation'
import type { EndedRun, Store } from '../db/store'

/**
 * Player identity = normalised full name + project group (Admin merges applied) or OPU.
 * Display affiliation = the project group's label, the OPU, or the contractor's company name.
 */
export interface Identity {
  key: (r: Pick<EndedRun, 'name_key' | 'affil_key'>) => string
  /** "Project / OPU" column text. */
  affiliation: (r: Pick<EndedRun, 'affiliation_type' | 'project_name' | 'opu'>) => string
  /** Group key + label of a project name (for Admin). */
  project: (raw: string) => { key: string; label: string }
}

export async function loadIdentity(store: Store): Promise<Identity> {
  const [aliases, labels, entries] = await Promise.all([store.projectAliases(), store.projectLabels(), store.projectEntries(true)])
  const groups = groupProjects(entries, aliases, labels)
  const labeler = projectLabeler(groups, aliases)
  return {
    key: (r) => `${r.name_key}|${resolveAffiliationKey(r.affil_key, aliases)}`,
    affiliation: (r) => (r.affiliation_type === 'project' ? labeler(r.project_name ?? '').label : affiliationOf(r)),
    project: (raw) => labeler(raw),
  }
}

const rankable = (r: EndedRun) => ({ solved: r.solved, time_ms: r.time_ms, ended_at: r.ended_at })

/** Best run per player, ranked (more solved, then faster, then earlier). */
export function bestPerPlayer(runs: EndedRun[], id: Identity): { run: EndedRun; key: string }[] {
  const best = new Map<string, EndedRun>()
  for (const r of runs) {
    const k = id.key(r)
    const cur = best.get(k)
    if (!cur || compareRuns(rankable(r), rankable(cur)) < 0) best.set(k, r)
  }
  return [...best.entries()].map(([key, run]) => ({ key, run })).sort((a, b) => compareRuns(rankable(a.run), rankable(b.run)))
}

function boardRows(runs: EndedRun[], id: Identity, limit: number): BoardRow[] {
  return bestPerPlayer(runs, id)
    .slice(0, limit)
    .map(({ key, run }, i) => ({
      rank: i + 1,
      player_key: key,
      name: run.full_name,
      affiliation_type: run.affiliation_type,
      affiliation: id.affiliation(run),
      solved: run.solved,
      time_ms: run.time_ms,
      mode: run.mode,
      run_id: run.id,
      ended_at: new Date(run.ended_at).toISOString(),
    }))
}

/** Battle and Head-to-Head wins per player, with their best time in those games. */
function winsRows(runs: EndedRun[], id: Identity, limit: number): WinsRow[] {
  const by = new Map<string, { run: EndedRun; wins: number; battles: number; best: number | null }>()
  for (const r of runs) {
    if (r.mode === 'solo') continue
    const k = id.key(r)
    const cur = by.get(k) ?? { run: r, wins: 0, battles: 0, best: null }
    cur.battles++
    if (r.is_winner) {
      cur.wins++
      if (cur.best === null || r.time_ms < cur.best) cur.best = r.time_ms
    }
    if (r.ended_at > cur.run.ended_at) cur.run = r
    by.set(k, cur)
  }
  return [...by.entries()]
    .filter(([, v]) => v.wins > 0)
    .sort(([, a], [, b]) => b.wins - a.wins || (a.best ?? Infinity) - (b.best ?? Infinity))
    .slice(0, limit)
    .map(([key, v], i) => ({
      rank: i + 1,
      player_key: key,
      name: v.run.full_name,
      affiliation_type: v.run.affiliation_type,
      affiliation: id.affiliation(v.run),
      wins: v.wins,
      battles: v.battles,
      best_time_ms: v.best,
    }))
}

/** Start of "today" for the boards: the KL day, or the last daily reset if that was later. */
export function todayStart(settings: Settings, now: number): number {
  const { start } = klDayRange(now)
  const reset = settings.board_reset_at ? new Date(settings.board_reset_at).getTime() : 0
  return Math.max(start, reset)
}

/** Public boards (rehearsal games and removed entries never appear). */
export async function getBoards(store: Store, now: number, limit = 10): Promise<Boards> {
  const [settings, id, all] = await Promise.all([store.getSettings(), loadIdentity(store), store.endedRuns()])
  const from = todayStart(settings, now)
  const { end } = klDayRange(now)
  const today = all.filter((r) => r.ended_at >= from && r.ended_at < end)
  const todayRows = boardRows(today, id, limit)
  return {
    day: klDayKey(now),
    today: todayRows,
    all_time: boardRows(all, id, limit),
    wins_today: winsRows(today, id, limit),
    wins_all_time: winsRows(all, id, limit),
    stats: {
      players_today: new Set(today.map((r) => id.key(r))).size,
      players_total: new Set(all.map((r) => id.key(r))).size,
      games_today: today.length,
      fastest_today: todayRows[0] ?? null,
    },
  }
}
