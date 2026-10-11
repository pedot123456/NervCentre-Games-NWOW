import type { FeedbackStatus } from '@shared/feedback'
import type { RunResult } from '@shared/types'
import { getJson } from './socket'
import type { Seat } from './useRun'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The result card. The server ends a run a moment after the device does (it times every tap
 * itself), so "not ended yet" is retried briefly. Offline: keeps trying until the connection is back.
 */
export async function fetchResult(seat: Pick<Seat, 'run_id' | 'token'>, signal?: { cancelled: boolean }): Promise<RunResult | null> {
  for (let i = 0; ; i++) {
    if (signal?.cancelled) return null
    const res = await getJson<RunResult>(`/api/runs/${seat.run_id}/result`, { headers: { 'x-run-token': seat.token } })
    if (res.ok) return res.body
    if (res.status === 404) return null
    await wait(Math.min(400 + i * 300, 3000))
  }
}

/** Waits until the score is saved, then says whether this player still has to answer today. */
export async function fetchFeedbackStatus(seat: Pick<Seat, 'run_id' | 'token'>, signal?: { cancelled: boolean }): Promise<FeedbackStatus | null> {
  for (let i = 0; ; i++) {
    if (signal?.cancelled) return null
    const res = await getJson<FeedbackStatus>(`/api/runs/${seat.run_id}/feedback`, { headers: { 'x-run-token': seat.token } })
    if (res.ok) return res.body
    if (res.status === 404) return null
    await wait(Math.min(400 + i * 300, 3000))
  }
}
