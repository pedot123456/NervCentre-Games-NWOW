import { gzipSync, strToU8 } from 'fflate'
import { klDayKey, KL_OFFSET_MS } from '@shared/time'
import type { Store } from '../db/store'

const DAILY = 'daily'
const KEEP_DAILY = 14

/** "2026-10-10_1405" in KL time. */
function stamp(now: number): string {
  const d = new Date(now + KL_OFFSET_MS).toISOString()
  return `${d.slice(0, 10)}_${d.slice(11, 13)}${d.slice(14, 16)}${d.slice(17, 19)}`
}

/** A gzip-compressed JSON copy of every event table, kept in the database (a serverless host has no lasting disk). */
export async function backupNow(store: Store, reason: string, now: number): Promise<string> {
  const tables = await store.dumpTables()
  const json = JSON.stringify({ app: 'word-rush', made_at: new Date(now).toISOString(), reason, tables })
  const name = `word-rush_${stamp(now)}_${reason.replace(/[^a-z0-9-]+/gi, '-')}.json.gz`
  await store.insertBackup(name, reason, gzipSync(strToU8(json), { level: 9 }))
  await store.audit('backup_made', { name, reason })
  return name
}

/** The automatic daily backup (keeps the last 14). Cheap to call often: it only runs once per KL day. */
export async function dailyBackupIfDue(store: Store, now: number): Promise<string | null> {
  const last = await store.latestBackupAt(DAILY)
  if (last !== null && klDayKey(last) === klDayKey(now)) return null
  const name = await backupNow(store, DAILY, now)
  await store.pruneBackups(DAILY, KEEP_DAILY)
  return name
}
