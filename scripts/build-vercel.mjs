// Packages the app for Vercel using the Build Output API (https://vercel.com/docs/build-output-api):
//   .vercel/output/static/          the built website (from `vite build`), served from Vercel's CDN
//   .vercel/output/functions/api.func  the whole Fastify API bundled into one serverless function
// Run via `npm run build:vercel` (which runs `npm run build` first).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

// Singapore, next to the Supabase project (create it in "Southeast Asia (Singapore)").
const REGION = process.env.VERCEL_FUNCTION_REGION || 'sin1'

const out = '.vercel/output'
const fn = `${out}/functions/api.func`
if (!existsSync('dist/client/index.html')) throw new Error('dist/client is missing - run `npm run build` first.')

rmSync(out, { recursive: true, force: true })
mkdirSync(fn, { recursive: true })
cpSync('dist/client', `${out}/static`, { recursive: true })

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Never loaded on Vercel: PGlite is only used without DATABASE_URL, @fastify/static only when
  // the server serves the website itself, pg-native is an optional pg add-on.
  external: ['@electric-sql/pglite', '@fastify/static', 'pg-native'],
  define: { 'process.env.APP_VERSION': JSON.stringify(version) },
  // CommonJS dependencies (fastify, pg) call require() for Node built-ins.
  banner: { js: "import { createRequire as __wrCreateRequire } from 'node:module'; const require = __wrCreateRequire(import.meta.url);" },
  logLevel: 'warning',
})

writeFileSync(
  `${fn}/.vc-config.json`,
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, regions: [REGION], maxDuration: 15 }, null, 2),
)

writeFileSync(
  `${out}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        // Hashed build assets never change; everything else (index.html) is revalidated.
        { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { handle: 'filesystem' },
        // The app uses hash routes (#/admin), so any other path just gets the app shell.
        { src: '^/(.*)$', dest: '/index.html' },
      ],
      // Once a day (02:00 Kuala Lumpur): the automatic backup, and races nobody closed are settled.
      crons: [{ path: '/api/cron/daily', schedule: '0 18 * * *' }],
    },
    null,
    2,
  ),
)

console.log(`Vercel output ready in ${out} (API region: ${REGION}).`)
