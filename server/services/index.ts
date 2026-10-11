import type { Store } from '../db/store'
import { RaceEngine } from '../game/engine'
import { AuthService } from './auth'

export interface Services {
  store: Store
  engine: RaceEngine
  auth: AuthService
  clock: () => number
  appVersion: string
}

export function createServices(store: Store, opts: { appVersion: string; adminDefaultPin: string; clock?: () => number }): Services {
  const clock = opts.clock ?? Date.now
  return {
    store,
    engine: new RaceEngine(store, clock),
    // Admin sessions and lockouts use real time (the game clock can be moved in tests).
    auth: new AuthService(store, opts.adminDefaultPin, Date.now),
    clock,
    appVersion: opts.appVersion,
  }
}
