import { useState, type ReactNode } from 'react'
import { BarChart3, Table2 } from 'lucide-react'

/** Plain HTML/CSS charts for Admin. Every chart has a Table view of the same data. */

export const SERIES = '#3f86e6'
const NICE = [1, 2, 5]

/** A "nice" axis maximum: 1, 2 or 5 × 10ⁿ at or above the value. */
export function niceMax(v: number): number {
  if (v <= 0) return 1
  const exp = Math.floor(Math.log10(v))
  for (let e = exp; e <= exp + 1; e++) for (const n of NICE) if (n * 10 ** e >= v) return n * 10 ** e
  return 10 ** (exp + 1)
}

function Empty() {
  return <div className="grid h-40 place-items-center rounded-xl border border-dashed border-line text-muted">No data for these filters.</div>
}

export function ChartCard({ title, subtitle, table, children }: { title: string; subtitle?: string; table: ReactNode; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false)
  return (
    <section className="card flex flex-col p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[1.05rem] font-extrabold">{title}</h3>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <button type="button" className="btn btn-light min-h-0 gap-1.5 px-2.5 py-1 text-xs font-semibold" onClick={() => setAsTable((v) => !v)}>
          {asTable ? <BarChart3 className="size-3.5" aria-hidden="true" /> : <Table2 className="size-3.5" aria-hidden="true" />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </header>
      <div className="flex-1">{asTable ? table : children}</div>
    </section>
  )
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <Empty />
  return (
    <div className="max-h-[22rem] overflow-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted ${i ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-1.5 ${j ? 'text-right tabular-nums' : ''}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Tooltip on hover / keyboard focus. */
function Tip({ value, label, children }: { value: ReactNode; label: ReactNode; children: ReactNode }) {
  return (
    <div className="group relative flex h-full flex-col justify-end" tabIndex={0}>
      {children}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs shadow-lg group-hover:block group-focus:block">
        <b>{value}</b> <span className="text-muted">{label}</span>
      </div>
    </div>
  )
}

/** Column chart: 180 px, 3 y-ticks, columns max 24 px with rounded tops, value label on the peak only. */
export function ColumnChart({ data, unit = '' }: { data: { label: string; value: number; tip?: string }[]; unit?: string }) {
  if (!data.length || data.every((d) => d.value === 0)) return <Empty />
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const peak = Math.max(...data.map((d) => d.value))
  const ticks = [...new Set([max, Math.round(max / 2), 0])]
  return (
    <div className="flex gap-2">
      <div className="flex h-[180px] w-8 flex-col justify-between text-right text-[11px] text-muted">
        {ticks.map((t) => (
          <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
            {t}
          </span>
        ))}
      </div>
      <div className="flex-1">
        <div className="relative h-[180px]">
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-[#e4e8ee]" style={{ bottom: `${(t / max) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => {
              const showPeak = d.value === peak && data.findIndex((x) => x.value === peak) === i
              return (
                <div key={i} className="flex h-full flex-1 justify-center">
                  <Tip value={`${d.value}${unit}`} label={d.tip ?? d.label}>
                    <div className="relative w-[24px] max-w-full">
                      {showPeak && <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-xs font-bold">{d.value}</span>}
                      <div className="rounded-t" style={{ height: `${(d.value / max) * 180}px`, background: SERIES }} />
                    </div>
                  </Tip>
                </div>
              )
            })}
          </div>
        </div>
        <div className="mt-1 flex gap-[2px] text-center text-[11px] text-muted">
          {data.map((d, i) => (
            <span key={i} className="flex-1 truncate">
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Horizontal bars: label column, 20 px bar with a rounded end, value + note on the right. */
export function Bars({ data, max: forcedMax, format = (v) => String(v), color = SERIES }: { data: { label: string; value: number; note?: string }[]; max?: number; format?: (v: number) => string; color?: string }) {
  if (!data.length) return <Empty />
  const max = forcedMax ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex flex-col gap-2">
      {data.map((d, i) => (
        <div key={i} className="grid grid-cols-[minmax(8rem,14rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate font-semibold" title={d.label}>
            {d.label}
          </span>
          <div className="h-5">
            <div className="h-5 rounded-r" style={{ width: `${(d.value / max) * 100}%`, background: color }} title={`${format(d.value)} ${d.label}`} />
          </div>
          <span className="whitespace-nowrap text-right text-xs">
            <b className="text-sm">{format(d.value)}</b> {d.note && <span className="text-muted">{d.note}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Split bar (28 px, 2 px gaps) with a legend of swatch + label + "N · %". */
export function SplitBar({ parts }: { parts: { label: string; value: number; color: string; icon?: ReactNode }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (!total) return <Empty />
  return (
    <div>
      <div className="flex h-7 gap-[2px] overflow-hidden rounded">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${p.value}`} />
          ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: p.color }} />
            {p.icon}
            <b className="font-semibold">{p.label}</b>
            <span className="text-muted">
              {p.value} · {Math.round((p.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Donut (168 px, stroke 24, 2 px gaps) with a big % in the middle. */
export function Donut({ parts, center, centerLabel }: { parts: { label: string; value: number; color: string }[]; center: string; centerLabel: string }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (!total) return <Empty />
  const r = 72
  const c = 2 * Math.PI * r
  let offset = 0
  const gap = parts.filter((p) => p.value > 0).length > 1 ? 2 : 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-[168px]">
        <svg viewBox="0 0 168 168" className="size-full -rotate-90">
          {parts.map((p) => {
            const len = (p.value / total) * c
            const el = <circle key={p.label} cx="84" cy="84" r={r} fill="none" stroke={p.color} strokeWidth="24" strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-offset} />
            offset += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-3xl font-extrabold">{center}</p>
            <p className="text-xs text-muted">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className="size-3 rounded-sm" style={{ background: p.color }} />
            <b>{p.label}</b>
            <span className="text-muted">
              {p.value} · {Math.round((p.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
