import { strToU8, zipSync } from 'fflate'
import { groupProjects } from '@shared/affiliation'
import type { ExportTable } from '@shared/dashboard'
import { FEEDBACK_MODE_LABELS, solutionLabel, type FeedbackFilter } from '@shared/feedback'
import { formatKlDateTime, formatSeconds } from '@shared/time'
import { MODE_LABELS } from '@shared/types'
import { AFFILIATION_LABELS } from '@shared/validation'
import type { Store } from '../db/store'
import { feedbackRows, filteredRuns, type DashFilter } from './analytics'
import { loadIdentity } from './boards'

export type Cell = string | number | null | undefined
export interface Sheet {
  name: string
  rows: Cell[][]
}

const yesNo = (v: boolean | null | undefined) => (v === null || v === undefined ? '' : v ? 'Yes' : 'No')

// ── Tables ──────────────────────────────────────────────────────────────────

export async function exportSheet(store: Store, table: ExportTable, f: DashFilter): Promise<Sheet> {
  const id = await loadIdentity(store)
  if (table === 'games') {
    const runs = await filteredRuns(store, f, { includeTest: true, includeRemoved: true })
    return {
      name: 'Games',
      rows: [
        ['Ended (KL)', 'Mode', 'Full name', 'From', 'Project name (as typed)', 'Project group', 'OPU', 'Company', 'Solved', 'Total', 'Time (s)', 'Penalties (s)', 'Wrong tiles', 'Skips', 'Place', 'Winner', 'Rehearsal', 'Removed', 'Removed reason', 'Game id'],
        ...[...runs].reverse().map((r) => [
          formatKlDateTime(r.ended_at),
          MODE_LABELS[r.mode],
          r.full_name,
          AFFILIATION_LABELS[r.affiliation_type],
          r.affiliation_type === 'project' ? (r.project_name ?? '') : '',
          r.affiliation_type === 'project' ? id.project(r.project_name ?? '').label : '',
          r.opu ?? '',
          r.affiliation_type === 'contractor' ? (r.project_name ?? '') : '',
          r.solved,
          r.total,
          formatSeconds(r.time_ms),
          formatSeconds(r.penalty_ms),
          r.wrong,
          r.skips,
          r.mode === 'solo' ? '' : (r.place ?? ''),
          r.mode === 'solo' ? '' : yesNo(r.is_winner),
          yesNo(r.is_test),
          yesNo(!!r.removed_at),
          r.removed_reason ?? '',
          r.id,
        ]),
      ],
    }
  }
  if (table === 'participants') {
    const runs = await filteredRuns(store, f)
    const by = new Map<string, { r: (typeof runs)[number]; games: number; bestSolved: number; bestTime: number | null; wins: number; first: number; last: number }>()
    for (const r of runs) {
      const k = id.key(r)
      const cur = by.get(k) ?? { r, games: 0, bestSolved: -1, bestTime: null, wins: 0, first: r.ended_at, last: r.ended_at }
      cur.games++
      if (r.solved > cur.bestSolved || (r.solved === cur.bestSolved && (cur.bestTime === null || r.time_ms < cur.bestTime))) {
        cur.bestSolved = r.solved
        cur.bestTime = r.time_ms
      }
      if (r.is_winner) cur.wins++
      cur.first = Math.min(cur.first, r.ended_at)
      if (r.ended_at >= cur.last) {
        cur.last = r.ended_at
        cur.r = r
      }
      by.set(k, cur)
    }
    return {
      name: 'Participants',
      rows: [
        ['Full name', 'From', 'Project name', 'OPU', 'Company', 'Games', 'Best solved', 'Best time (s)', 'Battle wins', 'First played (KL)', 'Last played (KL)'],
        ...[...by.values()].map((p) => [
          p.r.full_name,
          AFFILIATION_LABELS[p.r.affiliation_type],
          p.r.affiliation_type === 'project' ? id.project(p.r.project_name ?? '').label : '',
          p.r.opu ?? '',
          p.r.affiliation_type === 'contractor' ? (p.r.project_name ?? '') : '',
          p.games,
          p.bestSolved,
          formatSeconds(p.bestTime),
          p.wins,
          formatKlDateTime(p.first),
          formatKlDateTime(p.last),
        ]),
      ],
    }
  }
  if (table === 'feedback') {
    const filter: FeedbackFilter = { from: f.day, to: f.day, mode: f.mode === 'all' ? 'all' : f.mode === 'solo' ? 'solo' : 'team', affiliation: 'all', opu: null }
    return feedbackSheet(store, filter)
  }
  if (table === 'projects') {
    const [aliases, labels, entries] = await Promise.all([store.projectAliases(), store.projectLabels(), store.projectEntries()])
    const groups = groupProjects(entries, aliases, labels)
    return {
      name: 'Project names',
      rows: [['Project group', 'Players', 'Spellings (players)', 'Merged keys'], ...groups.map((g) => [g.label, g.players, g.variants.map((v) => `${v.text} (${v.players})`).join('; '), g.merged_keys.join('; ')])],
    }
  }
  if (table === 'opus') {
    const [settings, runs] = await Promise.all([store.getSettings(), filteredRuns(store, f)])
    const rows: Cell[][] = settings.opus.map((o) => {
      const of = runs.filter((r) => r.affiliation_type === 'business' && (r.opu ?? '').toLowerCase() === o.toLowerCase())
      return [o, new Set(of.map((r) => id.key(r))).size, of.length]
    })
    return { name: 'OPUs', rows: [['OPU', 'Players', 'Games'], ...rows] }
  }
  // solutions
  const [solutions, runs] = await Promise.all([store.listSolutions(), filteredRuns(store, f)])
  return {
    name: 'Solutions',
    rows: [
      ['Star', 'Name (answer)', 'Clue', 'Recap line', 'Decoys', 'Rounds', 'Solved', 'Solve rate (%)', 'Wrong tiles', 'Skips'],
      ...solutions.map((s) => {
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
        return [s.position, s.name, s.clue, s.description, s.decoys.join(', '), rounds, solved, rounds ? Math.round((solved / rounds) * 1000) / 10 : '', wrong, skips]
      }),
    ],
  }
}

export async function feedbackSheet(store: Store, f: FeedbackFilter): Promise<Sheet> {
  const [rows, id] = await Promise.all([feedbackRows(store, f), loadIdentity(store)])
  return {
    name: 'Feedback',
    rows: [
      ['Submitted (KL)', 'Full name', 'From', 'Project name', 'Project group', 'OPU', 'Company', 'Game mode', 'Game', 'Q1 Relevant', 'Q2 Would explore', 'Q2 Solutions', 'Q3 Understanding (1-5)', 'Feedback id', 'Game id'],
      ...rows.map((x) => [
        formatKlDateTime(x.submitted_at),
        x.full_name,
        AFFILIATION_LABELS[x.affiliation_type],
        x.affiliation_type === 'project' ? (x.project_name ?? '') : '',
        x.affiliation_type === 'project' ? id.project(x.project_name ?? '').label : '',
        x.opu ?? '',
        x.affiliation_type === 'contractor' ? (x.project_name ?? '') : '',
        FEEDBACK_MODE_LABELS[x.game_mode],
        MODE_LABELS[x.race_mode],
        yesNo(x.q1_relevant),
        yesNo(x.q2_would_explore),
        (x.q2_interested_solutions ?? []).map(solutionLabel).join('; '),
        x.q3_understanding_rating,
        x.feedback_id,
        x.session_id,
      ]),
    ],
  }
}

// ── File formats ────────────────────────────────────────────────────────────

/** CSV with a byte-order mark (Excel reads UTF-8 correctly), every field quoted, CRLF lines. */
export function toCsv(sheet: Sheet): string {
  const q = (v: Cell) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return '﻿' + sheet.rows.map((row) => row.map(q).join(',')).join('\r\n') + '\r\n'
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function colName(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

function sheetXml(sheet: Sheet): string {
  const rows = sheet.rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          const ref = `${colName(c)}${r + 1}`
          const style = r === 0 ? ' s="1"' : ''
          if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`
          return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(String(v ?? ''))}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const widths = (sheet.rows[0] ?? []).map((_, c) => {
    const longest = Math.max(...sheet.rows.slice(0, 200).map((row) => String(row[c] ?? '').length))
    return `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, Math.max(10, longest + 2))}" customWidth="1"/>`
  })
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${widths.length ? `<cols>${widths.join('')}</cols>` : ''}<sheetData>${rows}</sheetData></worksheet>`
}

/** A minimal .xlsx workbook (one sheet per table, bold frozen header row). */
export function toXlsx(sheets: Sheet[]): Uint8Array {
  const used = new Set<string>()
  const names = sheets.map((s) => {
    let n = s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet'
    while (used.has(n)) n = `${n.slice(0, 28)} ${used.size}`
    used.add(n)
    return n
  })
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf fontId="0"/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
    ),
  }
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))))
  return zipSync(files, { level: 6 })
}
