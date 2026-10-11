import { readSession, writeSession } from '../lib/store'

const TOKEN = 'wr.admin.token'

export const getToken = () => readSession<string | null>(TOKEN, null)
export const setToken = (t: string | null) => writeSession(TOKEN, t)

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

/** Admin API call with the session token. Throws ApiError (401 signs out). */
export async function api<T>(path: string, opts: { method?: string; json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.authorization = `Bearer ${token}`
  if (opts.json !== undefined) headers['content-type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(path, { method: opts.method ?? (opts.json !== undefined ? 'POST' : 'GET'), headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined, cache: 'no-store' })
  } catch {
    throw new ApiError(0, 'offline', 'No connection to the server.')
  }
  const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event('wr-admin-signed-out'))
    throw new ApiError(res.status, body?.error ?? 'error', body?.message ?? 'Something went wrong.')
  }
  return body as T
}

/** Downloads a file from an Admin endpoint (the token goes in a header, so a plain link can't be used). */
export async function download(path: string): Promise<void> {
  const token = getToken()
  const res = await fetch(path, { headers: token ? { authorization: `Bearer ${token}` } : {}, cache: 'no-store' })
  if (!res.ok) {
    const body = res.headers.get('content-type')?.includes('json') ? await res.json() : null
    throw new ApiError(res.status, body?.error ?? 'error', body?.message ?? 'Download failed.')
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? 'download'
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "6 Oct 2026, 7:10 am" in Kuala Lumpur time. */
export function klDateTime(iso: string | number): string {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000)
  const h = d.getUTCHours()
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

/** "6 Oct 2026" for a KL day key. */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`)
