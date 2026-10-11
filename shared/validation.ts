/**
 * Registration rules: full name, "You are from" Project, Business or Contractor, then the project name
 * (free text), the OPU (from the Admin-editable list, or typed in under "Others") or the company name
 * (free text), plus PDPA consent.
 * Shared so the kiosk, the phones and the server apply exactly the same rules;
 * the server is authoritative and also runs the blocked-word check.
 */

export const LIMITS = {
  name: { min: 2, max: 60 },
  project: { min: 2, max: 80 },
} as const

export type AffiliationType = 'project' | 'business' | 'contractor'

export const AFFILIATION_TYPES: readonly AffiliationType[] = ['project', 'business', 'contractor']

export const AFFILIATION_LABELS: Record<AffiliationType, string> = {
  project: 'Project',
  business: 'Business',
  contractor: 'Contractor',
}

export const MESSAGES = {
  name: 'Please enter your full name.',
  affiliation: 'Please select Project, Business or Contractor.',
  project: 'Please enter your project name.',
  company: 'Please enter your company name.',
  opu: 'Please select your OPU.',
  opu_other: 'Please enter your OPU name.',
  consent: 'Please tick the consent box to continue.',
} as const

export const CONSENT_TEXT = 'I agree my name and project/OPU/company will be recorded for this event and shown on the leaderboard.'

export type Field = 'full_name' | 'affiliation_type' | 'project_name' | 'opu' | 'consent'
export type FieldErrors = Partial<Record<Field, string>>

/** What a device sends when a player registers. */
export interface PlayerInput {
  full_name: string
  affiliation_type: AffiliationType | null
  project_name: string | null
  opu: string | null
  consent: boolean
}

/**
 * A checked registration, ready to store. Exactly one of project_name / opu is set:
 * project_name holds the project name (Project) or the company name (Contractor).
 */
export interface Registration {
  full_name: string
  affiliation_type: AffiliationType
  project_name: string | null
  opu: string | null
}

/** NFC, trimmed, single spaces. */
export function cleanText(raw: unknown): string {
  return String(raw ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Full names: 2–60 characters of letters (any script, accents included), spaces, apostrophes,
 * hyphens and periods. "bin" / "binti" are ordinary words; "a/l" and "a/p" are the only places a
 * slash is allowed. Digits and other symbols are not, so numbers-only and symbols-only entries fail.
 */
export function checkFullName(raw: unknown, profanity: readonly string[] = []): { ok: true; value: string } | { ok: false } {
  const value = cleanText(raw)
  if (value.length < LIMITS.name.min || value.length > LIMITS.name.max) return { ok: false }
  const withoutPatronymic = value.replace(/(^|\s)a\/[lp](?=\s|$)/giu, '$1')
  if (!/^[\p{L}\p{M}\s'’.\-]+$/u.test(withoutPatronymic)) return { ok: false }
  if ((value.match(/\p{L}/gu) ?? []).length < 2) return { ok: false }
  if (profanity.length && containsProfanity(value, profanity)) return { ok: false }
  return { ok: true, value }
}

/** Project names: 2–80 characters with at least one letter; digits and common punctuation allowed ("PFLNG 3", "Kasawari CCS"). */
export function checkProjectName(raw: unknown, profanity: readonly string[] = []): { ok: true; value: string } | { ok: false } {
  const value = cleanText(raw)
  if (value.length < LIMITS.project.min || value.length > LIMITS.project.max) return { ok: false }
  if (!/\p{L}/u.test(value) || !/^[\p{L}\p{M}\p{N}\s'’.\-\/&(),+#:]+$/u.test(value)) return { ok: false }
  if (profanity.length && containsProfanity(value, profanity)) return { ok: false }
  return { ok: true, value }
}

/** The OPU exactly as written in the list (matching ignores case and spacing). */
export function matchOpu(raw: unknown, opus: readonly string[]): string | null {
  const v = cleanText(raw).toLowerCase()
  if (!v) return null
  return opus.find((o) => cleanText(o).toLowerCase() === v) ?? null
}

/** The "Others" / "Other" entry of the OPU list: picking it asks the player to type their OPU. */
export const isOtherOpu = (raw: unknown): boolean => /^others?$/i.test(cleanText(raw))

/**
 * The OPU a player gave: an entry of the list, or (after picking "Others") an OPU typed in,
 * checked like a project name. "Others" on its own is not an answer.
 */
export function checkOpu(raw: unknown, opus: readonly string[], profanity: readonly string[] = []): { ok: true; value: string } | { ok: false; message: string } {
  if (!cleanText(raw)) return { ok: false, message: MESSAGES.opu }
  const listed = matchOpu(raw, opus)
  if (listed && !isOtherOpu(listed)) return { ok: true, value: listed }
  if (isOtherOpu(raw)) return { ok: false, message: MESSAGES.opu_other }
  const typed = checkProjectName(raw, profanity)
  return typed.ok ? typed : { ok: false, message: MESSAGES.opu_other }
}

export type RegistrationCheck = { ok: true; value: Registration } | { ok: false; errors: FieldErrors; field: Field; message: string }

/**
 * Checks every field at once (for inline errors under each field). `field`/`message` is the first problem.
 * Leave `profanity` empty on devices – the server adds the blocked-word check.
 */
export function checkRegistration(p: Partial<PlayerInput> | null | undefined, opus: readonly string[], profanity: readonly string[] = [], opts: { requireConsent?: boolean } = {}): RegistrationCheck {
  const errors: FieldErrors = {}
  const name = checkFullName(p?.full_name, profanity)
  if (!name.ok) errors.full_name = MESSAGES.name
  const type = AFFILIATION_TYPES.find((t) => t === p?.affiliation_type) ?? null
  if (!type) errors.affiliation_type = MESSAGES.affiliation
  let project: string | null = null
  let opu: string | null = null
  if (type === 'project' || type === 'contractor') {
    const pr = checkProjectName(p?.project_name, profanity)
    if (pr.ok) project = pr.value
    else errors.project_name = type === 'project' ? MESSAGES.project : MESSAGES.company
  } else if (type === 'business') {
    const o = checkOpu(p?.opu, opus, profanity)
    if (o.ok) opu = o.value
    else errors.opu = o.message
  }
  if (opts.requireConsent !== false && p?.consent !== true) errors.consent = MESSAGES.consent
  const order: Field[] = ['full_name', 'affiliation_type', 'project_name', 'opu', 'consent']
  const first = order.find((f) => errors[f])
  if (first) return { ok: false, errors, field: first, message: errors[first]! }
  return { ok: true, value: { full_name: name.ok ? name.value : '', affiliation_type: type!, project_name: project, opu } }
}

/** Project name, OPU or company name – what the leaderboards show in the "Project / OPU" column. */
export function affiliationOf(r: { affiliation_type: AffiliationType; project_name: string | null; opu: string | null }): string {
  return (r.affiliation_type === 'business' ? r.opu : r.project_name) ?? ''
}

// ── Profanity ───────────────────────────────────────────────────────────────

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' }

/** Lower-case, accents removed (Latin only – other scripts are kept intact), leetspeak undone. */
function fold(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[0134578@$!|+]/g, (ch) => LEET[ch] ?? ch)
}

/** "fuuuck" → "fuck" */
const squeeze = (s: string) => s.replace(/(\p{L})\1+/gu, '$1')

/**
 * True when the text contains a blocked word.
 * - "word"  blocks the whole word only (so "Rashitah" is not caught by "shit").
 * - "word*" also blocks the word inside other words / joined-up text.
 * - Multi-word entries ("anak haram") block that phrase.
 */
export function containsProfanity(text: string, words: readonly string[]): boolean {
  const tokens = fold(text)
    .split(/[^\p{L}\p{M}]+/u)
    .filter(Boolean)
  if (!tokens.length) return false
  const variants = [tokens, tokens.map(squeeze)]
  for (const entry of words) {
    const raw = fold(entry.trim())
    if (!raw) continue
    const inside = raw.endsWith('*')
    const phrase = raw
      .replace(/\*+$/, '')
      .split(/[^\p{L}\p{M}]+/u)
      .filter(Boolean)
    if (!phrase.length) continue
    for (const toks of variants) {
      const joined = ` ${toks.join(' ')} `
      const compact = toks.join('')
      for (const p of [phrase, phrase.map(squeeze)]) {
        if (inside) {
          if (compact.includes(p.join(''))) return true
        } else if (joined.includes(` ${p.join(' ')} `)) {
          return true
        }
      }
    }
  }
  return false
}

// ── Identity ────────────────────────────────────────────────────────────────

/** Case-, accent- and spacing-insensitive form used to recognise returning players. */
export function nameKey(s: string): string {
  return cleanText(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
}
