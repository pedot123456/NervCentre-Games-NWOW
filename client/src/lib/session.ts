import { uuid } from '@shared/random'
import { readLocal, writeLocal } from './store'

/** This kiosk / phone (kept on the device, so a refresh keeps the same identity). */
export function deviceId(kind: 'kiosk' | 'device'): string {
  const key = `wr.${kind}.id.v1`
  let id = readLocal<string | null>(key, null)
  if (!id) {
    id = uuid()
    writeLocal(key, id)
  }
  return id
}

/** A saved step of a flow (refresh resume). Expires after `maxAgeMs`. */
export function loadSession<T>(key: string, maxAgeMs: number): T | null {
  const saved = readLocal<{ at: number; data: T } | null>(key, null)
  if (!saved || Date.now() - saved.at > maxAgeMs) return null
  return saved.data
}

export function saveSession<T>(key: string, data: T | null): void {
  writeLocal(key, data === null ? null : { at: Date.now(), data })
}

export const KIOSK_SESSION = 'wr.kiosk.session.v2'
export const PHONE_SESSION = 'wr.phone.session.v2'
/** The kiosk reopens on the same step for 20 minutes. */
export const KIOSK_SESSION_MS = 20 * 60 * 1000
/** Phones keep their place a little longer (a battle plus results and feedback). */
export const PHONE_SESSION_MS = 60 * 60 * 1000
