import { useState } from 'react'
import { Download, Pencil, Save, Trash2, X } from 'lucide-react'
import type { ProjectGroup } from '@shared/affiliation'
import { api, ApiError, download, klDateTime } from './api'
import { DayModeFilter, ExportButtons } from './InsightTabs'
import { ConfirmButton, FieldLabel, Note, SectionCard, TD, TH, useAdminData } from './shared'

// ── Project names ───────────────────────────────────────────────────────────

export function ProjectsTab() {
  const { data, reload } = useAdminData(() => api<{ groups: ProjectGroup[] }>('/api/admin/projects'), [])
  const [ticked, setTicked] = useState<string[]>([])
  const [target, setTarget] = useState('')
  const [label, setLabel] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [rename, setRename] = useState('')
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const groups = data?.groups ?? []

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      setNote({ tone: 'ok', text: ok })
      reload()
    } catch (e) {
      setNote({ tone: 'error', text: (e as ApiError).message })
    }
  }
  const toggle = (key: string) => {
    setTicked((t) => {
      const next = t.includes(key) ? t.filter((k) => k !== key) : [...t, key]
      if (!next.includes(target)) setTarget(next[0] ?? '')
      return next
    })
  }

  return (
    <>
      <SectionCard>
        <p className="text-sm text-muted">
          Project names are typed by players, so the same project can be spelled in different ways. Spellings are grouped automatically: capitals, accents, extra spaces and spaces around & / - + are ignored. Tick two or more groups to merge
          them; rename a group to change how it shows on the boards.
        </p>
        {note && (
          <Note tone={note.tone} className="mt-3">
            {note.text}
          </Note>
        )}
      </SectionCard>

      {ticked.length >= 2 && (
        <SectionCard title="Merge" className="border-nc-blue/40">
          <div className="flex flex-wrap items-end gap-3" data-testid="merge-panel">
            <FieldLabel label="Merge into">
              <select className="afield w-auto" value={target} onChange={(e) => setTarget(e.target.value)}>
                {ticked.map((k) => (
                  <option key={k} value={k}>
                    {groups.find((g) => g.key === k)?.label ?? k}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Show as (optional)">
              <input className="afield" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
            </FieldLabel>
            <button
              type="button"
              className="btn btn-admin min-h-0 px-4 py-2.5 text-sm"
              onClick={() =>
                void act(async () => {
                  await api('/api/admin/projects/merge', { json: { keys: ticked, target, label: label || null } })
                  setTicked([])
                  setLabel('')
                }, 'Groups merged.')
              }
            >
              Merge {ticked.length} groups
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={`Project names (${groups.length})`} bodyClass="p-0">
        {!groups.length ? (
          <p className="p-5 text-muted">No project names yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface">
                <tr>
                  <th className={`${TH} w-10`} />
                  <th className={TH}>Project name</th>
                  <th className={TH}>Players</th>
                  <th className={TH}>Spellings grouped</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.key} className="border-t border-line" data-testid="project-row">
                    <td className={TD}>
                      <input type="checkbox" aria-label={`Select ${g.label}`} checked={ticked.includes(g.key)} onChange={() => toggle(g.key)} />
                    </td>
                    <td className={`${TD} font-semibold`}>
                      {editing === g.key ? (
                        <span className="flex gap-1.5">
                          <input className="afield py-1" autoFocus value={rename} maxLength={80} onChange={(e) => setRename(e.target.value)} />
                          <button
                            type="button"
                            className="btn btn-admin min-h-0 px-2.5 py-1"
                            aria-label="Save name"
                            onClick={() => {
                              setEditing(null)
                              void act(() => api('/api/admin/projects/label', { json: { key: g.key, label: rename.trim() || null } }), 'Project renamed.')
                            }}
                          >
                            <Save className="size-4" />
                          </button>
                          <button type="button" className="btn btn-light min-h-0 px-2.5 py-1" aria-label="Cancel" onClick={() => setEditing(null)}>
                            <X className="size-4" />
                          </button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          {g.label}
                          <button
                            type="button"
                            className="text-muted hover:text-nc-blue"
                            aria-label={`Rename ${g.label}`}
                            onClick={() => {
                              setEditing(g.key)
                              setRename(g.label)
                            }}
                          >
                            <Pencil className="size-4" />
                          </button>
                        </span>
                      )}
                    </td>
                    <td className={TD}>{g.players}</td>
                    <td className={TD}>
                      <div className="flex flex-wrap gap-1.5">
                        {g.variants.map((v) => (
                          <span key={`${v.key}|${v.text}`} className="rounded-full bg-[#eef1f5] px-2 py-0.5 text-xs">
                            {v.text} ×{v.players}
                          </span>
                        ))}
                        {g.merged_keys.map((k) => (
                          <button key={k} type="button" className="rounded-full border border-line px-2 py-0.5 text-xs text-nc-blue hover:bg-surface" onClick={() => void act(() => api('/api/admin/projects/unmerge', { json: { key: k } }), 'Spelling unmerged.')}>
                            unmerge “{k}”
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  )
}

// ── Exports & data ──────────────────────────────────────────────────────────

interface Backup {
  name: string
  reason: string
  size: number
  created_at: string
}

export function ExportsTab() {
  const [day, setDay] = useState('all')
  const [mode, setMode] = useState('all')
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [pin, setPin] = useState('')
  const backups = useAdminData(() => api<Backup[]>('/api/admin/backups'), [])
  const days = useAdminData(() => api<{ days: string[] }>('/api/admin/dashboard?day=all'), []).data?.days ?? []
  const fail = (e: unknown) => setNote({ tone: 'error', text: (e as ApiError).message })

  return (
    <>
      {note && <Note tone={note.tone}>{note.text}</Note>}
      <SectionCard title="Exports">
        <p className="mb-3 text-sm text-muted">Download the event data. The Excel report has one sheet per table; CSV files open in Excel and Google Sheets. Rehearsal games are marked in the Games table.</p>
        <div className="flex flex-col gap-4">
          <DayModeFilter day={day} mode={mode} days={days} onDay={setDay} onMode={setMode} />
          <ExportButtons day={day} mode={mode} onError={(m) => setNote({ tone: 'error', text: m })} />
        </div>
      </SectionCard>

      <SectionCard
        title="Backups"
        actions={
          <button
            type="button"
            className="btn btn-admin min-h-0 px-4 py-2 text-sm"
            onClick={() =>
              api('/api/admin/backups', { json: {} })
                .then(() => {
                  setNote({ tone: 'ok', text: 'Backup made.' })
                  backups.reload()
                })
                .catch(fail)
            }
          >
            Back up now
          </button>
        }
      >
        <p className="mb-3 text-sm text-muted">A daily automatic backup keeps the last 14. Backups are stored in the database and download as JSON.</p>
        {!backups.data?.length ? (
          <p className="text-muted">No backups yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {backups.data.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {klDateTime(b.created_at)} · {b.reason} · {Math.max(1, Math.round(b.size / 1024))} KB
                </span>
                <button type="button" className="btn btn-light min-h-0 px-3 py-1.5 text-sm" onClick={() => download(`/api/admin/backups/${encodeURIComponent(b.name)}`).catch(fail)}>
                  <Download className="size-4" aria-hidden="true" /> Download
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Rehearsal & test data">
        <p className="mb-3 text-sm text-muted">Deletes every rehearsal or test game and its feedback. A backup is taken first. Real games are never touched.</p>
        <div className="flex flex-wrap items-end gap-3">
          <FieldLabel label="Admin PIN">
            <input type="password" inputMode="numeric" className="afield w-48" value={pin} maxLength={12} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </FieldLabel>
          <ConfirmButton
            label={
              <>
                <Trash2 className="size-4" aria-hidden="true" /> Delete rehearsal / test data
              </>
            }
            confirm="delete"
            className="btn-danger"
            disabled={pin.length < 6}
            onConfirm={() =>
              api<{ runs: number }>('/api/admin/test-data/delete', { json: { pin } })
                .then((r) => {
                  setPin('')
                  setNote({ tone: 'ok', text: `Deleted ${r.runs} rehearsal / test game(s).` })
                  backups.reload()
                })
                .catch(fail)
            }
          />
        </div>
      </SectionCard>
    </>
  )
}

// ── Audit log ───────────────────────────────────────────────────────────────

export function AuditTab() {
  const { data } = useAdminData(() => api<{ id: number; at: string; action: string; details: Record<string, unknown> }[]>('/api/admin/audit'), [])
  return (
    <SectionCard title="Audit log" bodyClass="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface">
            <tr>
              <th className={TH}>When</th>
              <th className={TH}>Action</th>
              <th className={TH}>Details</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((a) => (
              <tr key={a.id} className="border-t border-line">
                <td className={`${TD} whitespace-nowrap`}>{klDateTime(a.at)}</td>
                <td className={`${TD} font-semibold`}>{a.action.replace(/_/g, ' ')}</td>
                <td className={`${TD} font-mono text-xs text-muted`}>{Object.keys(a.details ?? {}).length ? JSON.stringify(a.details) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data && !data.length && <p className="p-5 text-muted">Nothing yet.</p>}
      </div>
    </SectionCard>
  )
}
