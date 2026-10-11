import type { FeedbackSubmission } from '@shared/feedback'
import { getJson, serverNow } from './socket'
import { readLocal, writeLocal } from './store'

/**
 * Feedback answers are stored on the device and resent until the server has them. The same
 * `feedback_id` is used every time, so an answer is never counted twice.
 */
const OUTBOX = 'wr.feedback.outbox.v1'

type Item = FeedbackSubmission

const load = () => readLocal<Item[]>(OUTBOX, [])
const save = (items: Item[]) => writeLocal(OUTBOX, items.length ? items : null)

async function send(item: Item): Promise<'done' | 'retry'> {
  const res = await getJson('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item) })
  if (res.ok) return 'done'
  // 4xx: the server has decided (already answered, game gone…) – resending won't help.
  if (res.status >= 400 && res.status < 500) return 'done'
  return 'retry'
}

/** Queues an answer and tries to send it. Resolves true when the server has it (or refused it for good). */
export async function submitFeedback(answer: Omit<Item, 'answered_at'>): Promise<boolean> {
  const item: Item = { ...answer, answered_at: serverNow() }
  save([...load().filter((i) => i.feedback_id !== item.feedback_id), item])
  const res = await send(item)
  if (res === 'done') save(load().filter((i) => i.feedback_id !== item.feedback_id))
  return res === 'done'
}

let syncing = false
async function flush() {
  if (syncing) return
  syncing = true
  try {
    for (const item of load()) {
      if ((await send(item)) === 'done') save(load().filter((i) => i.feedback_id !== item.feedback_id))
    }
  } finally {
    syncing = false
  }
}

export function startFeedbackSync() {
  void flush()
  window.addEventListener('online', () => void flush())
  setInterval(() => {
    if (load().length) void flush()
  }, 15_000)
}
