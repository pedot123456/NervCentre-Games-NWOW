import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { Fail } from '@shared/protocol'
import { klDayKey } from '@shared/time'
import type { PublicConfig, PublicSettings } from '@shared/types'
import { checkRegistration } from '@shared/validation'
import { getBoards } from '../services/boards'
import { GameError } from '../services/errors'
import type { Services } from '../services'
import { feedbackStatus, runResult, submitFeedback } from '../services/results'

const str = (max = 120) => z.string().min(1).max(max)
const player = z.object({
  full_name: z.string().max(200),
  affiliation_type: z.enum(['project', 'business', 'contractor']).nullable(),
  project_name: z.string().max(300).nullable().optional().transform((v) => v ?? null),
  opu: z.string().max(200).nullable().optional().transform((v) => v ?? null),
  consent: z.boolean(),
})

/** The original Socket.IO events, now one HTTP call each (POST /api/rt/<event>), same payloads and replies. */
const EVENTS = {
  'solo:start': z.object({ player, kiosk_id: z.string().max(120) }),
  'h2h:start': z.object({ players: z.array(player).length(2), kiosk_id: z.string().max(120) }),
  'room:create': z.object({ kiosk_id: z.string().max(120) }),
  'room:join': z.object({ code: z.string().max(10), player, device_id: z.string().max(120) }),
  'room:leave': z.object({ race_id: str(), run_id: str(), token: str() }),
  'room:kick': z.object({ race_id: str(), host_token: str(), run_id: str() }),
  'room:start': z.object({ race_id: str(), host_token: str() }),
  'room:cancel': z.object({ race_id: str(), host_token: str() }),
  'race:watch': z.object({ race_id: str(), run_id: str().optional(), token: str().optional(), host_token: str().optional() }),
  'run:tap': z.object({ race_id: str(), run_id: str(), token: str(), puzzle: z.number().int().min(0).max(50), tile: str(20) }),
  'run:skip': z.object({ race_id: str(), run_id: str(), token: str(), puzzle: z.number().int().min(0).max(50) }),
} as const
type EventName = keyof typeof EVENTS

function failFrom(err: unknown, log: (err: unknown) => void): Fail {
  if (err instanceof GameError) {
    return { ok: false, error: err.code, message: err.message, ...(err.field ? { field: err.field } : {}), ...(err.errors ? { errors: err.errors } : {}) }
  }
  log(err)
  return { ok: false, error: 'server_error', message: 'Something went wrong – please try again.' }
}

const runToken = (req: FastifyRequest) => (req.headers['x-run-token'] as string | undefined) ?? undefined

export function registerPublicRoutes(app: FastifyInstance, svc: Services) {
  const { store, engine } = svc

  app.get('/api/health', async () => ({ ok: true, version: svc.appVersion, time: svc.clock() }))

  /** Clock sync: devices measure the round trip and keep the fastest of a few samples. */
  app.get('/api/time', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store')
    return { now: svc.clock() }
  })

  app.get('/api/config', async (): Promise<PublicConfig> => {
    const [settings, solutions] = await Promise.all([store.getSettings(), store.listSolutions()])
    const { profanity: _p, global_decoys: _g, ...pub } = settings
    const now = svc.clock()
    return {
      settings: pub as PublicSettings,
      solutions: solutions.map((s) => ({ id: s.id, name: s.name, description: s.description })),
      server_time: now,
      today: klDayKey(now),
      version: svc.appVersion,
    }
  })

  app.post('/api/players/validate', async (req, reply) => {
    const settings = await store.getSettings()
    const check = checkRegistration(req.body as never, settings.opus, settings.profanity)
    if (!check.ok) return reply.code(400).send({ error: 'invalid_player', field: check.field, message: check.message, errors: check.errors })
    return { ok: true, value: check.value }
  })

  app.get('/api/boards', async () => {
    await engine.sweep()
    return getBoards(store, svc.clock())
  })

  /** Live races + change markers. Polled by the TV display and the attract screens. */
  app.get('/api/live', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store')
    const [live, pulse] = await Promise.all([engine.liveStates(), store.pulse()])
    return { live, pulse, now: svc.clock() }
  })

  app.get('/api/pulse', async (_req, reply) => {
    reply.header('Cache-Control', 'no-store')
    return store.pulse()
  })

  app.get('/api/runs/:id/result', async (req) => {
    const { id } = z.object({ id: z.string().max(64) }).parse(req.params)
    return runResult(store, id, runToken(req), svc.clock())
  })

  app.get('/api/runs/:id/feedback', async (req) => {
    const { id } = z.object({ id: z.string().max(64) }).parse(req.params)
    return feedbackStatus(store, id, runToken(req), svc.clock())
  })

  app.post('/api/feedback', async (req) => {
    const body = z
      .object({
        feedback_id: z.uuid(),
        run_id: z.string().max(64),
        token: z.string().max(200),
        q1_relevant: z.boolean(),
        q2_would_explore: z.boolean(),
        q2_interested_solutions: z.array(z.string().max(60)).max(20).nullable().optional(),
        q3_understanding_rating: z.number().int().min(1).max(5),
        answered_at: z.number().optional(),
      })
      .parse(req.body)
    return submitFeedback(store, { ...body, q2_interested_solutions: body.q2_interested_solutions ?? null, answered_at: body.answered_at ?? svc.clock() }, svc.clock())
  })

  app.post('/api/rt/:event', async (req, reply) => {
    reply.header('Cache-Control', 'no-store')
    const event = (req.params as { event: string }).event as EventName
    const schema = EVENTS[event]
    if (!schema) return reply.code(404).send({ ok: false, error: 'not_found', message: 'Unknown event.' })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return { ok: false, error: 'invalid_request', message: 'Invalid request.' }
    const p = parsed.data as never
    try {
      switch (event) {
        case 'solo:start': {
          const x = p as z.infer<(typeof EVENTS)['solo:start']>
          return { ok: true, ...(await engine.startSolo(x.player, x.kiosk_id)) }
        }
        case 'h2h:start': {
          const x = p as z.infer<(typeof EVENTS)['h2h:start']>
          return { ok: true, ...(await engine.startH2H(x.players, x.kiosk_id)) }
        }
        case 'room:create':
          return { ok: true, ...(await engine.createRoom((p as { kiosk_id: string }).kiosk_id)) }
        case 'room:join': {
          const x = p as z.infer<(typeof EVENTS)['room:join']>
          return { ok: true, ...(await engine.joinRoom(x.code, x.player, x.device_id)) }
        }
        case 'room:leave': {
          const x = p as z.infer<(typeof EVENTS)['room:leave']>
          await engine.leaveRoom(x.race_id, x.run_id, x.token)
          return { ok: true }
        }
        case 'room:kick': {
          const x = p as z.infer<(typeof EVENTS)['room:kick']>
          await engine.kick(x.race_id, x.host_token, x.run_id)
          return { ok: true }
        }
        case 'room:start': {
          const x = p as z.infer<(typeof EVENTS)['room:start']>
          return { ok: true, ...(await engine.startRoom(x.race_id, x.host_token)) }
        }
        case 'room:cancel': {
          const x = p as z.infer<(typeof EVENTS)['room:cancel']>
          await engine.cancelRoom(x.race_id, x.host_token)
          return { ok: true }
        }
        case 'race:watch': {
          const res = await engine.watch(p as z.infer<(typeof EVENTS)['race:watch']>)
          return { ok: true, race: res.race, now: svc.clock() }
        }
        case 'run:tap':
          return { ok: true, ...(await engine.tap(p as z.infer<(typeof EVENTS)['run:tap']>)) }
        case 'run:skip':
          return { ok: true, ...(await engine.skip(p as z.infer<(typeof EVENTS)['run:skip']>)) }
      }
    } catch (err) {
      return failFrom(err, (e) => req.log.error(e))
    }
  })
}
