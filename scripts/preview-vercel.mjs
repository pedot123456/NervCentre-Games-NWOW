// Runs the Vercel build (.vercel/output) locally, the same way Vercel will:
// /api/* goes to the bundled serverless function, everything else is a static file.
// Run via `npm run preview:vercel` (after `npm run build:vercel`).
import { existsSync, readFileSync, statSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const out = path.resolve('.vercel/output')
if (!existsSync(out)) throw new Error('.vercel/output is missing - run `npm run build:vercel` first.')

for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file)
  } catch {
    /* not present */
  }
}

const { default: handler } = await import(pathToFileURL(path.join(out, 'functions/api.func/index.mjs')).href)
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon' }
const port = Number(process.env.PORT) || 3000

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return void handler(req, res)
    let file = path.join(out, 'static', decodeURIComponent(url.pathname))
    if (!file.startsWith(path.join(out, 'static')) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(out, 'static', 'index.html')
    res.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream')
    res.end(readFileSync(file))
  })
  .listen(port, () => {
    console.log(`\n  Vercel build preview: http://localhost:${port}/#/   (Admin: http://localhost:${port}/#/admin)`)
    console.log(`  Database: ${process.env.DATABASE_URL ? 'PostgreSQL (DATABASE_URL)' : 'embedded local database'}\n`)
  })
