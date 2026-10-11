import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { gunzipSync } from 'fflate'
import { groupProjects, projectKey } from '@shared/affiliation'
import { EXPORT_TABLES, type ExportTable } from '@shared/dashboard'
import { buildPuzzles } from '@shared/puzzle'
import { uuid } from '@shared/random'
import { klDayKey } from '@shared/time'
import type { GameMode } from '@shared/types'
import { affiliationOf, cleanText, nameKey } from '@shared/validation'
import { Store } from '../db/store'
import { dashboard, feedbackDashboard, filteredRuns, parseDay, parseFeedbackFilter, type DashFilter } from '../services/analytics'
import { backupNow, dailyBackupIfDue } from '../services/backups'
import { getBoards, loadIdentity } from '../services/boards'
import { checkSettings, checkSolutions } from '../services/content'
import { httpError } from '../services/errors'
import { exportSheet, feedbackSheet, toCsv, toXlsx } from '../services/exports'
import type { Services } from '../services'

const bearer = (req: FastifyRequest) => {
  const h = req.headers.authorization
  return h?.startsWith('Bearer ') ? h.slice(7) : undefined
}

const MODES = ['solo', 'battle', 'h2h'] as const
const dashFilter = (q: Record<string, string | undefined>, now: number, defaultDay = 'today'): DashFilter => ({
  day: parseDay(q.day ?? defaultDay, now),
  mode: (MODES as readonly string[]).includes(q.mode ?? '') ? (q.mode as GameMode) : 'all',
})

function download(reply: FastifyReply, name: string, type: string, body: string | Uint8Array) {
  reply.header('Content-Type', type)
  reply.header('Content-Disposition', `attachment; filename="${name}"`)
  reply.header('Cache-Control', 'no-store')
  return reply.send(typeof body === 'string' ? body : Buffer.from(body))
}

export function registerAdminRoutes(app: FastifyInstance, svc: Services) {
  const { store, engine, auth } = svc
  const now = () => svc.clock()

  /** Every Admin route below needs a signed-in Admin who has set their own PIN. */
  const admin = async (req: FastifyRequest) => auth.check(bearer(req))

  // ── Sign-in ─────────────────────────────────────────────────────────────

  app.post('/api/admin/login', async (req) => {
    const { pin } = z.object({ pin: z.string().max(20) }).parse(req.body)
    return auth.login(pin)
  })

  app.post('/api/admin/logout', async (req) => {
    await auth.logout(bearer(req))
    return { ok: true }
  })

  app.get('/api/admin/me', async (req) => {
    const me = await auth.check(bearer(req), true)
    return { ok: true, must_change_pin: me.must_change_pin, version: svc.appVersion }
  })

  app.post('/api/admin/pin', async (req) => {
    const { current, next } = z.object({ current: z.string().max(20), next: z.string().max(20) }).parse(req.body)
    await auth.changePin(bearer(req), current, next)
    return { ok: true }
  })

  // ── Content ─────────────────────────────────────────────────────────────

  app.get('/api/admin/settings', async (req) => {
    await admin(req)
    return store.getSettings()
  })

  app.put('/api/admin/settings', async (req) => {
    await admin(req)
    const current = await store.getSettings()
    const patch = checkSettings(req.body, current)
    await store.setSettings(patch)
    await store.audit('settings_saved', { changed: Object.keys(patch) })
    if (patch.rehearsal_mode !== undefined && patch.rehearsal_mode !== current.rehearsal_mode) {
      await store.audit(patch.rehearsal_mode ? 'rehearsal_on' : 'rehearsal_off')
    }
    return store.getSettings()
  })

  app.get('/api/admin/solutions', async (req) => {
    await admin(req)
    return store.listSolutions()
  })

  app.put('/api/admin/solutions', async (req) => {
    await admin(req)
    const list = checkSolutions(req.body, await store.listSolutions())
    await store.db.transaction(async (tx) => {
      const s = new Store(tx)
      for (const sol of list) await s.upsertSolution(sol)
    })
    await store.audit('solutions_saved', { names: list.map((s) => s.name) })
    return store.listSolutions()
  })

  app.get('/api/admin/preview', async (req) => {
    await admin(req)
    const hard = (req.query as { hard?: string }).hard === '1'
    const [settings, solutions] = await Promise.all([store.getSettings(), store.listSolutions()])
    return buildPuzzles(
      solutions,
      { hard_mode: hard, hard_max_letters: settings.hard_max_letters, decoys_min: settings.decoys_min, decoys_max: settings.decoys_max, global_decoys: settings.global_decoys },
      uuid(),
    )
  })

  // ── Results & players ───────────────────────────────────────────────────

  app.get('/api/admin/runs', async (req) => {
    await admin(req)
    const q = req.query as Record<string, string | undefined>
    const f = dashFilter(q, now())
    const id = await loadIdentity(store)
    const search = nameKey(q.q ?? '')
    const runs = await filteredRuns(store, f, { includeTest: q.test === '1', includeRemoved: true })
    return [...runs]
      .reverse()
      .map((r) => {
        const typed = affiliationOf(r)
        return {
          id: r.id,
          race_id: r.race_id,
          ended_at: new Date(r.ended_at).toISOString(),
          mode: r.mode,
          name: r.full_name,
          affiliation_type: r.affiliation_type,
          affiliation: typed,
          affiliation_group: id.affiliation(r),
          solved: r.solved,
          total: r.total,
          time_ms: r.time_ms,
          penalty_ms: r.penalty_ms,
          wrong: r.wrong,
          skips: r.skips,
          status: r.status,
          place: r.place,
          is_winner: r.is_winner,
          is_test: r.is_test,
          removed_at: r.removed_at ? new Date(r.removed_at).toISOString() : null,
          removed_reason: r.removed_reason,
        }
      })
      .filter((r) => !search || nameKey(`${r.name} ${r.affiliation} ${r.affiliation_group}`).includes(search))
  })

  app.post('/api/admin/runs/:id/remove', async (req) => {
    await admin(req)
    const { id } = z.object({ id: z.uuid() }).parse(req.params)
    const { reason } = z.object({ reason: z.string().max(200) }).parse(req.body)
    const why = cleanText(reason)
    if (why.length < 3) throw httpError(400, 'reason_required', 'Give a reason (at least 3 characters).')
    if (!(await store.setRunRemoved(id, why))) throw httpError(404, 'not_found', 'Game not found.')
    await store.audit('run_removed', { run_id: id, reason: why })
    return { ok: true }
  })

  app.post('/api/admin/runs/:id/restore', async (req) => {
    await admin(req)
    const { id } = z.object({ id: z.uuid() }).parse(req.params)
    if (!(await store.setRunRemoved(id, null))) throw httpError(404, 'not_found', 'Game not found.')
    await store.audit('run_restored', { run_id: id })
    return { ok: true }
  })

  app.post('/api/admin/runs/:id/test', async (req) => {
    await admin(req)
    const { id } = z.object({ id: z.uuid() }).parse(req.params)
    const { is_test } = z.object({ is_test: z.boolean() }).parse(req.body)
    if (!(await store.setRunTest(id, is_test))) throw httpError(404, 'not_found', 'Game not found.')
    await store.audit(is_test ? 'run_marked_test' : 'run_unmarked_test', { run_id: id })
    return { ok: true }
  })

  app.get('/api/admin/participants', async (req) => {
    await admin(req)
    const q = req.query as Record<string, string | undefined>
    const f = dashFilter(q, now())
    const id = await loadIdentity(store)
    const search = nameKey(q.q ?? '')
    const runs = await filteredRuns(store, f, { includeTest: q.test === '1' })
    const by = new Map<string, { key: string; name: string; affiliation_type: string; affiliation: string; games: number; best_solved: number; best_time_ms: number | null; wins: number; last: number }>()
    for (const r of runs) {
      const k = id.key(r)
      const cur = by.get(k) ?? { key: k, name: r.full_name, affiliation_type: r.affiliation_type, affiliation: id.affiliation(r), games: 0, best_solved: -1, best_time_ms: null, wins: 0, last: 0 }
      cur.games++
      if (r.solved > cur.best_solved || (r.solved === cur.best_solved && (cur.best_time_ms === null || r.time_ms < cur.best_time_ms))) {
        cur.best_solved = r.solved
        cur.best_time_ms = r.time_ms
      }
      if (r.is_winner) cur.wins++
      if (r.ended_at > cur.last) {
        cur.last = r.ended_at
        cur.name = r.full_name
      }
      by.set(k, cur)
    }
    return [...by.values()]
      .sort((a, b) => b.last - a.last)
      .map(({ last, ...p }) => ({ ...p, last_played: new Date(last).toISOString() }))
      .filter((p) => !search || nameKey(`${p.name} ${p.affiliation}`).includes(search))
  })

  // ── Boards ──────────────────────────────────────────────────────────────

  app.get('/api/admin/boards', async (req) => {
    await admin(req)
    return getBoards(store, now(), 100_000)
  })

  app.post('/api/admin/boards/reset-daily', async (req) => {
    await admin(req)
    await store.setSettings({ board_reset_at: new Date(now()).toISOString() })
    await store.audit('daily_board_reset')
    return { ok: true }
  })

  // ── Live races ──────────────────────────────────────────────────────────

  app.get('/api/admin/live', async (req) => {
    await admin(req)
    return (await engine.liveStates()).filter((r) => r.status !== 'finished')
  })

  app.post('/api/admin/races/:id/stop', async (req) => {
    await admin(req)
    const { id } = z.object({ id: z.uuid() }).parse(req.params)
    await engine.adminStop(id)
    await store.audit('race_stopped', { race_id: id })
    return { ok: true }
  })

  // ── Project names ───────────────────────────────────────────────────────

  app.get('/api/admin/projects', async (req) => {
    await admin(req)
    const [aliases, labels, entries] = await Promise.all([store.projectAliases(), store.projectLabels(), store.projectEntries()])
    return { groups: groupProjects(entries, aliases, labels), labels: Object.fromEntries(labels) }
  })

  app.post('/api/admin/projects/merge', async (req) => {
    await admin(req)
    const body = z.object({ keys: z.array(z.string().max(200)).min(2).max(50), target: z.string().max(200), label: z.string().max(80).nullable().optional() }).parse(req.body)
    const target = projectKey(body.target)
    const keys = body.keys.map(projectKey).filter(Boolean)
    if (!keys.includes(target)) throw httpError(400, 'invalid_merge', 'Merge into one of the ticked groups.')
    for (const k of keys) if (k !== target) await store.setProjectAlias(k, target)
    const label = cleanText(body.label ?? '')
    if (label) await store.setProjectLabel(target, label)
    await store.audit('projects_merged', { keys, target, label: label || null })
    if (label) await store.audit('project_renamed', { key: target, label })
    return { ok: true }
  })

  app.post('/api/admin/projects/unmerge', async (req) => {
    await admin(req)
    const { key } = z.object({ key: z.string().max(200) }).parse(req.body)
    if (!(await store.deleteProjectAlias(projectKey(key)))) throw httpError(404, 'not_found', 'That spelling is not merged.')
    await store.audit('project_unmerged', { key: projectKey(key) })
    return { ok: true }
  })

  app.post('/api/admin/projects/label', async (req) => {
    await admin(req)
    const { key, label } = z.object({ key: z.string().max(200), label: z.string().max(80).nullable() }).parse(req.body)
    const clean = label === null ? null : cleanText(label) || null
    await store.setProjectLabel(projectKey(key), clean)
    await store.audit('project_renamed', { key: projectKey(key), label: clean })
    return { ok: true }
  })

  // ── Insights ────────────────────────────────────────────────────────────

  app.get('/api/admin/dashboard', async (req) => {
    await admin(req)
    // The daily automatic backup runs when someone opens Admin (and from the daily cron).
    await dailyBackupIfDue(store, now()).catch((err) => req.log.error(err))
    return dashboard(store, dashFilter(req.query as Record<string, string | undefined>, now()))
  })

  app.get('/api/admin/feedback', async (req) => {
    await admin(req)
    return feedbackDashboard(store, parseFeedbackFilter(req.query as Record<string, string | undefined>))
  })

  app.get('/api/admin/feedback/export.csv', async (req, reply) => {
    await admin(req)
    const sheet = await feedbackSheet(store, parseFeedbackFilter(req.query as Record<string, string | undefined>))
    await store.audit('export', { table: 'feedback', format: 'csv' })
    return download(reply, `feedback_${klDayKey(now())}.csv`, 'text/csv; charset=utf-8', toCsv(sheet))
  })

  app.get('/api/admin/feedback/export.xlsx', async (req, reply) => {
    await admin(req)
    const sheet = await feedbackSheet(store, parseFeedbackFilter(req.query as Record<string, string | undefined>))
    await store.audit('export', { table: 'feedback', format: 'xlsx' })
    return download(reply, `feedback_${klDayKey(now())}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', toXlsx([sheet]))
  })

  app.get('/api/admin/export.csv', async (req, reply) => {
    await admin(req)
    const q = req.query as Record<string, string | undefined>
    const table = (EXPORT_TABLES as readonly string[]).includes(q.table ?? '') ? (q.table as ExportTable) : null
    if (!table) throw httpError(400, 'invalid_table', 'Unknown table.')
    const sheet = await exportSheet(store, table, dashFilter(q, now(), 'all'))
    await store.audit('export', { table, format: 'csv' })
    return download(reply, `${table}_${klDayKey(now())}.csv`, 'text/csv; charset=utf-8', toCsv(sheet))
  })

  app.get('/api/admin/export.xlsx', async (req, reply) => {
    await admin(req)
    const f = dashFilter(req.query as Record<string, string | undefined>, now(), 'all')
    const sheets = []
    for (const t of EXPORT_TABLES) sheets.push(await exportSheet(store, t, f))
    await store.audit('export', { table: 'all', format: 'xlsx' })
    return download(reply, `word-rush-report_${klDayKey(now())}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', toXlsx(sheets))
  })

  // ── Data ────────────────────────────────────────────────────────────────

  app.post('/api/admin/test-data/delete', async (req) => {
    await admin(req)
    const { pin } = z.object({ pin: z.string().max(20) }).parse(req.body)
    if (!(await auth.confirmPin(pin))) throw httpError(400, 'wrong_pin', 'The Admin PIN is not right.')
    await backupNow(store, 'before-test-data-delete', now())
    const res = await store.deleteTestData()
    await store.audit('test_data_deleted', res)
    return { ok: true, ...res }
  })

  app.get('/api/admin/backups', async (req) => {
    await admin(req)
    return store.listBackups()
  })

  app.post('/api/admin/backups', async (req) => {
    await admin(req)
    const name = await backupNow(store, 'manual', now())
    return { ok: true, name }
  })

  app.get('/api/admin/backups/:name', async (req, reply) => {
    await admin(req)
    const { name } = z.object({ name: z.string().max(200) }).parse(req.params)
    const data = await store.getBackup(name)
    if (!data) throw httpError(404, 'not_found', 'Backup not found.')
    // Served as plain JSON, so it opens anywhere.
    return download(reply, name.replace(/\.gz$/, ''), 'application/json; charset=utf-8', gunzipSync(data))
  })

  app.get('/api/admin/audit', async (req) => {
    await admin(req)
    return store.recentAudit(300)
  })

  /** Vercel Cron (once a day): the automatic backup, and stale races settled. */
  app.get('/api/cron/daily', async (req) => {
    const secret = process.env.CRON_SECRET
    if (secret && req.headers.authorization !== `Bearer ${secret}`) throw httpError(401, 'unauthorized', 'Not allowed.')
    await engine.sweep()
    const name = await dailyBackupIfDue(store, now())
    return { ok: true, backup: name }
  })
}
