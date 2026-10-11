import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { answerWords, usableDecoys } from '@shared/puzzle'
import { SETTING_BOUNDS } from '@shared/seed'
import type { Puzzle, Settings, Solution } from '@shared/types'
import { loadConfig } from '../lib/data'
import { api, ApiError } from './api'
import { FieldLabel, Note, SectionCard, Toggle, useAdminData } from './shared'

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// ── Solutions & decoys ──────────────────────────────────────────────────────

export function ContentSolutions() {
  const { data, setData } = useAdminData(() => api<Solution[]>('/api/admin/solutions'), [])
  const settings = useAdminData(() => api<Settings>('/api/admin/settings'), []).data
  const [draft, setDraft] = useState<(Solution & { decoysText: string })[]>([])
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState<{ hard: boolean; puzzles: Puzzle[] } | null>(null)

  useEffect(() => {
    if (data) setDraft(data.map((s) => ({ ...s, decoysText: s.decoys.join(', ') })))
  }, [data])

  const update = (i: number, patch: Partial<Solution & { decoysText: string }>) => setDraft((d) => d.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const save = async () => {
    try {
      const saved = await api<Solution[]>('/api/admin/solutions', { method: 'PUT', json: draft.map(({ decoysText, ...s }) => ({ ...s, decoys: list(decoysText) })) })
      setData(saved)
      setNote({ tone: 'ok', text: 'Solutions saved – the next game uses them.' })
      void loadConfig()
    } catch (e) {
      setNote({ tone: 'error', text: (e as ApiError).message })
    }
  }
  const loadPreview = async (hard: boolean) => {
    setPreview({ hard, puzzles: await api<Puzzle[]>(`/api/admin/preview?hard=${hard ? 1 : 0}`) })
  }

  return (
    <>
      <SectionCard
        title="Solutions & decoys"
        actions={
          <button type="button" className="btn btn-admin min-h-0 px-4 py-2 text-sm" onClick={save}>
            <Save className="size-4" aria-hidden="true" /> Save solutions
          </button>
        }
      >
        <p className="text-sm text-muted">
          The answer is the solution name, split into word tiles. Each round picks {settings?.decoys_min ?? 2}–{settings?.decoys_max ?? 3} decoys – first from the solution's own list, then from the global decoys in Settings. A decoy that is one of the
          solution's own words is dropped automatically.
        </p>
        {note && (
          <Note tone={note.tone} className="mt-3">
            {note.text}
          </Note>
        )}
      </SectionCard>
      <div className="grid gap-4 xl:grid-cols-2" data-testid="solutions-tab">
        {draft.map((s, i) => {
          const usable = usableDecoys({ name: s.name, decoys: list(s.decoysText) }, [])
          const need = settings?.decoys_max ?? 3
          return (
            <section key={s.id} className="card flex flex-col gap-3 p-5">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-nc-blue">
                {CIRCLED[i] ?? i + 1} Star {s.position}
              </p>
              <FieldLabel label="Name (the answer)">
                <input className="afield" maxLength={60} value={s.name} onChange={(e) => update(i, { name: e.target.value })} />
              </FieldLabel>
              <FieldLabel label="Clue (shown in the game)">
                <input className="afield" maxLength={140} value={s.clue} onChange={(e) => update(i, { clue: e.target.value })} />
              </FieldLabel>
              <FieldLabel label="Recap line (results screen)">
                <textarea className="afield" rows={2} maxLength={220} value={s.description} onChange={(e) => update(i, { description: e.target.value })} />
              </FieldLabel>
              <FieldLabel label="Decoy words (comma-separated)">
                <input className="afield" value={s.decoysText} onChange={(e) => update(i, { decoysText: e.target.value })} />
              </FieldLabel>
              <p className={`text-xs ${usable.own.length >= need ? 'text-[#00726e]' : 'text-[#7a5200]'}`}>
                {usable.own.length >= need ? `${usable.own.length} usable decoys.` : `Only ${usable.own.length} usable – global decoys fill the rest.`}
              </p>
            </section>
          )
        })}
      </div>
      <SectionCard
        title="Preview a round"
        actions={
          <>
            <button type="button" className={`btn min-h-0 px-4 py-2 text-sm ${preview && !preview.hard ? 'btn-admin' : 'btn-light'}`} onClick={() => void loadPreview(false)}>
              Word tiles
            </button>
            <button type="button" className={`btn min-h-0 px-4 py-2 text-sm ${preview?.hard ? 'btn-admin' : 'btn-light'}`} onClick={() => void loadPreview(true)}>
              Hard Mode
            </button>
          </>
        }
      >
        {!preview ? (
          <p className="text-sm text-muted">Pick a preview to see one random round with the saved solutions.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {preview.puzzles.map((p) => {
              const answer = new Set(p.answer.map((a) => a.text))
              return (
                <div key={p.solution_id} className="rounded-xl border border-line p-3">
                  <p className="font-semibold">{p.clue}</p>
                  <div className="my-2 flex flex-wrap gap-1.5">
                    {p.tiles.map((t) => (
                      <span key={t.id} className={`rounded-md px-2 py-1 text-sm font-bold ${answer.has(t.text) ? 'bg-nc-green/15 text-[#00726e]' : 'bg-[#eef1f5] text-muted'}`}>
                        {t.text}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted">Answer: {answerWords(p.name).join(' ')}</p>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </>
  )
}

// ── Settings ────────────────────────────────────────────────────────────────

type Draft = Settings & { global_decoys_text: string; opus_text: string; profanity_text: string }

export function ContentSettings() {
  const { data, setData } = useAdminData(() => api<Settings>('/api/admin/settings'), [])
  const [d, setD] = useState<Draft | null>(null)
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string; where: string } | null>(null)

  useEffect(() => {
    if (data) setD({ ...data, global_decoys_text: data.global_decoys.join(', '), opus_text: data.opus.join('\n'), profanity_text: data.profanity.join('\n') })
  }, [data])

  if (!d) return null
  const set = (patch: Partial<Draft>) => setD((x) => (x ? { ...x, ...patch } : x))
  const save = async (where: string, patch: Partial<Settings>) => {
    try {
      const saved = await api<Settings>('/api/admin/settings', { method: 'PUT', json: patch })
      setData(saved)
      setNote({ tone: 'ok', where, text: 'Saved.' })
      void loadConfig()
    } catch (e) {
      setNote({ tone: 'error', where, text: (e as ApiError).message })
    }
  }
  const num = (key: keyof typeof SETTING_BOUNDS, label: string, scale = 1, hint?: string) => {
    const [lo, hi] = SETTING_BOUNDS[key]
    return (
      <FieldLabel label={label}>
        <input
          type="number"
          className="afield"
          min={lo / scale}
          max={hi / scale}
          step={scale === 1000 ? 0.5 : 1}
          value={(d[key] as number) / scale}
          onChange={(e) => set({ [key]: Math.round(Number(e.target.value) * scale) } as Partial<Draft>)}
        />
        {hint && <span className="text-xs normal-case tracking-normal text-muted">{hint}</span>}
      </FieldLabel>
    )
  }
  const msg = (where: string) =>
    note?.where === where && (
      <Note tone={note.tone} className="mt-3">
        {note.text}
      </Note>
    )

  return (
    <>
      {data?.rehearsal_mode && <Note tone="warn">Rehearsal mode is on: games are saved as test data and never reach the boards or statistics.</Note>}

      <SectionCard
        title="Game rules"
        actions={
          <button
            type="button"
            className="btn btn-admin min-h-0 px-4 py-2 text-sm"
            onClick={() =>
              void save('rules', {
                timer_seconds: d.timer_seconds,
                wrong_penalty_ms: d.wrong_penalty_ms,
                skip_penalty_ms: d.skip_penalty_ms,
                hard_mode: d.hard_mode,
                hard_max_letters: d.hard_max_letters,
                decoys_min: d.decoys_min,
                decoys_max: d.decoys_max,
                global_decoys: list(d.global_decoys_text),
              })
            }
          >
            <Save className="size-4" aria-hidden="true" /> Save settings
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {num('timer_seconds', 'Timer (seconds)', 1, '10–120, default 30')}
          {num('wrong_penalty_ms', 'Wrong tile penalty (s)', 1000, 'default 1')}
          {num('skip_penalty_ms', 'Skip penalty (s)', 1000, 'default 2')}
          <div className="md:col-span-3">
            <Toggle label="Hard Mode" checked={d.hard_mode} onChange={(v) => set({ hard_mode: v })} hint="short words (e.g. PTQ, AI, PDSB) become letter tiles" />
          </div>
          {num('hard_max_letters', 'Hard Mode: letter tiles for words up to', 1, '2–6, default 4')}
          {num('decoys_min', 'Decoys per round – minimum', 1, '0–5')}
          {num('decoys_max', 'Decoys per round – maximum', 1, '0–5')}
          <FieldLabel label="Global decoy words" className="md:col-span-3">
            <input className="afield" value={d.global_decoys_text} onChange={(e) => set({ global_decoys_text: e.target.value })} />
            <span className="text-xs normal-case tracking-normal text-muted">comma-separated</span>
          </FieldLabel>
        </div>
        {msg('rules')}
      </SectionCard>

      <SectionCard
        title="Event & screens"
        actions={
          <button
            type="button"
            className="btn btn-admin min-h-0 px-4 py-2 text-sm"
            onClick={() =>
              void save('event', {
                rehearsal_mode: d.rehearsal_mode,
                sound_default: d.sound_default,
                event_title: d.event_title,
                event_subtitle: d.event_subtitle,
                howto_seconds: d.howto_seconds,
                idle_seconds: d.idle_seconds,
                lobby_timeout_seconds: d.lobby_timeout_seconds,
                public_base_url: d.public_base_url,
              })
            }
          >
            <Save className="size-4" aria-hidden="true" /> Save settings
          </button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Toggle label="Rehearsal mode" checked={d.rehearsal_mode} onChange={(v) => set({ rehearsal_mode: v })} />
          <Toggle label="Sound on by default" checked={d.sound_default} onChange={(v) => set({ sound_default: v })} />
          <FieldLabel label="Home page title">
            <input className="afield" maxLength={60} value={d.event_title} onChange={(e) => set({ event_title: e.target.value })} />
          </FieldLabel>
          <FieldLabel label="Subtitle">
            <input className="afield" maxLength={80} value={d.event_subtitle} onChange={(e) => set({ event_subtitle: e.target.value })} />
          </FieldLabel>
          {num('howto_seconds', 'How to Play (seconds)', 1, '3–30')}
          {num('idle_seconds', 'Back to start after (seconds idle)', 1, '10–300')}
          {num('lobby_timeout_seconds', 'Close idle battle lobby after (s)', 1, '60–1800')}
          <FieldLabel label="Network address for the phone join QR code">
            <input className="afield" placeholder="e.g. http://10.1.2.3:8090" value={d.public_base_url} onChange={(e) => set({ public_base_url: e.target.value })} />
          </FieldLabel>
        </div>
        {msg('event')}
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="OPU list (registration)"
          actions={
            <button type="button" className="btn btn-admin min-h-0 px-4 py-2 text-sm" onClick={() => void save('opus', { opus: d.opus_text.split('\n').map((x) => x.trim()).filter(Boolean) })}>
              <Save className="size-4" aria-hidden="true" /> Save list
            </button>
          }
        >
          <p className="mb-2 text-sm text-muted">One per line. Use "Group - Name" to show it under a group heading. 2–80 characters each, no repeats, up to 40 lines.</p>
          <textarea className="afield" rows={14} value={d.opus_text} onChange={(e) => set({ opus_text: e.target.value })} />
          {msg('opus')}
        </SectionCard>
        <SectionCard
          title="Blocked words (names & project names)"
          actions={
            <button type="button" className="btn btn-admin min-h-0 px-4 py-2 text-sm" onClick={() => void save('profanity', { profanity: d.profanity_text.split('\n').map((x) => x.trim()).filter(Boolean) })}>
              <Save className="size-4" aria-hidden="true" /> Save list
            </button>
          }
        >
          <p className="mb-2 text-sm text-muted">"word" blocks the whole word; "word*" also blocks it inside other words.</p>
          <textarea className="afield font-mono text-sm" rows={14} value={d.profanity_text} onChange={(e) => set({ profanity_text: e.target.value })} />
          {msg('profanity')}
        </SectionCard>
      </div>
    </>
  )
}
