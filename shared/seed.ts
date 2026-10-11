import type { Settings, Solution } from './types'

/**
 * First-run content. Everything here is editable in Admin.
 * Clues are the examples from the brief; recap lines for SID, PTQ Online, PPM and PCC follow the
 * NWOW catalogue wording. Project AI and PDSB Services use the brief's clue text – replace with the
 * official one-liners before the event if needed.
 */
export const SEED_SOLUTIONS: Solution[] = [
  {
    id: 'sid',
    position: 1,
    name: 'Schedule Intelligent Dashboard',
    clue: 'Spots schedule delays early with smart analytics',
    description: 'Consolidates schedule health and performance to flag potential schedule concerns early.',
    decoys: ['Smart', 'Analytics', 'Tracker', 'Portal'],
  },
  {
    id: 'ptq-online',
    position: 2,
    name: 'PTQ Online',
    clue: 'Submits and tracks technical queries digitally',
    description: 'Simplifies submission, review, approval and tracking of technical queries and project changes.',
    decoys: ['Portal', 'Digital', 'System', 'Hub'],
  },
  {
    id: 'ppm',
    position: 3,
    name: 'Project Production Management',
    clue: 'Tracks site productivity and work progress',
    description: 'Plan simulations, resource optimisation and daily work control to keep site work on track.',
    decoys: ['Tracker', 'Digital', 'Hub', 'System'],
  },
  {
    id: 'project-ai',
    position: 4,
    name: 'Project AI',
    clue: 'Predicts project risks using artificial intelligence',
    description: 'Uses artificial intelligence to predict project risks before they become issues.',
    decoys: ['Smart', 'Analytics', 'Digital', 'Insight'],
  },
  {
    id: 'pdsb-services',
    position: 5,
    name: 'PDSB Services',
    clue: 'Digital services delivered by PDSB',
    description: 'Digital services delivered by PDSB for project teams.',
    decoys: ['Portal', 'Hub', 'Digital', 'Platform'],
  },
  {
    id: 'pcc',
    position: 6,
    name: 'Project Command Centre',
    clue: 'One central view to monitor and control the project',
    description: 'The single source of truth for project data – one central view to monitor and control the project.',
    decoys: ['Smart', 'Hub', 'System', 'Tracker'],
  },
]

/** Default blocked-word list (English + Malay), editable in Admin → Settings. */
export const SEED_PROFANITY: string[] = [
  'fuck*', 'shit', 'shits', 'shitty', 'bullshit*', 'shithead*', 'cunt*', 'bitch*', 'bastard*', 'asshole*',
  'ass', 'arse', 'arsehole*', 'cock', 'pussy*', 'whore*', 'slut*', 'nigger*', 'nigga*', 'fag', 'faggot*',
  'retard*', 'wanker*', 'twat*', 'bollocks*', 'porn', 'porno*', 'sex', 'sexy', 'penis', 'vagina', 'boob',
  'boobs', 'tits', 'rape', 'rapist*', 'nazi', 'hitler', 'anal', 'anus', 'dildo*', 'jerkoff*', 'blowjob*',
  'babi', 'bodoh', 'sial', 'celaka', 'bangsat', 'keparat', 'puki', 'pukimak*', 'pantat', 'lancau*', 'butoh',
  'kote', 'konek', 'pepek', 'jubur', 'haram jadah', 'anak haram', 'sundal', 'pelacur', 'lahanat', 'bangang',
  'bengap', 'kimak', 'cibai*', 'lanjiao*', 'lanjiau*', 'pundek', 'mampus', 'setan', 'jalang', 'gampang',
]

/**
 * OPUs offered when a player is from Business – in this order. Admin can edit the list.
 * "Group - Name" entries are shown under a group heading in the picker ("Downstream" → MRCSB, PC MTBE, …).
 */
export const DEFAULT_OPUS: string[] = [
  'Downstream - MRCSB',
  'Downstream - PC MTBE',
  'Downstream - PCEPE',
  'Downstream - PCFKSB',
  'Downstream - PCGCo',
  'Downstream - PCMSB',
  'Downstream - PCOGD',
  'Downstream - PDB',
  'Downstream - PETCO',
  'Downstream - PLISB',
  'Downstream - PP(T)SB',
  'Downstream - PRPC Group',
  'Gas & Maritime - MLNG',
  'Gas & Maritime - PGB GPU',
  'PE&T - GPE',
  'PE&T - PDSB',
  'PE&T - PRSB',
  'Upstream - MPM',
  'Upstream - PMA',
  'Upstream - SBA',
  'Upstream - SKA',
  'Others',
]

/** The first OPU list – migration 003 replaces it with DEFAULT_OPUS where it was saved unchanged (used by its test). */
export const PREVIOUS_DEFAULT_OPUS: string[] = [
  'Upstream',
  'Downstream',
  'Gas & Maritime',
  'Project, Engineering and Technology',
  'Malaysia Petroleum Management',
  'Finance',
  'Corporate Sustainability',
  'Group Corporate Governance & Secretarial',
]

export const DEFAULT_SETTINGS: Settings = {
  event_title: 'NWOW Digital Challenge',
  event_subtitle: 'Powering Project Delivery Through Digital',
  timer_seconds: 30,
  wrong_penalty_ms: 1000,
  skip_penalty_ms: 2000,
  hard_mode: false,
  hard_max_letters: 4,
  decoys_min: 2,
  decoys_max: 3,
  howto_seconds: 10,
  idle_seconds: 30,
  rehearsal_mode: false,
  sound_default: true,
  public_base_url: '',
  interest_question: 'Which digital solution interests you most?',
  opus: DEFAULT_OPUS,
  global_decoys: ['Smart', 'Portal', 'Hub', 'Analytics', 'Digital', 'Tracker', 'System', 'Platform', 'Insight', 'Cloud'],
  profanity: SEED_PROFANITY,
  board_reset_at: null,
  lobby_timeout_seconds: 300,
}

/** Stored settings merged over the defaults (new settings get their default automatically). */
export function withDefaults(stored: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) }
}

/** Bounds enforced by Admin (and the tests). */
export const SETTING_BOUNDS = {
  timer_seconds: [10, 120],
  wrong_penalty_ms: [0, 10_000],
  skip_penalty_ms: [0, 10_000],
  hard_max_letters: [2, 6],
  decoys_min: [0, 5],
  decoys_max: [0, 5],
  howto_seconds: [3, 30],
  idle_seconds: [10, 300],
  lobby_timeout_seconds: [60, 1800],
} as const

export const SOLUTION_COUNT = 6
export const MAX_BATTLE_PLAYERS = 4
export const COUNTDOWN_MS = 3500
