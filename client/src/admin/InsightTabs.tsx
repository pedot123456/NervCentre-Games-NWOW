import { useState } from 'react'
import { Briefcase, Building2, Columns2, Download, FileSpreadsheet, HardHat, Smartphone, User } from 'lucide-react'
import type { DashboardData, ExportTable } from '@shared/dashboard'
import { formatSeconds } from '@shared/time'
import { api, ApiError, dayLabel, download, pct } from './api'
import { Bars, ChartCard, ColumnChart, DataTable, SERIES, SplitBar } from './charts'
import { FieldLabel, Note, SectionCard, StatTile, useAdminData } from './shared'

export const EXPORT_BUTTONS: { table: ExportTable; label: string }[] = [
  { table: 'games', label: 'Games CSV' },
  { table: 'participants', label: 'Participants CSV' },
  { table: 'feedback', label: 'Feedback CSV' },
  { table: 'projects', label: 'Project names CSV' },
  { table: 'opus', label: 'OPUs CSV' },
  { table: 'solutions', label: 'Solutions CSV' },
]

export function DayModeFilter({ day, mode, days, onDay, onMode, allLabel = 'All days' }: { day: string; mode: string; days: string[]; onDay: (d: string) => void; onMode: (m: string) => void; allLabel?: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      <FieldLabel label="Day">
        <select className="afield w-auto" value={day} onChange={(e) => onDay(e.target.value)}>
          <option value="today">Today</option>
          <option value="all">{allLabel}</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d)}
            </option>
          ))}
        </select>
      </FieldLabel>
      <FieldLabel label="Mode">
        <select className="afield w-auto" value={mode} onChange={(e) => onMode(e.target.value)}>
          <option value="all">All modes</option>
          <option value="solo">Solo Rush</option>
          <option value="battle">Multiplayer Battle</option>
          <option value="h2h">Head-to-Head</option>
        </select>
      </FieldLabel>
    </div>
  )
}

export function ExportButtons({ day, mode, onError }: { day: string; mode: string; onError: (msg: string) => void }) {
  const q = `day=${encodeURIComponent(day)}&mode=${encodeURIComponent(mode)}`
  const run = (path: string) => download(path).catch((e: ApiError) => onError(e.message))
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-admin min-h-0 px-4 py-2 text-sm" onClick={() => run(`/api/admin/export.xlsx?${q}`)}>
        <FileSpreadsheet className="size-4" aria-hidden="true" /> Excel report
      </button>
      {EXPORT_BUTTONS.map((b) => (
        <button key={b.table} type="button" className="btn btn-light min-h-0 px-4 py-2 text-sm" onClick={() => run(`/api/admin/export.csv?table=${b.table}&${q}`)}>
          <Download className="size-4" aria-hidden="true" /> {b.label}
        </button>
      ))}
    </div>
  )
}

const MODE_COLORS = { solo: SERIES, battle: '#763F98', h2h: '#00A19C' }
const MODE_NAMES = { solo: 'Solo Rush', battle: 'Multiplayer Battle', h2h: 'Head-to-Head' }

export function DashboardTab() {
  const [day, setDay] = useState('today')
  const [mode, setMode] = useState('all')
  const [exportError, setExportError] = useState<string | null>(null)
  const { data: d, error } = useAdminData(() => api<DashboardData>(`/api/admin/dashboard?day=${encodeURIComponent(day)}&mode=${mode}`), [day, mode], 15_000)
  const k = d?.kpis
  const dash = '—'
  const nOpusEmpty = d ? d.opus.filter((o) => o.players === 0).length : 0

  return (
    <>
      <SectionCard>
        <div className="flex flex-col gap-4">
          <DayModeFilter day={day} mode={mode} days={d?.days ?? []} onDay={setDay} onMode={setMode} />
          <ExportButtons day={day} mode={mode} onError={setExportError} />
          {exportError && <Note tone="error">{exportError}</Note>}
        </div>
      </SectionCard>
      {error && <Note tone="error">{error}</Note>}
      {k && k.rehearsal_games > 0 && <Note>{k.rehearsal_games} rehearsal game(s) in this period are left out of everything below.</Note>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Players" value={k?.players ?? dash} note="name + project / OPU" />
        <StatTile label="Games" value={k?.games ?? dash} note={`${k?.battles ?? 0} battles / head-to-heads`} />
        <StatTile label="All 6 lit" value={k?.completion_rate == null ? dash : pct(k.completion_rate)} note={`${k?.completed ?? 0} games`} />
        <StatTile label="Avg stars lit" value={k?.avg_solved == null ? dash : k.avg_solved.toFixed(1)} note="out of 6" />
        <StatTile label="Fastest" value={k?.fastest_ms == null ? dash : `${formatSeconds(k.fastest_ms)} s`} note="all 6 solved" />
        <StatTile label="Avg finish" value={k?.avg_finish_ms == null ? dash : `${formatSeconds(k.avg_finish_ms)} s`} note="games with all 6" />
        <StatTile label="Quiz score" value={k?.avg_quiz_score == null ? dash : `${k.avg_quiz_score.toFixed(1)} / 3`} note={`average right · ${k?.feedback ?? 0} players`} />
        <StatTile label="Feedback rate" value={k && k.games ? pct(k.feedback / k.games) : dash} note="of games · details under Feedback" />
      </div>

      {d && (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard
            title={d.timeline_unit === 'hour' ? 'Games by hour' : 'Games by day'}
            subtitle="Malaysia time"
            table={<DataTable head={[d.timeline_unit === 'hour' ? 'Hour' : 'Day', 'Games', 'Players']} rows={d.timeline.map((t) => [t.label, t.games, t.players])} />}
          >
            <ColumnChart data={d.timeline.map((t) => ({ label: d.timeline_unit === 'hour' ? t.label.slice(0, 2) : t.label, value: t.games, tip: `games · ${t.label}` }))} />
          </ChartCard>

          <ChartCard title="Stars lit per game" subtitle="How far players got" table={<DataTable head={['Stars lit', 'Games']} rows={d.solved_distribution.map((s) => [s.solved, s.games])} />}>
            <ColumnChart data={d.solved_distribution.map((s) => ({ label: String(s.solved), value: s.games, tip: `games with ${s.solved} stars` }))} />
          </ChartCard>

          <ChartCard title="Game modes" table={<DataTable head={['Mode', 'Games']} rows={d.modes.map((m) => [MODE_NAMES[m.mode], m.games])} />}>
            <SplitBar
              parts={d.modes.map((m) => ({
                label: MODE_NAMES[m.mode],
                value: m.games,
                color: MODE_COLORS[m.mode],
                icon: m.mode === 'solo' ? <User className="size-4" /> : m.mode === 'battle' ? <Smartphone className="size-4" /> : <Columns2 className="size-4" />,
              }))}
            />
          </ChartCard>

          <ChartCard
            title="Solutions – solve rate"
            subtitle="Share of rounds where the name was built · wrong tiles per round"
            table={<DataTable head={['Solution', 'Rounds', 'Built', 'Solve rate', 'Wrong / round', 'Skips']} rows={d.solutions.map((s) => [s.name, s.rounds, s.solved, pct(s.solve_rate), s.avg_wrong?.toFixed(1) ?? '—', s.skips])} />}
          >
            <Bars
              max={1}
              format={(v) => `${Math.round(v * 100)}%`}
              data={[...d.solutions].filter((s) => s.rounds > 0).sort((a, b) => (a.solve_rate ?? 0) - (b.solve_rate ?? 0)).map((s) => ({ label: s.name, value: s.solve_rate ?? 0, note: `${(s.avg_wrong ?? 0).toFixed(1)} wrong/round` }))}
            />
          </ChartCard>

          <ChartCard
            title="Project vs Business vs Contractor"
            subtitle="Where players are from"
            table={
              <DataTable
                head={['From', 'Players', 'Games']}
                rows={[
                  ['Project', d.affiliation_split.project.players, d.affiliation_split.project.games],
                  ['Business', d.affiliation_split.business.players, d.affiliation_split.business.games],
                  ['Contractor', d.affiliation_split.contractor.players, d.affiliation_split.contractor.games],
                ]}
              />
            }
          >
            <SplitBar
              parts={[
                { label: 'Project', value: d.affiliation_split.project.players, color: SERIES, icon: <HardHat className="size-4" /> },
                { label: 'Business', value: d.affiliation_split.business.players, color: '#763F98', icon: <Briefcase className="size-4" /> },
                { label: 'Contractor', value: d.affiliation_split.contractor.players, color: '#00A19C', icon: <Building2 className="size-4" /> },
              ]}
            />
            {d.affiliation_split.project.players + d.affiliation_split.business.players + d.affiliation_split.contractor.players > 0 && (
              <p className="mt-2 text-xs text-muted">
                Players · games: Project {d.affiliation_split.project.games}, Business {d.affiliation_split.business.games}, Contractor {d.affiliation_split.contractor.games}
              </p>
            )}
          </ChartCard>

          <ChartCard
            title="Players by OPU"
            subtitle="Business visitors (the table lists every OPU in Settings)"
            table={<DataTable head={['OPU', 'Players', 'Games', 'Best time']} rows={d.opus.map((o) => [o.name, o.players, o.games, o.best_time_ms === null ? '—' : `${formatSeconds(o.best_time_ms)} s`])} />}
          >
            <Bars data={d.opus.filter((o) => o.players > 0).sort((a, b) => b.players - a.players).map((o) => ({ label: o.name, value: o.players, note: `players · ${o.games} games` }))} />
            {nOpusEmpty > 0 && d.opus.some((o) => o.players > 0) && <p className="mt-2 text-xs text-muted">{nOpusEmpty} OPUs with no players yet – switch to Table to see every OPU.</p>}
          </ChartCard>

          <ChartCard
            title="Players by project name"
            subtitle="Spellings grouped (capitals and spaces ignored) – merge more under Project names"
            table={<DataTable head={['Project', 'Players', 'Games', 'Best time']} rows={d.projects.map((p) => [p.label, p.players, p.games, p.best_time_ms === null ? '—' : `${formatSeconds(p.best_time_ms)} s`])} />}
          >
            <Bars data={d.projects.slice(0, 12).map((p) => ({ label: p.label, value: p.players, note: `players · ${p.games} games` }))} />
          </ChartCard>

          <ChartCard
            title="Quiz – right answers"
            subtitle="Share of players who answered each question right – more under Feedback"
            table={<DataTable head={['Question', 'Right', 'Answered']} rows={d.quiz.map((q) => [`${q.id.toUpperCase()} · ${q.short}`, q.correct, q.answered])} />}
          >
            <Bars max={100} format={(v) => `${v}%`} data={d.quiz.map((q) => ({ label: `${q.id.toUpperCase()} · ${q.short}`, value: q.answered ? Math.round((q.correct / q.answered) * 100) : 0, note: `${q.correct} of ${q.answered}` }))} />
          </ChartCard>
        </div>
      )}
    </>
  )
}
