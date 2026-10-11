import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FastifyInstance } from 'fastify'
import { buildApp } from './app'
import { cloudProblems, loadConfig } from './config'
import { createStore } from './db/store'

/**
 * Vercel serverless entry: every /api/* request is routed here (see scripts/build-vercel.mjs).
 * The app is built once per instance and reused by later requests to the same instance.
 * The website itself is served as static files by Vercel's CDN, not by this function.
 */

let ready: Promise<FastifyInstance> | null = null

async function start(): Promise<FastifyInstance> {
  const config = loadConfig()
  const problems = cloudProblems(config)
  if (problems.length) throw new Error(problems.join(' '))
  const { store } = await createStore({ databaseUrl: config.databaseUrl, dataDir: config.dataDir })
  const { app } = await buildApp({ store, appVersion: config.appVersion, adminDefaultPin: config.adminDefaultPin, publicBaseUrl: config.publicBaseUrl })
  await app.ready()
  return app
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let app: FastifyInstance
  try {
    ready ??= start()
    app = await ready
  } catch (err) {
    ready = null // try again on the next request (e.g. the database was briefly unreachable)
    console.error(err)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'server_error', message: 'The server could not start. See the Vercel function logs.' }))
    return
  }
  app.server.emit('request', req, res)
}
