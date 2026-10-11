import { useState } from 'react'
import { Download, FileSpreadsheet, Star } from 'lucide-react'
import { FEEDBACK_COPY, type FeedbackDashboard } from '@shared/feedback'
import { klDayKey } from '@shared/time'
import { api, ApiError, download, pct } from './api'
import { Bars, ChartCard, ColumnChart, DataTable, Donut, SERIES } from './charts'
import { FieldLabel, Note, SectionCard, StatTile, TD, TH, useAdminData } from './shared'

const NO = '#98a2b3'

export function FeedbackTab() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState('all')
  const [aff, setAff] = useState('all')
  const [opu, setOpu] = useState('')
  const [by, setBy] = useState<'opu' | 'project'>('opu')
  const [exportError, setExportError] = useState<string | null>(null)
  const q = new URLSearchParams({ ...(from && { from }), ...(to && { to }), mode, affiliation: aff, ...(opu && { opu }) }).toString()
  const { data: d, error } = useAdminData(() => api<FeedbackDashboard>(`/api/admin/feedback?${q}`), [q], 15_000)
  const today = klDayKey(Date.now())
  const dl = (path: string) => download(path).catch((e: ApiError) => setExportError(e.message))
  const rows = by === 'opu' ? (d?.by_opu ?? []) : (d?.by_project ?? [])

  return (
    <>
      <SectionCard>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <FieldLabel label="Date from">
              <input type="date" className="afield w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
            </FieldLabel>
            <FieldLabel label="Date to">
              <input type="date" className="afield w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            </FieldLabel>
            <button type="button" className="btn btn-light min-h-0 px-5 py-2.5 text-sm" onClick={() => (setFrom(today), setTo(today))}>
              Today
            </button>
            <button type="button" className="btn btn-light min-h-0 px-5 py-2.5 text-sm" onClick={() => (setFrom(''), setTo(''))}>
              All dates
            </button>
            <FieldLabel label="Game mode">
              <select className="afield w-auto" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="all">All modes</option>
                <option value="solo">Solo</option>
                <option value="team">Team (Battle / Head-to-Head)</option>
              </select>
            </FieldLabel>
            <FieldLabel label="From">
              <select
                className="afield w-auto"
                value={aff}
                onChange={(e) => {
                  setAff(e.target.value)
                  if (e.target.value !== 'business') setOpu('')
                }}
              >
                <option value="all">Everyone</option>
                <option value="project">Project</option>
                <option value="business">Business</option>
                <option value="contractor">Contractor</option>
              </select>
            </FieldLabel>
            <FieldLabel label="OPU">
              <select
                className="afield w-auto"
                value={opu}
                onChange={(e) => {
                  setOpu(e.target.value)
                  if (e.target.value) setAff('business')
                }}
              >
                <option value="">All OPUs</option>
                {(d?.opus ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-admin min-h-0 px-4 py-2 text-sm" onClick={() => dl(`/api/admin/feedback/export.xlsx?${q}`)}>
              <FileSpreadsheet className="size-4" aria-hidden="true" /> Excel
            </button>
            <button type="button" className="btn btn-light min-h-0 px-4 py-2 text-sm" onClick={() => dl(`/api/admin/feedback/export.csv?${q}`)}>
              <Download className="size-4" aria-hidden="true" /> CSV
            </button>
          </div>
          {exportError && <Note tone="error">{exportError}</Note>}
        </div>
      </SectionCard>
      {error && <Note tone="error">{error}</Note>}
      {d && d.rehearsal_responses > 0 && <Note>{d.rehearsal_responses} rehearsal answer(s) are left out.</Note>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Responses" value={d?.responses ?? '—'} note="one per player per day" />
        <StatTile label="Response rate" value={pct(d?.response_rate)} note={`of ${d?.completed_games ?? 0} completed games`} />
        <StatTile label="Relevant" value={d && d.responses ? pct(d.q1.yes / d.responses) : '—'} note="Q1 Yes" />
        <StatTile label="Would explore" value={d && d.responses ? pct(d.q2.yes / d.responses) : '—'} note="Q2 Yes" />
        <StatTile label="Understanding" value={d?.q3.average == null ? '—' : `${d.q3.average.toFixed(1)} / 5`} note="Q3 average stars" />
      </div>

      {d && (
        <div className="grid gap-5 xl:grid-cols-2">
          {(
            [
              ['Q1 · Information relevant', FEEDBACK_COPY.q1, d.q1],
              ['Q2 · Would explore the solutions', FEEDBACK_COPY.q2, d.q2],
            ] as const
          ).map(([title, sub, v]) => (
            <ChartCard key={title} title={title} subtitle={sub} table={<DataTable head={['Answer', 'Count']} rows={[['Yes', v.yes], ['No', v.no]]} />}>
              <Donut
                parts={[
                  { label: 'Yes', value: v.yes, color: SERIES },
                  { label: 'No', value: v.no, color: NO },
                ]}
                center={pct(v.yes + v.no ? v.yes / (v.yes + v.no) : null)}
                centerLabel="said Yes"
              />
            </ChartCard>
          ))}

          <ChartCard title="Q3 · Understanding" subtitle={FEEDBACK_COPY.q3} table={<DataTable head={['Stars', 'Answers']} rows={d.q3.distribution.map((x) => [`${x.rating} ★`, x.count])} />}>
            {d.q3.average !== null && (
              <div className="mb-3 flex items-center gap-3">
                <span className="text-3xl font-extrabold">{d.q3.average.toFixed(1)}</span>
                <span className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`size-5 ${n <= Math.round(d.q3.average!) ? 'fill-nc-yellow text-nc-yellow' : 'text-[#c5cfdb]'}`} aria-hidden="true" />
                  ))}
                </span>
                <span className="text-muted">average of {d.responses}</span>
              </div>
            )}
            <ColumnChart data={d.q3.distribution.map((x) => ({ label: `${x.rating} ★`, value: x.count, tip: `answers with ${x.rating} stars` }))} />
          </ChartCard>

          <ChartCard title="Solution interest" subtitle="Players who picked each solution under Q2 (highest first)" table={<DataTable head={['Solution', 'Players']} rows={d.solutions.map((s) => [s.name, s.players])} />}>
            <Bars data={d.solutions.map((s) => ({ label: s.name, value: s.players, note: 'players' }))} />
          </ChartCard>
        </div>
      )}

      <SectionCard
        title="Breakdown"
        actions={
          <div className="flex gap-2">
            {(['opu', 'project'] as const).map((b) => (
              <button key={b} type="button" className={`btn min-h-0 px-5 py-2 text-sm ${by === b ? 'btn-admin' : 'btn-light'}`} onClick={() => setBy(b)}>
                {b === 'opu' ? 'By OPU' : 'By project name'}
              </button>
            ))}
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="text-muted">No answers for these filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>{by === 'opu' ? 'OPU' : 'Project name'}</th>
                  <th className={TH}>Responses</th>
                  <th className={TH}>Relevant (Q1 Yes)</th>
                  <th className={TH}>Would explore (Q2 Yes)</th>
                  <th className={TH}>Understanding (Q3 avg)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-t border-line">
                    <td className={TD}>{r.label}</td>
                    <td className={TD}>{r.responses}</td>
                    <td className={TD}>
                      {pct(r.q1_yes / r.responses)} ({r.q1_yes})
                    </td>
                    <td className={TD}>
                      {pct(r.q2_yes / r.responses)} ({r.q2_yes})
                    </td>
                    <td className={TD}>{r.q3_average === null ? '—' : `${r.q3_average.toFixed(1)} / 5`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {by === 'project' && <p className="mt-2 text-xs text-muted">Project names are grouped like the leaderboards (capitals and spaces ignored, Admin merges applied).</p>}
      </SectionCard>
    </>
  )
}
