/**
 * NWOW Digital Challenge – Word Rush: local / booth server.
 * Serves the kiosk app, the phones, the TV display, the admin area and the API from one process.
 * (On Vercel the same app runs as a serverless function – see vercel.ts.)
 */
import os from 'node:os'
import { buildApp } from './app'
import { cloudProblems, loadConfig } from './config'
import { createStore } from './db/store'

const config = loadConfig()
const problems = cloudProblems(config)
if (problems.length) {
  for (const p of problems) console.error(`\n  x ${p}`)
  console.error('\n  The server did not start. Fix the environment variables and start it again.\n')
  process.exit(1)
}

const { store, migrations, seeded } = await createStore({ databaseUrl: config.databaseUrl, dataDir: config.dataDir })
const lan = Object.values(os.networkInterfaces())
  .flat()
  .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === 'IPv4' && !i.internal)
  .map((i) => `http://${i.address}:${config.port}`)

const { app } = await buildApp({
  store,
  appVersion: config.appVersion,
  adminDefaultPin: config.adminDefaultPin,
  clientDist: config.clientDist,
  publicBaseUrl: config.publicBaseUrl,
  logger: { level: config.logLevel },
})
await app.listen({ port: config.port, host: config.host })

console.log(`
  NWOW Digital Challenge – Word Rush  v${config.appVersion}
  ------------------------------------------------
  Kiosk     http://localhost:${config.port}/#/
  Phones    ${lan.length ? lan.map((u) => `${u}/#/join`).join('  ') : '(no network interface found)'}
  TV        http://localhost:${config.port}/#/display
  Admin     http://localhost:${config.port}/#/admin
  Database  ${config.databaseUrl ? 'PostgreSQL (DATABASE_URL)' : `embedded PostgreSQL at ${config.dataDir}`}${migrations.length ? `\n  Migrated  ${migrations.join(', ')}` : ''}${seeded.length ? `\n  Seeded    ${seeded.join(', ')}` : ''}
  Press Ctrl+C to stop.
`)

async function shutdown(signal: string) {
  console.log(`\n${signal} received – shutting down...`)
  await app.close()
  await store.close()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
