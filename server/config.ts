import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pinPolicyError } from '@shared/admin'

// .env.local, then .env (Node 20.12+). Real environment variables win over both.
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile?.(file)
  } catch {
    /* file not present – defaults apply */
  }
}

function defaultDataDir(): string {
  // Keep the live database out of OneDrive/synced folders: syncing open database files corrupts them.
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return path.join(process.env.LOCALAPPDATA, 'NervCentre Games NWOW', 'data')
  }
  return path.resolve('data')
}

export interface ServerConfig {
  port: number
  host: string
  /** Empty = embedded PostgreSQL (PGlite) in `dataDir`; set to use a PostgreSQL server (Supabase). */
  databaseUrl: string
  dataDir: string
  adminDefaultPin: string
  clientDist: string
  appVersion: string
  logLevel: string
  /** When set, saved to the `public_base_url` setting at start-up (address in the join QR code). */
  publicBaseUrl: string | null
}

function readVersion(): string {
  try {
    return JSON.parse(readFileSync('package.json', 'utf8')).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export function loadConfig(): ServerConfig {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  return {
    port: Number(process.env.PORT ?? 8090),
    host: process.env.HOST ?? '0.0.0.0',
    databaseUrl: process.env.DATABASE_URL ?? '',
    dataDir: process.env.DATA_DIR || defaultDataDir(),
    adminDefaultPin: process.env.ADMIN_DEFAULT_PIN || '1234',
    clientDist: path.resolve(process.env.CLIENT_DIST || 'dist/client'),
    // APP_VERSION is baked into the Vercel bundle (package.json is not shipped with the function).
    appVersion: process.env.APP_VERSION || readVersion(),
    logLevel: process.env.LOG_LEVEL ?? 'warn',
    // On Vercel the production address is known – phones join through it.
    publicBaseUrl: process.env.PUBLIC_BASE_URL?.trim() || (vercelUrl ? `https://${vercelUrl}` : null),
  }
}

/**
 * Settings that would lose data or leave Admin open on a public host. On Vercel (VERCEL is set):
 * there is no lasting disk, so a PostgreSQL DATABASE_URL (Supabase) is required; and the first-login
 * PIN must not be the well-known default, or anyone could claim Admin first.
 */
export function cloudProblems(config: ServerConfig, env: NodeJS.ProcessEnv = process.env): string[] {
  if (!env.VERCEL) return []
  const problems: string[] = []
  if (!config.databaseUrl) {
    problems.push('DATABASE_URL is not set. Vercel has no lasting disk, so every game and answer would be lost. Set DATABASE_URL to your Supabase connection string (Transaction pooler) – see README.')
  }
  const pinProblem = pinPolicyError(env.ADMIN_DEFAULT_PIN ?? '')
  if (pinProblem) {
    problems.push(`ADMIN_DEFAULT_PIN must be your own first-login PIN, not 1234 (${pinProblem}): on a public address the first person to sign in with it would take over Admin.`)
  }
  return problems
}
