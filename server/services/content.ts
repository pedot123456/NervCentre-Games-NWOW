import { z } from 'zod'
import { answerWords } from '@shared/puzzle'
import { SETTING_BOUNDS } from '@shared/seed'
import type { Settings, Solution } from '@shared/types'
import { cleanText } from '@shared/validation'
import { httpError } from './errors'

const bounded = (key: keyof typeof SETTING_BOUNDS) => z.number().int().min(SETTING_BOUNDS[key][0]).max(SETTING_BOUNDS[key][1])
const words = (max: number) => z.array(z.string().max(60)).max(max)

/** What Admin may change (every field optional). */
const settingsPatch = z
  .object({
    event_title: z.string().max(60),
    event_subtitle: z.string().max(80),
    timer_seconds: bounded('timer_seconds'),
    wrong_penalty_ms: bounded('wrong_penalty_ms'),
    skip_penalty_ms: bounded('skip_penalty_ms'),
    hard_mode: z.boolean(),
    hard_max_letters: bounded('hard_max_letters'),
    decoys_min: bounded('decoys_min'),
    decoys_max: bounded('decoys_max'),
    howto_seconds: bounded('howto_seconds'),
    idle_seconds: bounded('idle_seconds'),
    rehearsal_mode: z.boolean(),
    sound_default: z.boolean(),
    public_base_url: z.string().max(200),
    interest_question: z.string().max(200),
    opus: z.array(z.string().max(200)).max(40),
    global_decoys: words(100),
    profanity: z.array(z.string().max(60)).max(2000),
    lobby_timeout_seconds: bounded('lobby_timeout_seconds'),
  })
  .partial()
  .strict()

/** Validates and cleans an Admin settings change against the current settings. */
export function checkSettings(raw: unknown, current: Settings): Partial<Settings> {
  const parsed = settingsPatch.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw httpError(400, 'invalid_settings', `${first?.path.join('.') || 'value'}: ${first?.message ?? 'invalid'}`)
  }
  const p: Partial<Settings> = { ...parsed.data }
  const min = p.decoys_min ?? current.decoys_min
  const max = p.decoys_max ?? current.decoys_max
  if (min > max) throw httpError(400, 'invalid_settings', 'Decoys per round: the minimum cannot be more than the maximum.')
  if (p.event_title !== undefined) {
    p.event_title = cleanText(p.event_title)
    if (!p.event_title) throw httpError(400, 'invalid_settings', 'The home page title cannot be empty.')
  }
  if (p.event_subtitle !== undefined) p.event_subtitle = cleanText(p.event_subtitle)
  if (p.opus !== undefined) {
    const list = p.opus.map(cleanText).filter(Boolean)
    if (!list.length) throw httpError(400, 'invalid_settings', 'The OPU list needs at least one entry.')
    const seen = new Set<string>()
    for (const o of list) {
      if (o.length < 2 || o.length > 80) throw httpError(400, 'invalid_settings', `OPU "${o}": use 2 to 80 characters.`)
      const k = o.toLowerCase()
      if (seen.has(k)) throw httpError(400, 'invalid_settings', `OPU "${o}" is listed twice.`)
      seen.add(k)
    }
    p.opus = list
  }
  if (p.global_decoys !== undefined) p.global_decoys = [...new Set(p.global_decoys.map(cleanText).filter(Boolean))]
  if (p.profanity !== undefined) p.profanity = [...new Set(p.profanity.map((w) => cleanText(w).toLowerCase()).filter(Boolean))]
  if (p.public_base_url !== undefined) {
    const url = p.public_base_url.trim().replace(/\/+$/, '')
    if (url && !/^https?:\/\/[^\s/]+(:\d+)?(\/.*)?$/i.test(url)) throw httpError(400, 'invalid_settings', 'The network address must start with http:// or https://')
    p.public_base_url = url
  }
  return p
}

const solutionSchema = z.object({
  id: z.string().min(1).max(60),
  position: z.number().int().min(1).max(20),
  name: z.string().max(60),
  clue: z.string().max(140),
  description: z.string().max(220),
  decoys: z.array(z.string().max(60)).max(30),
})

/** Validates the six solutions; decoys that repeat an answer word are dropped. */
export function checkSolutions(raw: unknown, existing: Solution[]): Solution[] {
  const parsed = z.array(solutionSchema).min(1).max(20).safeParse(raw)
  if (!parsed.success) throw httpError(400, 'invalid_solutions', 'Check the solutions: every field is required.')
  const ids = new Set(existing.map((s) => s.id))
  const names = new Set<string>()
  return parsed.data.map((s) => {
    if (!ids.has(s.id)) throw httpError(400, 'invalid_solutions', 'Unknown solution.')
    const name = cleanText(s.name)
    const clue = cleanText(s.clue)
    if (!answerWords(name).length) throw httpError(400, 'invalid_solutions', `Star ${s.position}: the name is required.`)
    if (!clue) throw httpError(400, 'invalid_solutions', `Star ${s.position}: the clue is required.`)
    const key = name.toLowerCase()
    if (names.has(key)) throw httpError(400, 'invalid_solutions', `"${name}" is used twice – every solution needs its own name.`)
    names.add(key)
    const answer = new Set(answerWords(name).map((w) => w.toLowerCase()))
    const seen = new Set<string>()
    const decoys = s.decoys.map(cleanText).filter((d) => {
      const k = d.toLowerCase()
      if (!d || answer.has(k) || seen.has(k)) return false
      seen.add(k)
      return true
    })
    return { id: s.id, position: s.position, name, clue, description: cleanText(s.description), decoys }
  })
}
