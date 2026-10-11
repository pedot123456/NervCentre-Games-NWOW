import { useState } from 'react'
import { Crown, FlaskConical, RotateCcw, Search, Trash2, Wifi, WifiOff } from 'lucide-react'
import type { Boards, BoardRow, GameMode, RaceState, WinsRow } from '@shared/types'
import { MODE_LABELS } from '@shared/types'
import { formatSeconds } from '@shared/time'
import type { AffiliationType } from '@shared/validation'
import { api, ApiError, klDateTime } from './api'
import { DayModeFilter } from './InsightTabs'
import { ConfirmButton, FieldLabel, Note, SectionCard, Tag, TD, TH, useAdminData } from './shared'

// ── Live races ──────────────────────────────────────────────────────────────

export function LiveTab() {
  const { data, error, reload } = useAdminData(() => api<RaceState[]>('/api/admin/live'), [], 3000)
  const [note, setNote] = useState<string | null>(null)
  const stop = async (id: string) => {
    await api(`/api/admin/races/${id}/stop`, { json: {} })
    setNote('Race stopped – open runs ended with what they had.')
    reload()
  }
  return (
    <SectionCard title="Live races">
      {error && <Note tone="error">{error}</Note>}
      {note && (
        <Note tone="ok" className="mb-3">
          {note}
        </Note>
      )}
      {!data?.length ? (
        <p className="text-muted">No lobbies or races right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <b>{MODE_LABELS[r.mode]}</b>
                {r.room_code && <Tag tone="purple">Room {r.room_code}</Tag>}
                <Tag tone={r.status === 'running' ? 'green' : 'grey'}>{r.status === 'howto' ? 'how to play' : r.status}</Tag>
                {r.is_test && <Tag tone="yellow">Rehearsal</Tag>}
                <div className="ml-auto">
                  <ConfirmButton label="Stop race" confirm="stop" onConfirm={() => void stop(r.id)} className="btn-danger" />
                </div>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {r.runs.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    {p.connected ? <Wifi className="size-4 text-nc-green" aria-label="connected" /> : <WifiOff className="size-4 text-error" aria-label="offline" />}
                    <b>{p.name}</b>
                    <span className="text-muted">{p.affiliation}</span>
                    <span className="ml-auto tabular-nums">
                      {p.progress.solved.length}/{r.answer_lengths.length || 6} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ── Results & players ───────────────────────────────────────────────────────

interface AdminRun {
  id: string
  ended_at: string
  mode: GameMode
  name: string
  affiliation_type: AffiliationType
  affiliation: string
  affiliation_group: string
  solved: number
  total: number
  time_ms: number
  penalty_ms: number
  wrong: number
  skips: number
  status: string
  is_winner: boolean
  is_test: boolean
  removed_at: string | null
  removed_reason: string | null
}

interface Participant {
  key: string
  name: string
  affiliation_type: AffiliationType
  affiliation: string
  games: number
  best_solved: number
  best_time_ms: number | null
  wins: number
  last_played: string
}

const FromTag = ({ type }: { type: AffiliationType }) => <Tag tone={type === 'project' ? 'blue' : type === 'business' ? 'purple' : 'green'}>{type}</Tag>

export function ResultsTab() {
  const [view, setView] = useState<'games' | 'players'>('games')
  const [day, setDay] = useState('today')
  const [mode, setMode] = useState('all')
  const [q, setQ] = useState('')
  const [test, setTest] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const params = `day=${encodeURIComponent(day)}&mode=${mode}&q=${encodeURIComponent(q)}${test ? '&test=1' : ''}`
  const runs = useAdminData(() => (view === 'games' ? api<AdminRun[]>(`/api/admin/runs?${params}`) : Promise.resolve([] as AdminRun[])), [params, view])
  const people = useAdminData(() => (view === 'players' ? api<Participant[]>(`/api/admin/participants?${params}`) : Promise.resolve([] as Participant[])), [params, view])
  const days = useAdminData(() => api<{ days: string[] }>('/api/admin/dashboard?day=all'), []).data?.days ?? []

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      setNote({ tone: 'ok', text: ok })
      runs.reload()
    } catch (e) {
      setNote({ tone: 'error', text: (e as ApiError).message })
    }
  }

  return (
    <SectionCard
      title="Results & players"
      actions={
        <div className="flex rounded-lg border border-line p-0.5">
          {(['games', 'players'] as const).map((v) => (
            <button key={v} type="button" className={`rounded-md px-4 py-1.5 text-sm font-bold ${view === v ? 'bg-nc-blue text-white' : 'text-muted'}`} onClick={() => setView(v)}>
              {v === 'games' ? 'Games' : 'Players'}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <DayModeFilter day={day} mode={mode} days={days} onDay={setDay} onMode={setMode} />
        <FieldLabel label="Search">
          <span className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input className="afield min-w-[16rem] pl-9" placeholder="Name, project or OPU" value={q} onChange={(e) => setQ(e.target.value)} />
          </span>
        </FieldLabel>
        <label className="flex items-center gap-2 pb-2 text-sm font-semibold">
          <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} /> Show rehearsal games
        </label>
      </div>
      {note && (
        <Note tone={note.tone} className="mb-3">
          {note.text}
        </Note>
      )}

      {view === 'games' ? (
        <div className="overflow-x-auto rounded-xl border border-line" data-testid="runs-table">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {['Ended', 'Mode', 'Name', 'Project / OPU', 'Solved', 'Time', 'Penalties', 'Status', 'Actions'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(runs.data ?? []).map((r) => {
                const removed = !!r.removed_at
                const cell = `${TD} ${removed ? 'line-through text-muted' : ''}`
                return (
                  <tr key={r.id} className={`border-t border-line ${removed ? 'bg-error/5' : ''}`}>
                    <td className={cell}>{klDateTime(r.ended_at)}</td>
                    <td className={cell}>{MODE_LABELS[r.mode]}</td>
                    <td className={`${cell} font-semibold`}>
                      {r.is_winner && <Crown className="mr-1 inline size-4 text-[#b07800]" aria-label="winner" />}
                      {r.name}
                    </td>
                    <td className={cell}>
                      <FromTag type={r.affiliation_type} />
                      <div>{r.affiliation}</div>
                      {r.affiliation_type === 'project' && r.affiliation_group && r.affiliation_group !== r.affiliation && <div className="text-xs text-muted">→ {r.affiliation_group}</div>}
                    </td>
                    <td className={`${cell} tabular-nums`}>
                      {r.solved}/{r.total}
                    </td>
                    <td className={`${cell} font-bold tabular-nums`}>{formatSeconds(r.time_ms)} s</td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {r.penalty_ms ? `+${formatSeconds(r.penalty_ms)} s` : '—'}
                      <div className="text-xs text-muted">
                        {r.wrong} wrong · {r.skips} skip
                      </div>
                    </td>
                    <td className={TD}>
                      <div className="flex flex-col items-start gap-1">
                        {r.solved >= r.total ? <Tag tone="green">All solved</Tag> : <Tag tone="grey">Time up</Tag>}
                        {r.is_test && <Tag tone="yellow">Rehearsal</Tag>}
                        {removed && <Tag tone="red">Removed</Tag>}
                      </div>
                    </td>
                    <td className={TD}>
                      {removing === r.id ? (
                        <div className="flex flex-wrap gap-1.5">
                          <input className="afield min-w-[10rem] py-1 text-sm" placeholder="Reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} />
                          <button
                            type="button"
                            className="btn btn-danger min-h-0 px-3 py-1.5 text-sm"
                            disabled={reason.trim().length < 3}
                            onClick={() => {
                              setRemoving(null)
                              void act(() => api(`/api/admin/runs/${r.id}/remove`, { json: { reason } }), 'Entry removed from the boards.')
                            }}
                          >
                            Remove
                          </button>
                          <button type="button" className="btn btn-light min-h-0 px-3 py-1.5 text-sm" onClick={() => setRemoving(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-nowrap gap-1.5">
                          {removed ? (
                            <button type="button" className="btn btn-light min-h-0 px-3 py-1.5 text-sm" onClick={() => void act(() => api(`/api/admin/runs/${r.id}/restore`, { json: {} }), 'Entry restored.')}>
                              <RotateCcw className="size-4" aria-hidden="true" /> Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-danger min-h-0 px-3 py-1.5 text-sm"
                              data-testid="remove"
                              onClick={() => {
                                setReason('')
                                setRemoving(r.id)
                              }}
                            >
                              <Trash2 className="size-4" aria-hidden="true" /> Remove
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-light min-h-0 px-3 py-1.5 text-sm"
                            onClick={() => void act(() => api(`/api/admin/runs/${r.id}/test`, { json: { is_test: !r.is_test } }), r.is_test ? 'Unmarked as test.' : 'Marked as test.')}
                          >
                            <FlaskConical className="size-4" aria-hidden="true" /> {r.is_test ? 'Unmark test' : 'Mark test'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {runs.data && runs.data.length === 0 && <p className="p-4 text-muted">No games for these filters.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {['Name', 'Project / OPU', 'Games', 'Best', 'Battle wins', 'Last played'].map((h) => (
                  <th key={h} className={TH}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(people.data ?? []).map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className={`${TD} font-semibold`}>{p.name}</td>
                  <td className={TD}>
                    <FromTag type={p.affiliation_type} />
                    <div>{p.affiliation}</div>
                  </td>
                  <td className={TD}>{p.games}</td>
                  <td className={`${TD} tabular-nums`}>
                    {p.best_solved}/6 · {formatSeconds(p.best_time_ms)} s
                  </td>
                  <td className={TD}>{p.wins}</td>
                  <td className={TD}>{klDateTime(p.last_played)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {people.data && people.data.length === 0 && <p className="p-4 text-muted">No players for these filters.</p>}
        </div>
      )}
    </SectionCard>
  )
}

// ── Leaderboards ────────────────────────────────────────────────────────────

function TimesList({ rows }: { rows: BoardRow[] }) {
  if (!rows.length) return <p className="text-muted">No games yet.</p>
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.player_key} className="border-t border-line first:border-0">
            <td className="w-10 py-1.5 font-bold">{r.rank === 1 ? <Crown className="size-4 text-[#b07800]" aria-label="1" /> : r.rank}</td>
            <td className="py-1.5 font-semibold">{r.name}</td>
            <td className="py-1.5 text-muted">{r.affiliation}</td>
            <td className="py-1.5 text-right tabular-nums">{r.solved}/6</td>
            <td className="py-1.5 text-right font-bold tabular-nums">{formatSeconds(r.time_ms)} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WinsList({ rows }: { rows: WinsRow[] }) {
  if (!rows.length) return <p className="text-muted">No battles won yet.</p>
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.player_key} className="border-t border-line first:border-0">
            <td className="w-10 py-1.5 font-bold">{r.rank}</td>
            <td className="py-1.5 font-semibold">{r.name}</td>
            <td className="py-1.5 text-muted">{r.affiliation}</td>
            <td className="py-1.5 text-right font-bold">{r.wins} wins</td>
            <td className="py-1.5 text-right tabular-nums">{r.best_time_ms === null ? '—' : `${formatSeconds(r.best_time_ms)} s`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function BoardsTab() {
  const { data, reload } = useAdminData(() => api<Boards>('/api/admin/boards'), [])
  const [note, setNote] = useState<string | null>(null)
  return (
    <>
      <SectionCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Best time per player (full name + project name or OPU). Rehearsal games and removed entries are never shown.</p>
          <ConfirmButton
            label={
              <>
                <RotateCcw className="size-4" aria-hidden="true" /> Reset daily board
              </>
            }
            confirm="reset today's board"
            onConfirm={async () => {
              await api('/api/admin/boards/reset-daily', { json: {} })
              setNote("Today's boards start again from now. All-time boards and all game records are kept.")
              reload()
            }}
          />
        </div>
        {note && (
          <Note tone="ok" className="mt-3">
            {note}
          </Note>
        )}
      </SectionCard>
      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title={`Fastest today (${data?.today.length ?? 0})`}>
          <TimesList rows={data?.today ?? []} />
        </SectionCard>
        <SectionCard title={`All-time (${data?.all_time.length ?? 0})`}>
          <TimesList rows={data?.all_time ?? []} />
        </SectionCard>
        <SectionCard title="Multiplayer wins today">
          <WinsList rows={data?.wins_today ?? []} />
        </SectionCard>
        <SectionCard title="Multiplayer wins all-time">
          <WinsList rows={data?.wins_all_time ?? []} />
        </SectionCard>
      </div>
    </>
  )
}
